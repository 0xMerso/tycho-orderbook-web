use axum::{
    extract::Json as AxumExJson,
    http::{self, HeaderMap},
    routing::{get, post},
    Extension, Json as AxumJson, Router,
};

use axum::response::IntoResponse;

use http::HeaderValue;
use serde_json::json;
use shared::{
    data::data::keys,
    getters,
    helpers::{prevalidation, validate_headers},
    types::{APIResponse, EnvAPIConfig, PairTag, Status, Version},
};
use tower_http::cors::{Any, CorsLayer};
use tycho_orderbook::{
    core::{book, exec},
    data::fmt::{SrzProtocolComponent, SrzToken},
    maths,
    types::{ExecutionRequest, Network, Orderbook, OrderbookRequestParams, ProtoTychoState, SharedTychoStreamState, SrzExecutionPayload, SrzTransactionRequest},
    utils::misc::current_timestamp,
};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// OpenAPI documentation for the API.
#[derive(OpenApi)]
#[openapi(
    info(
        title = "Tycho Orderbook API",
        version = "1.0.0",
        description = "An Rust Axum API serving different Tycho Streams, providing orderbook and liquidity data for one network",
    ),
    paths(
        version,
        networks,
        status,
        tokens,
        components,
        pairs,
        orderbook,
        execute
    ),
    components(
        schemas(Version, Network, Status, SrzToken, SrzProtocolComponent, Orderbook, ExecutionRequest, PairTag)
    ),
    servers(
        (url = "/api", description = "Root API"),
        (url = "/api/ethereum", description = "Ethereum network"),
        (url = "/api/base", description = "Base network")
    ),
    tags(
        (name = "API", description = "Endpoints")
    )
)]
struct APIDoc;

pub fn wrap<T: serde::Serialize>(data: Option<T>, error: Option<String>) -> impl IntoResponse {
    match error {
        Some(err) => {
            let response = APIResponse::<String> {
                success: false,
                error: err.clone(),
                data: None,
                ts: current_timestamp(),
            };
            AxumJson(json!(response))
        }
        None => {
            let response = APIResponse {
                success: true,
                error: String::default(),
                data,
                ts: current_timestamp(),
            };
            AxumJson(json!(response))
        }
    }
}

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
async fn version(headers: HeaderMap, Extension(config): Extension<EnvAPIConfig>) -> impl IntoResponse {
    tracing::info!("👾 API: GET /version");
    let (allowed, msg) = validate_headers(&headers, config.web_api_key);
    if !allowed {
        return wrap(None, Some(msg));
    }
    wrap(Some(Version { version: "0.1.0".into() }), None)
}

