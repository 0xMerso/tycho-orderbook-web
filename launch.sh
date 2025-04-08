#!/bin/bash

# After cloning the repository 'git@github.com:0xMerso/tycho-orderbook-sdk.git'
# You can execute the current script, to run the docker compose
# It will build the SDK (not published yet on crates.io), the API and the NextJS frontend port 3000

# Get submodules (sdk and frontend)
echo "Getting submodules ..."
git pull --recurse-submodules
git submodule update --remote --recursive
# git submodule update --init --recursive

# Create dedicated network used in docker compose
echo "Creating docker network 'tycho' ..."
docker network create tycho

# Verify Docker Compose
docker compose config

# Run
# docker compose up --build -d
# echo "Compose  built. Following logs ..."
# docker compose logs -f

# To stop the compose, you can use the following command
# docker compose down
