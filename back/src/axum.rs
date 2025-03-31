use axum::{
    Extension, Json as AxumJson, Router,
    extract::Json as AxumExJson,
    http::HeaderMap,
    response::IntoResponse,
    routing::{get, post},
};
use serde_json::json;
use tycho_orderbook::{
    core::{book, exec},
    data::{
        self,
        fmt::{SrzProtocolComponent, SrzToken},
    },
    maths,
    types::{EnvConfig, ExecutionPayload, ExecutionRequest, Network, Orderbook, OrderbookRequestParams, ProtoTychoState, Response, SharedTychoStreamState, Status, Version},
    utils::{misc::current_timestamp, r#static::data::keys},
};

use utoipa::OpenApi;
use utoipa::ToSchema;

// use utoipa_swagger_ui::SwaggerUi;

/// OpenAPI documentation for the API.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "TAP-2 Orderbook API",
        version = "1.0.0",
        description = "An Rust Axum API serving different Tycho Streams, providing orderbook and liquidity data for one network",
    ),
    paths(
        version,
        network,
        status,
        tokens,
        components,
        orderbook,
        execute
    ),
    components(
        schemas(Version, Network, Status, SrzToken, SrzProtocolComponent, Orderbook, ExecutionPayload, ExecutionRequest)
    ),
    servers(
        (url = "/api", description = "API base path")
    ),
    tags(
        (name = "API", description = "Endpoints")
    )
)]
struct APIDoc;

/// ===== API Helpers =====

pub fn wrap<T: serde::Serialize>(data: Option<T>, error: Option<String>) -> impl IntoResponse {
    match error {
        Some(err) => {
            let response = Response::<String> {
                success: false,
                error: err.clone(),
                data: None,
                ts: current_timestamp(),
            };
            AxumJson(json!(response))
        }
        None => {
            let response = Response {
                success: true,
                error: String::default(),
                data,
                ts: current_timestamp(),
            };
            AxumJson(json!(response))
        }
    }
}

/// ===== API Helpers =====

// GET / => "Hello, Tycho!"
async fn root() -> impl IntoResponse {
    wrap(Some("Gm!"), None)
}

/// Version endpoint: returns the API version.
#[utoipa::path(
    get,
    path = "/version",
    summary = "API version",
    responses(
        (status = 200, description = "API Version", body = Version)
    ),
    tag = (
        "API"
    )
)]
async fn version() -> impl IntoResponse {
    log::info!("👾 API: GET /version");
    wrap(Some(Version { version: "0.1.0".into() }), None)
}

// GET /network => Get network object and its configuration
#[utoipa::path(
    get,
    path = "/network",
    summary = "Network configuration",
    responses(
        (status = 200, description = "Network configuration", body = Network)
    ),
    tag = (
        "API"
    )
)]
async fn network(Extension(network): Extension<Network>) -> impl IntoResponse {
    log::info!("👾 API: GET /network on {} network", network.name);
    wrap(Some(network.clone()), None)
}

pub async fn _status(network: Network) -> Option<Status> {
    let key1 = keys::stream::status(network.name.clone());
    let key2 = keys::stream::latest(network.name.clone());
    let key3 = keys::stream::updated(network.name.clone());
    let status = data::redis::get::<u128>(key1.as_str()).await;
    let latest = data::redis::get::<u64>(key2.as_str()).await;
    let updated = data::redis::get::<Vec<String>>(key3.as_str()).await;
    match (status, latest, updated) {
        (Some(status), Some(latest), Some(updated)) => Some(Status {
            status: status.to_string(),
            latest: latest.to_string(),
            updated,
        }),
        _ => None,
    }
}

// GET /status => Get network status + last block synced
#[utoipa::path(
    get,
    path = "/status",
    summary = "API status and latest block synchronized",
    description = "API is 'running' when Redis and Stream are ready. Block updated at each new header after processing state updates",
    responses(
        (status = 200, description = "Current API status and latest block synchronized, along with last block updated components", body = Status)
    ),
    tag = (
        "API"
    )
)]
async fn status(Extension(network): Extension<Network>) -> impl IntoResponse {
    log::info!("👾 API: GET /status on {} network", network.name);
    match _status(network.clone()).await {
        Some(data) => wrap(Some(data), None),
        _ => wrap(None, Some("Failed to get status".to_string())),
    }
}

