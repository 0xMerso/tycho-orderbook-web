# tycho-orderbook-web

This repository contains the architecture to run [orderbook.wtf](https://orderbook.wtf) infra, with the Rust SDK **tycho-orderbook** and a NextJS front (as submodules).

Together, they're used to visualize the onchain liquidity of AMMs in a familiar orderbook format, thanks to [Tycho](https://docs.propellerheads.xyz/tycho).

You can run the architecture with the given script, after cloning this repo.

    git clone --recurse-submodules https://github.com/0xMerso/tycho-orderbook-web web
    sh launch.sh

Get started quickly with the [documentation](https://tycho-orderbook.gitbook.io/docs) or as below.

If you prefer to build and run the application directly, we provide shell scripts for simple startup.
You will need to install Rust, Node, Redis.

```bash
git clone --recurse-submodules https://github.com/0xMerso/tycho-orderbook-web web
cd web
git submodule update --remote --recursive # Update the submodules to the latest version.
```

```bash
# Run the backend server
cp -n back/.env.ex back/.env # Duplicate .env.ex to .env, if not already existing (.env is gitignored)
cd back
# Launch 'ethereum' Axum API + Redis. You can use 'base' instead
sh ops/local.api.start.sh ethereum
# Tests
sh ops/local.api.test.sh ethereum
```

```bash
# Run the frontend
cd front/front
pnpm install
pnpm dev
```
