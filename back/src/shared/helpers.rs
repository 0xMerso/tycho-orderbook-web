use std::{collections::HashSet, process::Command, time::Duration};

use axum::http::HeaderMap;
use tycho_orderbook::{
    data::fmt::SrzProtocolComponent,
    types::{Network, Orderbook},
};

use crate::{
    data::data::keys,
    getters,
    misc::r#static::{HEADER_TYCHO_API_KEY, HEARTBEAT_DELAY},
    types::{EnvAPIConfig, PairTag, StreamState},
};

/// Verify orderbook cache
/// If the orderbook is not in the cache, the function will be computed
/// If the orderbook is in the cache, check
pub async fn verify_obcache(network: Network, acps: Vec<SrzProtocolComponent>, tag: String) -> Option<Orderbook> {
    let key = keys::stream::orderbook(network.name.clone(), tag);
    match crate::data::get::<Orderbook>(key.as_str()).await {
        Some(orderbook) => {
            tracing::info!("Orderbook found in cache, at block {} and timestamp: {}", orderbook.block, orderbook.timestamp);
            let pools = orderbook.pools.clone();
            for previous in pools {
                if let Some(current) = acps.iter().find(|x| x.id.to_lowercase() == previous.id.to_lowercase()) {
                    let delta = current.last_updated_at as i64 - previous.last_updated_at as i64;
                    if delta > 0 {
                        tracing::debug!("Cp {} outdated (new: {} vs old: {} = delta {})", current.id, current.last_updated_at, previous.last_updated_at, delta);
                        return None;
                    }
                } else {
                    tracing::debug!("Component {} not found in current components", previous.id);
                    return None;
                }
            }
            tracing::debug!("Orderbook is up to date");
            return Some(orderbook);
        }
        _ => {
            tracing::info!("Couldn't find orderbook in cache");
        }
    }
    None
}

/// Validate headers for POST requests
/// Used to prevent unauthorized access to the API
pub fn validate_headers(headers: &HeaderMap, expected: String) -> (bool, String) {
    let key = HEADER_TYCHO_API_KEY;
    match headers.get(key) {
        Some(value) => {
            if let Ok(api_key) = value.to_str() {
                // tracing::trace!("Got header API key: {}", api_key);
                if api_key.to_lowercase() == expected {
                    return (true, "Authorized".to_string());
                }
            }
        }
        None => {
            tracing::error!("Header not found. Rejecting request");
        }
    }
    (false, "Invalid headers".to_string())
}

/// Prevalidation of the API
/// Check if the API stream is initialised and running, and if the API key is valid
pub async fn prevalidation(network: Network, headers: HeaderMap, initialised: bool, expected_api_key: String) -> Option<String> {
    // Check if the API stream is initialised
    if !initialised {
        let msg = "API is not yet initialised";
        tracing::warn!("{}", msg);
        return Some(msg.to_string());
    }
    // Check if the API is running
    match getters::status(network.clone()).await {
        Some(status) => {
            if status.stream != StreamState::Running as u128 {
                let msg = format!("API is not yet running: got {:?} vs {:?}", status.stream, StreamState::Running);
                tracing::error!("{}", msg);
                return Some(msg);
            }
        }
        _ => {
            let msg = "Failed to get API status";
            tracing::error!("{}", msg);
            return Some(msg.to_string());
        }
    }
    // Check if the API key is valid
    let (allowed, msg) = validate_headers(&headers, expected_api_key);
    if !allowed {
        tracing::error!("{}", msg);
        return Some(msg.to_string());
    }
    None
}

/// Generate all unique unordered pairs based on token address from a slice of protocol components.
/// Each component's tokens are paired and uniqueness is enforced on the pair (addrbase, addrquote).
pub fn generate_pair_tags(components: &[SrzProtocolComponent]) -> Vec<PairTag> {
    let mut seen = HashSet::new();
    let mut pairs = Vec::new();

    for component in components {
        let tokens = &component.tokens;
        if tokens.len() < 2 {
            continue;
        }
        // Create all unique pairs from the tokens vector
        for i in 0..tokens.len() {
            for j in i + 1..tokens.len() {
                let token1 = &tokens[i];
                let token2 = &tokens[j];
                // Order tokens by address to ensure uniqueness regardless of order.
                let (first, second) = if token1.address <= token2.address { (token1, token2) } else { (token2, token1) };
                let key = (first.address.clone(), second.address.clone());
                if seen.contains(&key) {
                    continue;
                }
                seen.insert(key);
                pairs.push(PairTag {
                    base: first.symbol.clone(),
                    quote: second.symbol.clone(),
                    addrbase: first.address.clone(),
                    addrquote: second.address.clone(),
                });
            }
        }
    }
    // Optional: sort the pairs by addrbase then addrquote for consistent ordering.
    pairs.sort_by(|a, b| a.addrbase.cmp(&b.addrbase).then(a.addrquote.cmp(&b.addrquote)));
    pairs
}

/// Get the current Git commit hash
pub fn commit() -> Option<String> {
    let output = Command::new("git").args(["rev-parse", "HEAD"]).output().expect("Failed to execute git command");
    if output.status.success() {
        let commit = String::from_utf8_lossy(&output.stdout).trim().to_string();
        tracing::debug!("♻️  Commit: {}", commit);
        Some(commit)
    } else {
        let error_message = String::from_utf8_lossy(&output.stderr);
        tracing::debug!("♻️  Failed to get Git Commit hash: {}", error_message);
        None
    }
}
/// Send a heartbeat 200 Get
pub async fn alive(endpoint: String) -> bool {
    let client = reqwest::Client::new();
    match client.get(endpoint.clone()).send().await {
        Ok(_res) => {
            // tracing::debug!("Hearbeat Success for {}: {}", endpoint.clone(), res.status());
            true
        }
        Err(e) => {
            tracing::error!("Hearbeat Error on {}: {}", endpoint, e);
            false
        }
    }
}

/// Conditional heartbeat, with a dedicated task. Not used for now.
/// 1. Fetch Redis data size > 0
/// 2. Assert Network status latest > 0
pub async fn hearbeats(networks: Vec<Network>, config: EnvAPIConfig) {
    commit();
    if config.testing {
        tracing::info!("Testing mode, heartbeat task not spawned.");
        return;
    }
    tracing::info!("Spawning heartbeat task.");
    tokio::spawn(async move {
        let mut hb = tokio::time::interval(Duration::from_secs(HEARTBEAT_DELAY));
        loop {
            hb.tick().await;
            tracing::debug!("Heartbeat tick");
            for (x, network) in networks.clone().iter().enumerate() {
                match crate::getters::status(network.clone()).await {
                    Some(data) => {
                        if data.latest.parse::<u64>().unwrap() > 0u64 && data.stream == StreamState::Running as u128 {
                            match config.heartbeats.get(x) {
                                Some(endpoint) => {
                                    let endpoint = format!("https://uptime.betterstack.com/api/v1/heartbeat/{}", endpoint.clone());
                                    if alive(endpoint.clone()).await {
                                        tracing::debug!("Heartbeat Success for {}: {}", network.name, endpoint.clone());
                                    } else {
                                        tracing::error!("Heartbeat Error for {}: {}", network.name, endpoint.clone());
                                    }
                                }
                                None => {
                                    tracing::error!("Heartbeat Error: No endpoint for network {}", network.name);
                                    continue;
                                }
                            }
                        }
                    }
                    None => {
                        tracing::error!("Heartbeat Error: No data for network {}", network.name);
                        continue;
                    }
                }
            }
        }
    });
}