async fn _tokens(network: Network) -> Option<Vec<SrzToken>> {
    let key = keys::stream::tokens(network.name.clone());
    data::redis::get::<Vec<SrzToken>>(key.as_str()).await
}

// GET /tokens => Get tokens object from Tycho
#[utoipa::path(
    get,
    path = "/tokens",
    summary = "All Tycho tokens on the network",
    description = "Only quality tokens are listed here (evaluated at 100 by Tycho = no rebasing, etc)",
    responses(
        (status = 200, description = "Tycho Tokens on the network", body = Vec<SrzToken>)
    ),
    tag = (
        "API"
    )
)]
async fn tokens(Extension(network): Extension<Network>) -> impl IntoResponse {
    log::info!("👾 API: GET /tokens on {} network", network.name);
    match _tokens(network.clone()).await {
        Some(tokens) => wrap(Some(tokens), None),
        _ => wrap(None, Some("Failed to get tokens".to_string())),
    }
}

pub async fn _components(network: Network) -> Option<Vec<SrzProtocolComponent>> {
    let key = keys::stream::components(network.name.clone());
    data::redis::get::<Vec<SrzProtocolComponent>>(key.as_str()).await
}

// GET /components => Get all existing components
#[utoipa::path(
    get,
    path = "/components",
    summary = "Tycho components (= liquidity pools)",
    description = "Returns all components available on the network",
    responses(
        (status = 200, description = "Tycho Components (= liquidity pools)", body = SrzProtocolComponent)
    ),
    tag = (
        "API"
    )
)]
async fn components(Extension(network): Extension<Network>) -> impl IntoResponse {
    log::info!("👾 API: GET /components on {} network", network.name);
    match _components(network).await {
        Some(cps) => {
            log::info!("Returning {} components", cps.len());
            wrap(Some(cps), None)
        }
        _ => {
            log::error!("Failed to get components");
            wrap(None, Some("Failed to get components".to_string()))
        }
    }
}

// POST /execute => Execute a trade
#[utoipa::path(
    post,
    path = "/execute",
    summary = "Build transaction for a given orderbook point",
    request_body = ExecutionRequest,
    description = "Using Tycho execution engine, build a transaction according to a given orderbook point/distribution",
    responses(
        (status = 200, description = "The trade result", body = ExecutionPayload)
    ),
    tag = ("API")
)]
async fn execute(headers: HeaderMap, Extension(network): Extension<Network>, Extension(config): Extension<EnvConfig>, AxumExJson(execution): AxumExJson<ExecutionRequest>) -> impl IntoResponse {
    log::info!("👾 API: Querying execute endpoint: {:?}", execution);
    match exec::swap(network.clone(), execution.clone(), config.clone()).await {
        Ok(result) => wrap(Some(result), None),
        Err(e) => {
            let error = e.to_string();
            wrap(None, Some(error))
        }
    }
}

/// Verify orderbook cache
/// If the orderbook is not in the cache, the function will be computed
/// If the orderbook is in the cache, check
pub async fn _verify_obcache(network: Network, acps: Vec<SrzProtocolComponent>, tag: String) -> Option<Orderbook> {
    let key = keys::stream::orderbook(network.name.clone(), tag);
    match data::redis::get::<Orderbook>(key.as_str()).await {
        Some(orderbook) => {
            log::info!("Orderbook found in cache, at block {} and timestamp: {}", orderbook.block, orderbook.timestamp);
            let pools = orderbook.pools.clone();
            for previous in pools {
                if let Some(current) = acps.iter().find(|x| x.id.to_lowercase() == previous.id.to_lowercase()) {
                    let delta = current.last_updated_at as i64 - previous.last_updated_at as i64;
                    if delta > 0 {
                        log::info!("Cp {} outdated (new: {} vs old: {} = delta {})", current.id, current.last_updated_at, previous.last_updated_at, delta);
                        return None;
                    }
                } else {
                    log::info!("Component {} not found in current components", previous.id);
                    return None;
                }
            }
            log::info!("Orderbook is up to date");
            return Some(orderbook);
        }
        _ => {
            log::info!("Couldn't find orderbook in cache");
        }
    }
    None
}

