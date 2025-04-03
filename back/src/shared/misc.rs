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
        EnvAPIConfig {
            testing: get("TESTING") == "true",
            tycho_api_key: get("TYCHO_API_KEY"),
            network: get("NETWORK"),
        }
    }
}
