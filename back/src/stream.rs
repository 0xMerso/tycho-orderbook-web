use futures::FutureExt;
use std::collections::HashMap;
use std::panic::AssertUnwindSafe;
use std::sync::Arc;
use tracing::Level;
use tycho_simulation::protocol::models::BlockUpdate;

use futures::StreamExt;
use shared::data::data::keys;
use shared::getters;
use shared::misc::r#static::RESTART_STREAM_DELAY;
use shared::types::EnvAPIConfig;
use shared::types::StreamState;
use tokio::sync::RwLock;
use tycho_orderbook::builder::OrderbookBuilder;
use tycho_orderbook::builder::OrderbookBuilderConfig;
use tycho_orderbook::core::client;
use tycho_orderbook::core::helper::default_protocol_stream_builder;
use tycho_orderbook::data::fmt::SrzProtocolComponent;
use tycho_orderbook::data::fmt::SrzToken;
use tycho_orderbook::types::Network;
use tycho_orderbook::types::SharedTychoStreamState;
use tycho_orderbook::types::TychoStreamState;
use tycho_orderbook::utils::misc::current_timestamp;
use tycho_orderbook::utils::r#static::filter;
use tycho_simulation::models::Token;
use tycho_simulation::tycho_client::feed::component_tracker::ComponentFilter;

pub mod axum;