pub fn validation(headers: &HeaderMap) -> bool {
    let pwd = "todo";
    let key = "tycho-orderbook-ui-api-key";
    match headers.get(key) {
        Some(value) => {
            if let Ok(api_key) = value.to_str() {
                log::info!("Got API key: {}", api_key);
                return true;
                // if api_key.to_lowercase() == tmp_pwd {
                //     return true;
                // } else {
                //     log::error!("Invalid API key: {}", api_key);
                // }
            }
        }
        None => {
            log::error!("Header not found. Rejecting request");
        }
    }
    true // ! Hardcoded
}

// POST /orderbook/{0xt0-0xt1} => Simulate the orderbook
#[utoipa::path(
    post,
    path = "/orderbook",
    summary = "Orderbook for a given pair of tokens",
    description = "Aggregate liquidity across AMMs, simulates an orderbook (bids/asks). Depending on the number of components (pool having t0 AND t1) and simulation input config, the orderbook can be more or less accurate, and the simulation can take up to severals minutes",
    request_body = OrderbookRequestParams,
    responses(
        (status = 200, description = "Contains trade simulations, results and components", body = Orderbook)
    ),
    tag = (
        "API"
    )
)]
async fn orderbook(
    headers: HeaderMap,
    Extension(shtss): Extension<SharedTychoStreamState>,
    Extension(network): Extension<Network>,
    AxumExJson(params): AxumExJson<OrderbookRequestParams>,
) -> impl IntoResponse {
    let single = params.sps.is_some();
    log::info!("👾 API: OrderbookRequestParams: {:?} | Single point: {}", params, single);

    // if validation(&headers) == false {
    //     let msg = " 🔺 Invalid orderbook API key for header: 'tycho-orderbook-ui-api-key'";
    //     log::info!("{}", msg);
    //     return wrap(None, Some(msg.to_string()));
    // }

    match (_tokens(network.clone()).await, _components(network.clone()).await) {
        (Some(atks), Some(acps)) => {
            let target = params.tag.clone();
            let targets = target.split("-").map(|x| x.to_string().to_lowercase()).collect::<Vec<String>>();
            let srzt0 = atks.iter().find(|x| x.address.to_lowercase() == targets[0].clone().to_lowercase());
            let srzt1 = atks.iter().find(|x| x.address.to_lowercase() == targets[1].clone().to_lowercase());
            if srzt0.is_none() {
                log::error!("Couldn't find tokens[0]: {}", targets[0]);
                return wrap(None, Some("Couldn't find tokens for pair tag given (tokens[0])".to_string()));
            } else if srzt1.is_none() {
                log::error!("Couldn't find  tokens[1]: {}", targets[1]);
                return wrap(None, Some("Couldn't find tokens for pair tag given (tokens[1])".to_string()));
            }
            let srzt0 = srzt0.unwrap();
            let srzt1 = srzt1.unwrap();
            let targets = vec![srzt0.clone(), srzt1.clone()];
            let (base_to_eth_path, base_to_eth_comps) = maths::path::routing(acps.clone(), srzt0.address.to_string().to_lowercase(), network.eth.to_lowercase()).unwrap_or_default();
            let (quote_to_eth_path, quote_to_eth_comps) = maths::path::routing(acps.clone(), srzt1.address.to_string().to_lowercase(), network.eth.to_lowercase()).unwrap_or_default();
            // log::info!("Path from {} to network.ETH is {:?}", srzt0.symbol, base_to_eth_path);
            if targets.len() == 2 {
                let mut ptss: Vec<ProtoTychoState> = vec![];
                let mut to_eth_ptss: Vec<ProtoTychoState> = vec![];
                for cp in acps.clone() {
                    let cptks = cp.tokens.clone();
                    if book::matchcp(cptks.clone(), targets.clone()) {
                        let mtx = shtss.read().await;
                        match mtx.protosims.get(&cp.id.to_lowercase()) {
                            Some(protosim) => {
                                ptss.push(ProtoTychoState {
                                    component: cp.clone(),
                                    protosim: protosim.clone(),
                                });
                            }
                            None => {
                                log::error!("matchcp: couldn't find protosim for component {}", cp.id);
                            }
                        }
                        drop(mtx);
                    }
                    if base_to_eth_comps.contains(&cp.id.to_lowercase()) || quote_to_eth_comps.contains(&cp.id.to_lowercase()) {
                        let mtx = shtss.read().await;
                        match mtx.protosims.get(&cp.id.to_lowercase()) {
                            Some(protosim) => {
                                to_eth_ptss.push(ProtoTychoState {
                                    component: cp.clone(),
                                    protosim: protosim.clone(),
                                });
                            }
                            None => {
                                log::error!("contains: couldn't find protosim for component {}", cp.id);
                            }
                        }
                        drop(mtx);
                    }
                }

                if ptss.is_empty() {
                    return wrap(None, Some("ProtoTychoState: pair requested has 0 associated pools".to_string()));
                }

                if !single {
                    if let Some(cache_obk) = _verify_obcache(network.clone(), acps.clone(), params.tag.clone()).await {
                        return wrap(Some(cache_obk), None);
                    }
                }

                let unit_base_ethworth = maths::path::quote(to_eth_ptss.clone(), atks.clone(), base_to_eth_path.clone());
                let unit_quote_ethworth = maths::path::quote(to_eth_ptss.clone(), atks.clone(), quote_to_eth_path.clone());
                match (unit_base_ethworth, unit_quote_ethworth) {
                    (Some(unit_base_ethworth), Some(unit_quote_ethworth)) => {
                        let result = book::build(network.clone(), None, ptss.clone(), targets.clone(), params.clone(), None, unit_base_ethworth, unit_quote_ethworth).await;
                        if !single {
                            // let path = format!("misc/data-front-v2/orderbook.{}.{}-{}.json", network.name, srzt0.symbol.to_lowercase(), srzt1.symbol.to_lowercase());
                            // crate::shd::utils::misc::save1(result.clone(), path.as_str());
                            // Save Redis cache
                            let tag = format!("{}-{}", result.base.address.to_lowercase(), result.quote.address.to_lowercase());
                            let key = keys::stream::orderbook(network.name.clone(), tag);
                            log::info!("Saving orderbook to Redis cache with key: {}", key);
                            data::redis::set(key.as_str(), result.clone()).await;
                        }
                        wrap(Some(result), None)
                    }
                    _ => {
                        let msg = format!("Couldn't find the quote path from {} to ETH", srzt0.symbol);
                        log::error!("{}", msg);
                        wrap(None, Some(msg))
                    }
                }
            } else {
                let msg = format!(
                    "Couldn't find the pair of tokens for tag {} - Query param Tag must contain only 2 tokens separated by a dash '-'",
                    target
                );
                log::error!("{}", msg);
                wrap(None, Some(msg))
            }
        }
        _ => {
            let msg = "Couldn't not read internal components";
            log::error!("{}", msg);
            wrap(None, Some(msg.to_string()))
        }
    }
}

