use std::fmt::{self, Display};

use serde::{Deserialize, Serialize};
use tycho_orderbook::types::ExecutionRequest;
use utoipa::ToSchema;

/// Used to safely progress with Redis database
#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum StreamState {
    Down = 1,
    Launching = 2,
    Syncing = 3,
    Running = 4,
    Error = 5,
}

impl Display for StreamState {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match *self {
            StreamState::Down => write!(f, "Down"),
            StreamState::Launching => write!(f, "Launching"),
            StreamState::Syncing => write!(f, "Syncing"),
            StreamState::Running => write!(f, "Running"),
            StreamState::Error => write!(f, "Error"),
        }
    }
}

/// Execution context, used to simulate a trade
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ExecutionContext {
    pub router: String,
    pub sender: String,
    pub fork: bool,
    pub request: ExecutionRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct APIResponse<T = String> {
    pub success: bool,
    pub error: String,
    pub ts: u64,
    pub data: Option<T>,
}

#[derive(Serialize, Deserialize, ToSchema)]
pub struct Status {
    #[schema(example = "4")]
    pub stream: u128, // StreamState
    #[schema(example = "22051447")]
    pub latest: String,
}

// A simple structure for the API version.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct Version {
    #[schema(example = "0.1.0")]
    pub version: String,
}

// A simple structure for the API version.
#[derive(Serialize, Deserialize, ToSchema)]
pub struct PairTag {
    #[schema(example = "ETH")]
    pub base: String,
    #[schema(example = "USDC")]
    pub quote: String,
    #[schema(example = "0xETH")]
    pub addrbase: String,
    #[schema(example = "0xUSDC")]
    pub addrquote: String,
}

/// Environment configuration expected
#[derive(Debug, Clone)]
pub struct EnvAPIConfig {
    // True if testing mode, simplify some operations
    pub testing: bool,
    // API key for Tycho, faster synchronization
    pub tycho_api_key: String,
    // Network names, comma separated => "ethereum,base"
    pub networks: Vec<String>,
    // Network names, comma separated => "ethereum,base"
    pub heartbeats: Vec<String>,
    // Origin, for CORS
    pub origin: String,
    // Header API key for tycho-web
    pub web_api_key: String,
    // Header API key for tycho-web
    pub api_port: String,
}
