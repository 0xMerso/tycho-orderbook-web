
# tycho-orderbook-web

This repository contains the architecture to run [orderbook.wtf](https://orderbook.wtf) infra, with the Rust SDK **tycho-orderbook** and a NextJS front (as submodules).

Together, they're used to visualize the onchain liquidity of AMMs in a familiar orderbook format, thanks to [Tycho](https://docs.propellerheads.xyz/tycho).  

You can run the architecture with the given script, after cloning this repo.

    git clone --recurse-submodules https://github.com/0xMerso/tycho-orderbook-web web
    sh launch.sh

Get started quickly with the [documentation](https://tycho-orderbook.gitbook.io/docs).  