pub async fn start(n: Network, shared: SharedTychoStreamState, config: EnvConfig) {
    log::info!("👾 Launching API for '{}' network | 🧪 Testing mode: {:?} | Port: {}", n.name, config.testing, n.port);
    // shd::utils::misc::log::logtest();
    let rstate = shared.read().await;
    log::info!("Testing SharedTychoStreamState read = {:?} with {:?}", rstate.protosims.keys(), rstate.protosims.values());
    log::info!(" => rstate.states.keys and rstate.states.values => {:?} with {:?}", rstate.protosims.keys(), rstate.protosims.values());
    log::info!(
        " => rstate.components.keys and rstate.components.values => {:?} with {:?}",
        rstate.components.keys(),
        rstate.components.values()
    );
    log::info!(" => rstate.initialised => {:?} ", rstate.initialised);
    drop(rstate);

    // Add /api prefix
    let inner = Router::new()
        .route("/", get(root))
        .route("/version", get(version))
        .route("/network", get(network))
        .route("/status", get(status))
        .route("/tokens", get(tokens))
        .route("/components", get(components))
        .route("/orderbook", post(orderbook))
        .route("/execute", post(execute))
        // Swagger
        .layer(Extension(shared.clone())) // Shared state
        .layer(Extension(n.clone()))
        .layer(Extension(config.clone())); // EnvConfig

    let app = Router::new().nest("/api", inner);
    // .merge(SwaggerUi::new("/swagger").url("/api-docs/openapi.json", APIDoc::openapi()));

    match tokio::net::TcpListener::bind(format!("0.0.0.0:{}", n.port)).await {
        Ok(listener) => match axum::serve(listener, app).await {
            Ok(_) => {
                log::info!("(Logs never displayed in theory): API for '{}' network is running on port {}", n.name, n.port);
            }
            Err(e) => {
                log::error!("Failed to start API for '{}' network: {}", n.name, e);
            }
        },
        Err(e) => {
            log::error!("Failed to bind to port {}: {}", n.port, e);
        }
    }
}
