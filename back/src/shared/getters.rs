use tycho_orderbook::{
    data::{
        self,
        fmt::{SrzProtocolComponent, SrzToken},
    },
    types::{Network, Status},
    utils::r#static::data::keys,
};

/// Get components for a given network
pub async fn components(network: Network) -> Option<Vec<SrzProtocolComponent>> {
    let key = keys::stream::components(network.name.clone());
    data::redis::get::<Vec<SrzProtocolComponent>>(key.as_str()).await
}

/// Get tokens for a given network
pub async fn tokens(network: Network) -> Option<Vec<SrzToken>> {
    let key = keys::stream::tokens(network.name.clone());
    data::redis::get::<Vec<SrzToken>>(key.as_str()).await
}

/// Get status of the API
pub async fn status(network: Network) -> Option<Status> {
    let key1 = keys::stream::tycho(network.name.clone());
    let key2 = keys::stream::latest(network.name.clone());
    let stream = data::redis::get::<u128>(key1.as_str()).await;
    let latest = data::redis::get::<u64>(key2.as_str()).await;
    match (stream, latest) {
        (Some(stream), Some(latest)) => Some(Status { stream, latest: latest.to_string() }),
        _ => None,
    }
}