/// Stream the entire state from each AMMs, with TychoStreamBuilder.
/// Note: a single connection attempt is made, and if it ends (even due to an error) the function returns, the main loop will handle re-calling stream
async fn stream(network: Network, cache: SharedTychoStreamState, config: EnvAPIConfig, tokens: Vec<Token>) {
    tracing::debug!("Connecting ProtocolStreamBuilder task for {} with {} tokens", network.name, tokens.len());
    let srztokens = tokens.iter().map(|t| SrzToken::from(t.clone())).collect::<Vec<_>>();
    let key = keys::stream::tokens(network.name.clone());
    shared::data::set(key.as_str(), srztokens.clone()).await;
    let builder_config = OrderbookBuilderConfig {
        filter: ComponentFilter::with_tvl_range(filter::ADD_TVL_THRESHOLD, filter::ADD_TVL_THRESHOLD),
    };
    let psb = default_protocol_stream_builder(network.clone(), config.tycho_api_key.clone(), builder_config.clone(), tokens.clone()).await;
    let builder = OrderbookBuilder::new(network.clone(), psb, config.tycho_api_key.clone(), tokens.clone());
    let stream = builder.psb.build().await;
    if stream.is_err() {
        let err = stream.err().unwrap();
        tracing::warn!("Failed to build stream on {}: {:?}. Exiting.", network.name, err.to_string());
        // Set error state before returning.
        shared::data::set(keys::stream::status(network.name.clone()).as_str(), StreamState::Error as u128).await;
        return;
    }
    {
        // Use a block so that the stream is dropped at the end, just to ensure the connection is closed, but not it's necessary.
        let mut stream = stream.unwrap();
        loop {
            match stream.next().await {
                Some(msg) => {
                    match msg {
                        Ok(msg) => {
                            tracing::info!(
                                "{} '{}' stream: block # {} with {} states updates, + {} pairs, - {} pairs",
                                network.tag.clone(),
                                network.name.clone(),
                                msg.block_number,
                                msg.states.len(),
                                msg.new_pairs.len(),
                                msg.removed_pairs.len()
                            );
                            shared::data::set(keys::stream::latest(network.name.clone()).as_str(), msg.block_number).await;
                            let mtx = cache.read().await;
                            let initialised = mtx.initialised;
                            drop(mtx);
                            if !initialised {
                                tracing::info!("First stream (= uninitialised). Writing the entire streamed data into the TychoStreamState shared struct.");
                                shared::data::set(keys::stream::status(network.name.clone()).as_str(), StreamState::Syncing as u128).await;
                                // ===== Update Shared State at first sync only =====
                                let mut targets = vec![];
                                for (_id, comp) in msg.new_pairs.iter() {
                                    targets.push(comp.id.to_string().to_lowercase());
                                }
                                let mut mtx = cache.write().await;
                                mtx.protosims = msg.states.clone();
                                mtx.components = msg.new_pairs.clone();
                                mtx.initialised = true;
                                drop(mtx);
                                let mut components = vec![];
                                for m in targets.clone() {
                                    if let Some(_proto) = msg.states.get(&m.to_string()) {
                                        let comp = msg.new_pairs.get(&m.to_string()).expect("New pair not found");
                                        if comp.id.to_string().contains(filter::NULL_ADDRESS) {
                                            tracing::debug!("Component {} has no address. Skipping.", comp.id);
                                            continue;
                                        }
                                        components.push(SrzProtocolComponent::from(comp.clone()));
                                    }
                                }
                                // ===== Storing ALL components =====
                                tracing::debug!("Storing {} components on {}", components.len(), network.name);
                                let key = keys::stream::components(network.name.clone());
                                shared::data::set(key.as_str(), components.clone()).await;
                                let key = keys::stream::updated(network.name.clone());
                                shared::data::set::<Vec<String>>(key.as_str(), vec![]).await;
                                // ===== Set StreamState to up and running =====
                                shared::data::set(keys::stream::status(network.name.clone()).as_str(), StreamState::Running as u128).await;
                                tracing::info!("✅ Proto Stream initialised successfully. StreamState set to 'Running' on {}", network.name.clone());
                            } else {
                                // ===== Update Shared State =====
                                // tracing::trace!("Stream already initialised. Updating the mutex-shared state with new data, and updating Redis.");
                                let mut components_to_update = vec![];
                                if !msg.states.is_empty() {
                                    let mut mtx = cache.write().await;
                                    let cpids = msg.states.keys().map(|x| x.clone().to_lowercase()).collect::<Vec<String>>();
                                    for x in msg.states.iter() {
                                        mtx.protosims.insert(x.0.clone().to_lowercase(), x.1.clone());
                                        components_to_update.push(x.0.clone().to_lowercase());
                                    }
                                    let key = keys::stream::updated(network.name.clone());
                                    shared::data::set::<Vec<String>>(key.as_str(), cpids.clone()).await;
                                    drop(mtx);
                                }

                                if !components_to_update.is_empty() || !msg.new_pairs.is_empty() || !msg.removed_pairs.is_empty() {
                                    match getters::components(network.clone()).await {
                                        Some(mut components) => {
                                            let timestamp = current_timestamp();
                                            for x in components_to_update.iter() {
                                                if let Some(pos) = components.iter().position(|current| current.id.to_string().to_lowercase() == x.to_string().to_lowercase()) {
                                                    components[pos].last_updated_at = timestamp;
                                                }
                                            }
                                            for x in msg.new_pairs.iter() {
                                                let pc = SrzProtocolComponent::from(x.1.clone());
                                                if let Some(pos) = components.iter().position(|current| current.id.to_string().to_lowercase() == x.0.to_string().to_lowercase()) {
                                                    components[pos] = pc;
                                                } else {
                                                    components.push(pc);
                                                }
                                            }
                                            for x in msg.removed_pairs.iter() {
                                                if let Some(pos) = components.iter().position(|current| current.id.to_string().to_lowercase() == x.0.to_string().to_lowercase()) {
                                                    components.swap_remove(pos);
                                                }
                                            }
                                            let key = keys::stream::components(network.name.clone());
                                            shared::data::set(key.as_str(), components.clone()).await;
                                        }
                                        None => {
                                            tracing::error!("Failed to get components. Exiting.");
                                        }
                                    }
                                }
                                shared::data::set(keys::stream::status(network.name.clone()).as_str(), StreamState::Running as u128).await;
                            }
                        }
                        Err(e) => {
                            tracing::warn!("Error receiving BlockUpdate from stream on {}: {:?}.", network.name, e.to_string());
                            shared::data::set(keys::stream::status(network.name.clone()).as_str(), StreamState::Error as u128).await;
                            break;
                        }
                    };
                }
                None => {
                    tracing::warn!("Stream ended on network {}. Exiting stream session.", network.name);
                    break;
                }
            };
        }
    }
}