// GET /network => Get network object and its configuration
#[utoipa::path(
    get,
    path = "/network",
    summary = "Network configuration",
    responses(
        (status = 200, description = "Network configuration", body = Vec<Network>)
    ),
    tag = (
        "API"
    )
)]
async fn networks(headers: HeaderMap, Extension(network): Extension<Vec<Network>>, Extension(config): Extension<EnvAPIConfig>) -> impl IntoResponse {
    tracing::info!("👾 API: GET /networks");
    let (allowed, msg) = validate_headers(&headers, config.web_api_key);
    if !allowed {
        return wrap(None, Some(msg));
    }
    wrap(Some(network.clone()), None)
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
async fn status(headers: HeaderMap, Extension(network): Extension<Network>, Extension(config): Extension<EnvAPIConfig>) -> impl IntoResponse {
    tracing::info!("👾 API: GET /status on {} network", network.name);
    let (allowed, msg) = validate_headers(&headers, config.web_api_key);
    if !allowed {
        return wrap(None, Some(msg));
    }
    match getters::status(network.clone()).await {
        Some(data) => wrap(Some(data), None),
        _ => wrap(None, Some("Failed to get status".to_string())),
    }
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
async fn tokens(headers: HeaderMap, Extension(network): Extension<Network>, Extension(config): Extension<EnvAPIConfig>) -> impl IntoResponse {
    tracing::info!("👾 API: GET /tokens on {} network", network.name);
    let (allowed, msg) = validate_headers(&headers, config.web_api_key);
    if !allowed {
        return wrap(None, Some(msg));
    }
    match getters::tokens(network.clone()).await {
        Some(tokens) => wrap(Some(tokens), None),
        _ => wrap(None, Some("Failed to get tokens".to_string())),
    }
}

// GET /pairs => Get all possible pairs
#[utoipa::path(
    get,
    path = "/pairs",
    summary = "Tycho pairs (0xETH-0xUSDC, with addresses), etc.",
    description = "Returns all pairs available on the network, based on the components (filtered)",
    responses(
        (status = 200, description = "Tycho Pairs", body = Vec<PairTag>)
    ),
    tag = (
        "API"
    )
)]
async fn pairs(headers: HeaderMap, Extension(network): Extension<Network>, Extension(config): Extension<EnvAPIConfig>) -> impl IntoResponse {
    tracing::info!("👾 API: GET /pairs on {} network", network.name);
    let (allowed, msg) = validate_headers(&headers, config.web_api_key);
    if !allowed {
        return wrap(None, Some(msg));
    }
    match getters::pairs(network).await {
        Some(pairs) => wrap(Some(pairs), None),
        _ => {
            let msg = "Failed to generate pair tags";
            wrap(None, Some(msg.to_string()))
        }
    }
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
async fn components(headers: HeaderMap, Extension(network): Extension<Network>, Extension(config): Extension<EnvAPIConfig>) -> impl IntoResponse {
    tracing::info!("👾 API: GET /components on {} network", network.name);
    let (allowed, msg) = validate_headers(&headers, config.web_api_key);
    if !allowed {
        return wrap(None, Some(msg));
    }
    match getters::components(network).await {
        Some(cps) => {
            tracing::debug!("Returning {} components", cps.len());
            wrap(Some(cps), None)
        }
        _ => {
            tracing::error!("Failed to get components");
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
        (status = 200, description = "The trade result", body = SrzExecutionPayload)
    ),
    tag = ("API")
)]
async fn execute(
    headers: HeaderMap,
    Extension(network): Extension<Network>,
    Extension(state): Extension<SharedTychoStreamState>,
    Extension(config): Extension<EnvAPIConfig>,
    AxumExJson(execution): AxumExJson<ExecutionRequest>,
) -> impl IntoResponse {
    tracing::info!("👾 API: {} : Querying execute endpoint: {:?}", network.name, execution);
    if let Some(e) = prevalidation(network.clone(), headers.clone(), true, config.web_api_key).await {
        return wrap(None, Some(e));
    }
    // Get the original components from the state
    let mtx = state.read().await;
    let originals = mtx.components.clone();
    drop(mtx);
    let originals = exec::get_original_components(originals, execution.components.clone());

    match exec::build(network.clone(), execution.clone(), originals, None).await {
        Ok(result) => {
            let srz = SrzExecutionPayload {
                swap: SrzTransactionRequest::from(result.swap.clone()),
                approve: SrzTransactionRequest::from(result.approve.clone()),
            };
            wrap(Some(srz), None)
        }
        Err(e) => {
            let error = e.to_string();
            wrap(None, Some(error))
        }
    }
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
    Extension(config): Extension<EnvAPIConfig>,
    AxumExJson(params): AxumExJson<OrderbookRequestParams>,
) -> impl IntoResponse {
    let single = params.point.is_some();
    tracing::info!("👾 API: {} : OrderbookRequestParams: {:?} | Single: {}", network.name, params, single);
    let mtx = shtss.read().await;
    let initialised = mtx.initialised;
    drop(mtx);
    if let Some(e) = prevalidation(network.clone(), headers.clone(), initialised, config.web_api_key).await {
        return wrap(None, Some(e));
    }
    match (getters::tokens(network.clone()).await, getters::components(network.clone()).await) {
        (Some(atks), Some(acps)) => {
            let target = params.tag.clone();
            let targets = target.split("-").map(|x| x.to_string().to_lowercase()).collect::<Vec<String>>();
            let srzt0 = atks.iter().find(|x| x.address.to_lowercase() == targets[0].clone().to_lowercase());
            let srzt1 = atks.iter().find(|x| x.address.to_lowercase() == targets[1].clone().to_lowercase());
            if srzt0.is_none() {
                let msg = "Couldn't find tokens[0]".to_string();
                tracing::error!("{}", msg.clone());
                return wrap(None, Some(msg.to_string()));
            } else if srzt1.is_none() {
                let msg = "Couldn't find tokens[1]".to_string();
                tracing::error!("{}", msg.clone());
                return wrap(None, Some(msg.to_string()));
            }
            let srzt0 = srzt0.unwrap();
            let srzt1 = srzt1.unwrap();
            let targets = vec![srzt0.clone(), srzt1.clone()];
            let (base_to_eth_path, base_to_eth_comps) = maths::path::routing(acps.clone(), srzt0.address.to_string().to_lowercase(), network.eth.to_lowercase()).unwrap_or_default();
            let (quote_to_eth_path, quote_to_eth_comps) = maths::path::routing(acps.clone(), srzt1.address.to_string().to_lowercase(), network.eth.to_lowercase()).unwrap_or_default();
            // tracing::info!("Path from {} to network.ETH is {:?}", srzt0.symbol, base_to_eth_path);
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
                                tracing::error!("matchcp: couldn't find protosim for component {}", cp.id);
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
                                tracing::error!("contains: couldn't find protosim for component {}", cp.id);
                            }
                        }
                        drop(mtx);
                    }
                }

                if ptss.is_empty() {
                    let tag = format!("{}-{}", srzt0.symbol.to_lowercase(), srzt1.symbol.to_lowercase());
                    let msg = format!("ProtoTychoState: pair {} requested has 0 associated pools and multi-hop is not enabled yet.", tag);
                    return wrap(None, Some(msg));
                }

                if !single {
                    if let Some(cache_obk) = shared::helpers::verify_obcache(network.clone(), acps.clone(), params.tag.clone()).await {
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
                            tracing::info!("Saving orderbook to Redis cache with key: {}", key);
                            shared::data::set(key.as_str(), result.clone()).await;
                        }
                        wrap(Some(result), None)
                    }
                    _ => {
                        let msg = format!("Couldn't find the quote path from {} to ETH", srzt0.symbol);
                        tracing::error!("{}", msg);
                        wrap(None, Some(msg))
                    }
                }
            } else {
                let msg = format!(
                    "Couldn't find the pair of tokens for tag {} - Query param Tag must contain only 2 tokens separated by a dash '-'",
                    target
                );
                tracing::error!("{}", msg);
                wrap(None, Some(msg))
            }
        }
        _ => {
            let msg = "Couldn't not read internal components";
            tracing::error!("{}", msg);
            wrap(None, Some(msg.to_string()))
        }
    }
}

