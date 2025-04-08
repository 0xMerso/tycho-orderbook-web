#!/bin/bash
# Create dedicated network used in docker compose
docker network create tycho
docker compose up --build -d
