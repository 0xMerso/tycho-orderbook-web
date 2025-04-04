
# tycho-orderbook-web

This repository contains a backend with the package **tycho-orderbook** and a frontend, used to visualize the onchain liquidity of AMMs in a familiar orderbook format, thanks to [Tycho](https://docs.propellerheads.xyz/tycho).  

The public version of tycho-orderbook is limited in its ability to handle all orderbook requests and update them dynamically.  
To solve this, and to allow more flexibility, we provide an open-source Next JS frontend, and a Rust API with it (Axum).  
Executed locally, it allows unrestricted calculations and customization.  

Get a visual architecture of the repository on [Gitdiagram](https://gitdiagram.com/0xMerso/tycho-orderbook-web)  

Get started quickly with the [documentation](https://tycho-orderbook.gitbook.io/docs).  