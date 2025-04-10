use std::collections::HashMap;
use std::sync::Arc;

use futures::StreamExt;
use shared::data::data::keys;
use shared::getters;
use shared::misc::r#static::RESTART_STREAM_DELAY;
use shared::types::EnvAPIConfig;
use shared::types::StreamState;
use tokio::sync::RwLock;
use tracing::Level;
use tycho_orderbook::builder::OrderbookBuilder;
use tycho_orderbook::builder::OrderbookBuilderConfig;
use tycho_orderbook::core::client;
use tycho_orderbook::core::helper::default_protocol_stream_builder;
use tycho_orderbook::data::fmt::SrzProtocolComponent;
use tycho_orderbook::data::fmt::SrzToken;
use tycho_orderbook::types;
use tycho_orderbook::types::Network;
use tycho_orderbook::types::SharedTychoStreamState;
use tycho_orderbook::types::TychoStreamState;
use tycho_orderbook::utils::misc::current_timestamp;
use tycho_orderbook::utils::r#static::filter;
use tycho_simulation::models::Token;
use tycho_simulation::tycho_client::feed::component_tracker::ComponentFilter;

pub mod axum;

/// Stream the entire state from each AMMs, with TychoStreamBuilder.
async fn stream(network: Network, shared_state: SharedTychoStreamState, config: EnvAPIConfig, tokens: Vec<Token>) {
    tracing::debug!("1️⃣  Launching ProtocolStreamBuilder task for {} with {} tokens", network.name, tokens.len());
    let (_, _, chain) = types::chain(network.name.clone()).expect("Invalid chain");
    let mut hmt = HashMap::new();
    tokens.iter().for_each(|t| {
        hmt.insert(t.address.clone(), t.clone());
    });
    let srztokens = tokens.clone().iter().map(|t| SrzToken::from(t.clone())).collect::<Vec<SrzToken>>();
    tracing::debug!("Fetched {} tokens from Tycho Client", hmt.len());
    'retry: loop {
        let key = keys::stream::tokens(network.name.clone());
        shared::data::set(key.as_str(), srztokens.clone()).await;
        tracing::debug!("(re) Connecting to ProtocolStreamBuilder at {} on {:?} ...", network.tycho, chain);
        let builder_config = OrderbookBuilderConfig {
            filter: ComponentFilter::with_tvl_range(filter::REMOVE_TVL_THRESHOLD, filter::ADD_TVL_THRESHOLD),
        };
        let psb = default_protocol_stream_builder(network.clone(), config.tycho_api_key.clone(), builder_config.clone(), tokens.clone()).await;
        let builder = OrderbookBuilder::new(network.clone(), psb, config.tycho_api_key.clone(), tokens.clone());
        // The API dont use the orderbook-provider stream for now
        match builder.psb.build().await {
            Ok(mut stream) => {
                while let Some(msg) = stream.next().await {
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
                            let mtx = shared_state.read().await;
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
                                let mut mtx = shared_state.write().await;
                                mtx.protosims = msg.states.clone();
                                mtx.components = msg.new_pairs.clone();
                                mtx.initialised = true;
                                drop(mtx);
                                let mut components = vec![];
                                tracing::debug!("--------- States on network: {} --------- ", network.name);
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
                                tracing::debug!("Storing {} components", components.len());
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
                                    let mut mtx = shared_state.write().await;
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
                                    // tracing::trace!("Received {} new pairs, and {} pairs to be removed. Updating Redis ...", msg.new_pairs.len(), msg.removed_pairs.len());
                                    match getters::components(network.clone()).await {
                                        Some(mut components) => {
                                            let timestamp = current_timestamp();
                                            for x in components_to_update.iter() {
                                                if let Some(pos) = components.iter().position(|current| current.id.to_string().to_lowercase() == x.to_string().to_lowercase()) {
                                                    // New last_updated_at
                                                    components[pos].last_updated_at = timestamp;
                                                    // tracing::info!("Updating component {} with new last_updated_at", components[pos].id);
                                                }
                                            }
                                            for x in msg.new_pairs.iter() {
                                                let pc = SrzProtocolComponent::from(x.1.clone());
                                                // The from function also set the updated_at field, used to cache orderbooks when asked later
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
                            // tracing::info!("--------- Done for {} --------- ", network.name.clone());
                        }
                        Err(e) => {
                            tracing::warn!("🔺 Error receiving BlockUpdate from stream on {}: {:?}. Waiting and continuing.", network.name, e);
                            shared::data::set(keys::stream::status(network.name.clone()).as_str(), StreamState::Error as u128).await;
                            continue 'retry;
                        }
                    };
                }
                tracing::warn!("Stream ended, it should not happend. Restarting...");
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to build stream: {:?}. Waiting a few seconds to retry. You can try again by changing the Tycho Stream filters, or with a dedicated API key.",
                    e.to_string() // BlockSynchronizer error: Fatal error: 503 Service Temporarily Unavailable
                );
                shared::data::set(keys::stream::status(network.name.clone()).as_str(), StreamState::Error as u128).await;
                tokio::time::sleep(tokio::time::Duration::from_secs(60)).await;
                continue 'retry;
            }
        }
    }
}

pub type Cache = Arc<RwLock<HashMap<String, Arc<RwLock<TychoStreamState>>>>>;

/// Stream the entire state from each AMMs, with TychoStreamBuilder.
#[tokio::main]
async fn main() {
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
    // --- Heartbeat
    shared::helpers::hearbeats(networks.clone(), config.clone()).await;
    // ! Idea: put that in main thread, and panic to restart docker if error ?

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
    // --- Spawn the Axum server, one for all networks ---
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(2500)).await; // Wait streams init
            axum::start(dupnets.clone(), Arc::clone(&readable), dupc.clone()).await;
            tracing::debug!("Unexpected error occured. Restarting API");
        }
    });

    tracing::debug!("Spawning supervisor task, for network streams");
    for network in networks {
        let config = config.clone();
        let states = Arc::clone(&cache);
        let tokens = match client::tokens(&network, config.tycho_api_key.clone()).await {
            Some(t) => t,
            None => {
                tracing::error!("Failed to get tokens");
                continue;
            }
        };
        tokio::spawn(async move {
            loop {
                // Spawn the network-specific stream task.
                let task = tokio::spawn({
                    let task_network = network.clone();
                    let task_tokens = tokens.clone();
                    let states = Arc::clone(&states);
                    let config = config.clone();
                    async move {
                        // Retrieve the shared state for this task_networkwork.
                        let state = {
                            let map = states.read().await;
                            map.get(&task_network.name).expect("State must be present").clone()
                        };
                        // Call the stream function.
                        stream(task_network, state, config, task_tokens.clone()).await;
                    }
                });
                match task.await {
                    Ok(_) => {
                        tracing::debug!("Stream task for {} ended normally. Restarting...", network.name);
                    }
                    Err(e) => {
                        tracing::error!("Stream task for {} panicked or was cancelled: {:?}. Restarting...", network.name, e);
                    }
                }
                tracing::debug!("🔺 Task failed. Waiting {} seconds before restarting the stream task for {}", RESTART_STREAM_DELAY, network.name);
                tokio::time::sleep(tokio::time::Duration::from_secs(RESTART_STREAM_DELAY)).await;
            }
        });
    }

    // --- Keep the program running ---
    futures::future::pending::<()>().await;
    tracing::debug!("Stream program terminated");
}
