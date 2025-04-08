#!/bin/bash

# For dev purposes, to update the app

echo "Getting submodules ..."
git pull --recurse-submodules
git submodule update --remote --recursive
docker compose stop
docker compose up --build -d