pub async fn start(nets: Vec<Network>, shared: crate::Cache, config: EnvAPIConfig) {
    let port = config.api_port.parse::<u16>().unwrap_or(42042);
    let names = nets.clone().iter().map(|n| n.name.clone()).collect::<Vec<String>>();
    tracing::info!("👾 Launching API for '{:?}' network | 🧪 Testing mode: {:?} | Port: {}", names, config.testing, port);
    // --- CORS ---
    let _cors = match config.testing {
        true => {
            tracing::debug!("Testing mode enabled, CORS disabled");
            CorsLayer::new().allow_origin(Any).allow_methods([http::Method::GET, http::Method::POST]).allow_headers(Any)
        }
        false => {
            tracing::debug!("Testing mode disabled, CORS enabled on {}", config.origin);
            CorsLayer::new()
                // "https://x.vercel.app"
                .allow_origin(config.origin.parse::<HeaderValue>().unwrap())
                .allow_methods([http::Method::GET, http::Method::POST])
                .allow_headers(Any)
            // .allow_headers([http::header::CONTENT_TYPE])
        }
    };
    // --- Main router ---
    let mut main = Router::new()
        .route("/", get(root))
        .route("/version", get(version))
        .route("/networks", get(networks))
        .layer(Extension(config.clone()))
        .layer(Extension(nets.clone()));

    // --- Network router ---
    for network in nets.clone().iter() {
        let prefix = format!("/{}", network.name);
        let state = {
            let map = shared.read().await;
            map.get(&network.name).cloned().expect("Missing state for network")
        };
        let netr = Router::new()
            // Network-specific routes (e.g. components, pairs, etc.)
            .route("/status", get(status))
            .route("/tokens", get(tokens))
            .route("/components", get(components))
            .route("/pairs", get(pairs))
            .route("/orderbook", post(orderbook))
            .route("/execute", post(execute))
            .layer(Extension(network.clone()))
            .layer(Extension(state))
            .layer(Extension(config.clone()));
        // Nest each network router under its prefix
        main = main.nest(&prefix, netr);
    }
    // --- Merge routers ---
    let app = Router::new().nest("/api", main).merge(SwaggerUi::new("/swagger").url("/api-docs/openapi.json", APIDoc::openapi()));

    // --- Start the server ---
    match tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await {
        Ok(listener) => match axum::serve(listener, app).await {
            Ok(_) => {
                tracing::info!("(tracings never displayed in theory): API for '{:?}' nets is running on port {}", names, port);
            }
            Err(e) => {
                tracing::error!("Failed to start API for '{:?}' network: {}", names, e);
            }
        },
        Err(e) => {
            tracing::error!("Failed to bind to port {}: {}", port, e);
        }
    }
}
