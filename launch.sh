#!/bin/bash

# After cloning the repository web like this
# git clone --recurse-submodules https://github.com/0xMerso/tycho-orderbook-web web

# You can execute the current script, to run the docker compose
# It will build the SDK (not published yet on crates.io), the API and the NextJS frontend port 3000

# Get submodules (sdk and frontend)
echo "Getting submodules ..."
git pull --recurse-submodules
git submodule update --remote --recursive

cp -n back/.env.ex back/.env # Duplicate .env.ex to .env, if not already existing (.env is gitignored)

# Create dedicated network used in docker compose
echo "Creating docker network 'tycho' ..."
docker network create tycho
# Verify Docker Compose
docker compose config
# Run
docker compose up --build -d

# ------------------ Utils ---------------------
# To stop the compose, you can use the following command
# docker compose down
# To remove the submodules
# git submodule deinit -f path/to/submodule && git rm -f path/to/submodule && rm -rf .git/modules/path/to/submodule
# export submodule=front
# git submodule deinit -f $submodule && git rm -f $submodule && rm -rf .git/modules/$submodule
