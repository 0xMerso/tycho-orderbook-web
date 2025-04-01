use tycho_orderbook::{
    data::fmt::{SrzProtocolComponent, SrzToken},
    types::Network,
    utils::r#static::data::keys,
};

use crate::types::Status;

/// Get components for a given network
pub async fn components(network: Network) -> Option<Vec<SrzProtocolComponent>> {
    let key = keys::stream::components(network.name.clone());
    crate::data::get::<Vec<SrzProtocolComponent>>(key.as_str()).await
}

/// Get tokens for a given network
pub async fn tokens(network: Network) -> Option<Vec<SrzToken>> {
    let key = keys::stream::tokens(network.name.clone());
    crate::data::get::<Vec<SrzToken>>(key.as_str()).await
}

/// Get status of the API
pub async fn status(network: Network) -> Option<Status> {
    let key1 = keys::stream::tycho(network.name.clone());
    let key2 = keys::stream::latest(network.name.clone());
    let stream = crate::data::get::<u128>(key1.as_str()).await;
    let latest = crate::data::get::<u64>(key2.as_str()).await;
    match (stream, latest) {
        (Some(stream), Some(latest)) => Some(Status { stream, latest: latest.to_string() }),
        _ => None,
    }
}
