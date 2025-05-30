#!/bin/bash

# Usage: export API_HOST=<API_HOST> && export LOG=true && ./tests/api.test.sh <network>

set -e

network=$1

if [ -z "$network" ]; then
    echo "Usage: $0 <network>"
    exit 1
fi

if [ "$network" = "ethereum" ]; then
    echo "Testing on Mainnet"
    export eth="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    export usdc="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    export wbtc="0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"
    export dai="0x6b175474e89094c44da98b954eedeac495271d0f"
    export usdt="0xdac17f958d2ee523a2206206994597c13d831ec7"
elif [ "$network" = "base" ]; then
    echo "Testing on Base"
    export eth="0x4200000000000000000000000000000000000006"
    export usdc="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
    export wbtc="0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf"
    export dai="0x50c5725949a6f0c72e6c4a641f24049a917db0cb"
    export usdt="0xfde4c96c8593536e31f229ea8f37b2ada2699bb2"
elif [ "$network" = "unichain" ]; then
    export eth="0x4200000000000000000000000000000000000006"
    export usdc="0x078D782b760474a361dDA0AF3839290b0EF57AD6"
else
    echo "Invalid network: $network"
    exit 1
fi

# export LOG=true ; export API_HOST="https://tycho.merso.xyz" ; sh ops/local.api.test.sh ethereum

API_HOST=${API_HOST:-"http://127.0.0.1:42042"}
LOG=${LOG:-true}
API_URL="$API_HOST/api"
echo "Testing API at $API_URL"

HDK="tycho-orderbook-web-api-key"
HDV="42"

try() {
    local description="$1"
    local url="$2"
    local body="$3"
    # Set method to POST if a body is provided, otherwise GET.
    local method="GET"
    [ -n "$body" ] && method="POST"

    echo "Testing $description"
    echo "cURL: $url"

    local status=""
    if [ "$LOG" = "true" ]; then
        local response
        if [ "$method" = "POST" ]; then
            response=$(
                curl -s -w "\n%{http_code}" -X POST -H "$HDK: $HDV" "$url" -H "Content-Type: application/json" -d "$body"
            )
        else
            response=$(curl -s -w "\n%{http_code}" -X GET -H "$HDK: $HDV" "$url")
        fi
        # Extract the status code from the last line.
        status=$(echo "$response" | tail -n1)
        # The rest is the response body.
        local response_body=$(echo "$response" | sed '$d')
        echo "$response_body" | jq .
    else
        if [ "$method" = "POST" ]; then
            status=$(curl -o /dev/null -s -X POST -H "$HDK: $HDV" "$url" -H "Content-Type: application/json" -d "$body" -w "%{http_code}")
        else
            status=$(curl -o /dev/null -s -X GET -H "$HDK: $HDV" "$url" -w "%{http_code}")
        fi
    fi

    if [ "$status" -eq 200 ]; then
        echo "Status: 200 OK"
    else
        echo "Status: $status (Error)"
    fi
    echo "--- --- --- --- ---"
}

# Test endpoints that do not require a network
try "GET /" "$API_URL"
try "GET /version" "$API_URL/version"
try "GET /networks" "$API_URL/networks"

# Test endpoints that require a network
try "GET /$network/status" "$API_URL/$network/status"
try "GET /$network/tokens" "$API_URL/$network/tokens"
try "GET /$network/components" "$API_URL/$network/components"
try "GET /$network/pairs" "$API_URL/$network/pairs"

# Test simulations
try "POST /$network/orderbook (simple)" "$API_URL/$network/orderbook" '{"tag": "'"$eth-$usdc"'"}'
# try "POST /$network/orderbook (simple)" "$API_URL/$network/orderbook" '{"tag": "'"$eth-$wbtc"'"}'
# try "POST /$network/orderbook (simple)" "$API_URL/$network/orderbook" '{"tag": "'"$eth-$dai"'"}'
# try "POST /$network/orderbook (simple)" "$API_URL/$network/orderbook" '{"tag": "'"$eth-$usdt"'"}'
# try "POST /$network/orderbook (simple)" "$API_URL/$network/orderbook" '{"tag": "'"$usdc-$wbtc"'"}'
try "POST /$network/orderbook (simple)" "$API_URL/$network/orderbook" '{"tag": "'"$usdc-$dai"'"}'
try "POST /$network/orderbook (simple)" "$API_URL/$network/orderbook" '{"tag": "'"$usdc-$usdt"'"}'
# try "POST /$network/orderbook (simple)" "$API_URL/$network/orderbook" '{"tag": "'"$wbtc-$dai"'"}'
# try "POST /$network/orderbook (simple)" "$API_URL/$network/orderbook" '{"tag": "'"$wbtc-$usdt"'"}'

try "POST /$network/orderbook (with point)" "$API_URL/$network/orderbook" '{"tag": "'"$eth-$usdc"'", "point": {"input": "'"$eth"'", "amount": 100}}'
try "POST /$network/orderbook (with point)" "$API_URL/$network/orderbook" '{"tag": "'"$eth-$usdc"'", "point": {"input": "'"$usdc"'", "amount": 1000}}'
try "POST /$network/orderbook (with point)" "$API_URL/$network/orderbook" '{"tag": "'"$eth-$wbtc"'", "point": {"input": "'"$eth"'", "amount": 100}}'
try "POST /$network/orderbook (with point)" "$API_URL/$network/orderbook" '{"tag": "'"$eth-$dai"'", "point": {"input": "'"$eth"'", "amount": 1000}}'
# try "POST /$network/orderbook (with point)" "$API_URL/$network/orderbook" '{"tag": "'"$eth-$usdt"'", "point": {"input": "'"$eth"'", "amount": 100}}'
# try "POST /$network/orderbook (with point)" "$API_URL/$network/orderbook" '{"tag": "'"$usdc-$wbtc"'", "point": {"input": "'"$usdc"'", "amount": 1000}}'
# try "POST /$network/orderbook (with point)" "$API_URL/$network/orderbook" '{"tag": "'"$usdc-$dai"'", "point": {"input": "'"$usdc"'", "amount": 100}}'
# try "POST /$network/orderbook (with point)" "$API_URL/$network/orderbook" '{"tag": "'"$usdc-$usdt"'", "point": {"input": "'"$usdc"'", "amount": 1000}}'
# try "POST /$network/orderbook (with point)" "$API_URL/$network/orderbook" '{"tag": "'"$wbtc-$dai"'", "point": {"input": "'"$wbtc"'", "amount": 1}}'
# try "POST /$network/orderbook (with point)" "$API_URL/$network/orderbook" '{"tag": "'"$wbtc-$usdt"'", "point": {"input": "'"$wbtc"'", "amount": 1}}'

# usdp="0x8e870d67f660d95d5be530380d0ec0bd388289e1" # Trying when no orderbook available
# try "POST /orderbook (simple)" "$API_URL/$network/orderbook" '{"tag": "'"$eth-$usdp"'"}'

# LOG=true && API_HOST=https://tycho-dev-orderbook.propellerheads.xyz sh ops/local.api.test.sh ethereum