pub type Cache = Arc<RwLock<HashMap<String, Arc<RwLock<TychoStreamState>>>>>;

/// Stream the entire state from each AMMs, with TychoStreamBuilder.
#[tokio::main]
async fn main() {
    // console_subscriber::init();
    let filter = tracing_subscriber::EnvFilter::from_default_env();
    tracing_subscriber::fmt().with_max_level(Level::TRACE).with_env_filter(filter).init();
    tracing::info!("--- --- --- Launching Tycho Orderbook (streams & API) --- --- ---");
    dotenv::from_filename(".env").ok(); // Use .env.ex for testing purposes
    let config = EnvAPIConfig::new();
    let commit = shared::helpers::commit();
    tracing::info!("Launching Tycho streams on {:?} | 🧪 Testing mode: {:?} | Commit: {:?}", config.networks, config.testing, commit);
    let networks = tycho_orderbook::utils::r#static::networks();
    let targets = config.networks.clone();
    let networks = networks.into_iter().filter(|x| targets.contains(&x.name.to_lowercase())).collect::<Vec<Network>>();
    shared::data::ping().await;
    for network in networks.clone() {
        shared::data::set(keys::stream::status(network.name.clone()).as_str(), StreamState::Launching as u128).await;
        shared::data::set(keys::stream::latest(network.name.clone().to_string()).as_str(), 0).await;
    }
    // --- Heartbeat ---
    shared::helpers::hearbeats(networks.clone(), config.clone()).await;

    // --- Create a cache for the shared state, this is the key to share the state between streams and API tasks ---
    let cache: Arc<RwLock<HashMap<String, SharedTychoStreamState>>> = Arc::new(RwLock::new(HashMap::new()));

    // --- Initialize state for each network ---
    for net in &networks {
        cache.write().await.insert(
            net.name.clone(),
            Arc::new(RwLock::new(TychoStreamState {
                protosims: HashMap::new(),
                components: HashMap::new(),
                initialised: false,
            })),
        );
    }
    let readable = Arc::clone(&cache);
    let dupc = config.clone();
    let dupnets = networks.clone();

    // --- Fetch tokens for each network ---
    let mut atks = HashMap::new();
    for network in networks.clone() {
        let tokens = match client::tokens(&network, config.tycho_api_key.clone()).await {
            Some(t) => t,
            None => {
                tracing::error!("Failed to get tokens for network {}", network.name);
                continue;
            }
        };
        atks.insert(network.name.clone(), tokens.clone());
    }
    tracing::debug!("Spawning stream tasks for network");
    for network in networks {
        let config = config.clone();
        let states = Arc::clone(&cache);
        let tokens = atks.get(&network.name).expect("Tokens must be present").clone();
        tracing::info!("Tycho client built successfully for network {}", network.name);
        tokio::spawn(async move {
            loop {
                tracing::debug!("Launching stream for network {}", network.name);
                let state = {
                    let map = states.read().await;
                    map.get(&network.name).expect("State must be present").clone()
                };
                let streaming = AssertUnwindSafe(stream(network.clone(), state, config.clone(), tokens.clone())).catch_unwind().await;
                match streaming {
                    Ok(_) => {
                        tracing::debug!("Stream for {} ended normally. Restarting...", network.name);
                    }
                    Err(e) => {
                        tracing::error!("Stream for {} panicked: {:?}. Restarting...", network.name, e);
                    }
                }
                let delay = if config.testing { 5 } else { RESTART_STREAM_DELAY };
                tracing::debug!("Waiting {} seconds before restarting stream for {}", delay, network.name);
                tokio::time::sleep(tokio::time::Duration::from_secs(delay)).await;
            }
        });
    }

    // --- Spawn the Axum server ---
    tokio::time::sleep(tokio::time::Duration::from_millis(2500)).await; // Wait streams init
    axum::start(dupnets.clone(), Arc::clone(&readable), dupc.clone()).await;
}
