
# tycho-orderbook-web

tycho-orderbook-web is a public application using **tycho-orderbook** Rust crate to visualize the onchain liquidity of AMMs in a familiar orderbook format, thanks to [Tycho](https://docs.propellerheads.xyz/tycho).  
See [tycho-orderbook](https://github.com/0xMerso/tycho-orderbook).  

The public version of tycho-orderbook is limited in its ability to handle all orderbook requests and update them dynamically.
To solve this, and to allow more flexibility, we provide an open-source Next JS frontend, and a Rust API with it (Axum).
The public website has not yet been launched.

This repository contains the API using tycho-orderbook crate and a NextJS website (submodule) connected to the API.  
Executed locally, it allows unrestricted calculations and customization.

We're looking for contributors, so don't hesitate to open issues, do PR and contact us.  

You'll find all the documentation you need to run this app [here](https://0xmerso.github.io/tycho-orderbook-docs/frontend.html)

The repo has the front part as a submodule, so to clone it, do :

    git clone --recurse-submodules tycho-orderbook-web

Then, to run the application in one command :

    docker-compose up --build -d

Enjoy the experience !

