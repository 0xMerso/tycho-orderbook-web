#!/bin/bash

# For dev purposes, to update the app

echo "Getting submodules ..."
# git pull --recurse-submodules
# git submodule update --remote --recursive
cd sdk
git pull origin mai
cd ../front
git pull origin main
cd ..

docker compose stop
docker compose up --build -d
