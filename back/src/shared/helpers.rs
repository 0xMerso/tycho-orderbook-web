use std::collections::HashSet;

use axum::http::HeaderMap;
use tycho_orderbook::{
    data::fmt::SrzProtocolComponent,
    types::{Network, Orderbook},
    utils::r#static::data::keys,
};

use crate::{
    getters,
    misc::r#static::{HEADER_TYCHO_API_KEY, TMP_HD_VALUE},
    types::{PairTag, StreamState},
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
pub fn validate_headers(headers: &HeaderMap) -> bool {
    let key = HEADER_TYCHO_API_KEY;
    match headers.get(key) {
        Some(value) => {
            if let Ok(api_key) = value.to_str() {
                // tracing::trace!("Got header API key: {}", api_key);
                if api_key.to_lowercase() == TMP_HD_VALUE {
                    return true;
                } else {
                    tracing::error!("Invalid API key: {}", api_key);
                }
            }
        }
        None => {
            tracing::error!("Header not found. Rejecting request");
        }
    }
    false
}

/// Prevalidation of the API
/// Check if the API stream is initialised and running, and if the API key is valid
pub async fn prevalidation(network: Network, headers: HeaderMap, initialised: bool) -> Option<String> {
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
    if !validate_headers(&headers) {
        let msg = "Invalid orderbook API key for header: 'tycho-orderbook-web-api-key'";
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
