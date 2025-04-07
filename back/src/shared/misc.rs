use serde::{de::DeserializeOwned, Serialize};
use std::{
    fs::{File, OpenOptions},
    io::{Read, Write},
};

use crate::types::EnvAPIConfig;

// Temporary static variables for testing
pub mod r#static {
    pub static HEADER_TYCHO_API_KEY: &str = "tycho-orderbook-web-api-key";
    pub static TMP_HD_VALUE: &str = "42";
    pub static HEARTBEAT_DELAY: u64 = 900;
}

/**
 * Read a file and return a Vec<T> where T is a deserializable type
 */
pub fn read<T: DeserializeOwned>(file: &str) -> Vec<T> {
    let mut f = File::open(file).unwrap();
    let mut buffer = String::new();
    f.read_to_string(&mut buffer).unwrap();
    let db: Vec<T> = serde_json::from_str(&buffer).unwrap();
    db
}

/**
 * Write output to file
 */
pub fn save<T: Serialize>(output: Vec<T>, file: &str) {
    let mut file = OpenOptions::new().create(true).write(true).truncate(true).open(file).expect("Failed to open or create file");
    let json = serde_json::to_string(&output).expect("Failed to serialize JSON");
    file.write_all(json.as_bytes()).expect("Failed to write to file");
    file.write_all(b"\n").expect("Failed to write newline to file");
    file.flush().expect("Failed to flush file");
}

/**
 * Write output to file
 */
pub fn save1<T: Serialize>(output: T, file: &str) {
    let mut file = OpenOptions::new().create(true).write(true).truncate(true).open(file).expect("Failed to open or create file");
    let json = serde_json::to_string(&output).expect("Failed to serialize JSON");
    file.write_all(json.as_bytes()).expect("Failed to write to file");
    file.write_all(b"\n").expect("Failed to write newline to file");
    file.flush().expect("Failed to flush file");
}

/**
 * Get an environment variable
 */
pub fn get(key: &str) -> String {
    match std::env::var(key) {
        Ok(x) => x,
        Err(_) => {
            panic!("Environment variable not found: {}", key);
        }
    }
}

/**
 * Default implementation for Env
 */
impl Default for EnvAPIConfig {
    fn default() -> Self {
        Self::new()
    }
}

impl EnvAPIConfig {
    /**
     * Create a new EnvAPIConfig
     */
    pub fn new() -> Self {
        let networks: Vec<String> = get("NETWORKS").to_lowercase().split(",").map(|s| s.to_string()).collect();
        let heartbeats: Vec<String> = get("HEARTBEATS").to_string().split(",").map(|s| s.to_string()).collect();
        EnvAPIConfig {
            networks: networks.clone(),
            heartbeats: heartbeats.clone(),
            origin: get("ORIGIN"),
            testing: get("TESTING") == "true",
            tycho_api_key: get("TYCHO_API_KEY"),
            web_api_key: get("WEB_API_KEY"),
            api_port: get("API_PORT"),
        }
    }
}

/// Temporary variables for testing
pub fn top_pairs() -> Vec<String> {
    vec![
        "DAI-WETH".to_string(),
        "DOGE-WETH".to_string(),
        "WBTC-WETH".to_string(),
        "PEPE-WETH".to_string(),
        "USDC-WETH".to_string(),
        "AAVE-WETH".to_string(),
        "UNI-WETH".to_string(),
        "DAI-USDC".to_string(),
        "DAI-USDT".to_string(),
        "AAVE-WETH".to_string(),
        "LINK-WETH".to_string(),
        "WBTC-USDC".to_string(),
        "WBTC-USDT".to_string(),
        "DAI-FRAX".to_string(),
    ]
}
