# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Rust backend API service that provides orderbook data from AMMs using the Tycho protocol. The service connects to blockchain networks and transforms on-chain liquidity into orderbook format for trading interfaces.

## Build and Development Commands

### Build the project
```bash
cargo build --bin stream
```

### Run the service locally with Redis
```bash
sh ops/local.api.start.sh
```
This script:
- Starts Redis on port 42777
- Builds and runs the stream binary
- Sets up proper logging with RUST_LOG environment variable

### Run tests
```bash
# Test the API endpoints for a specific network
export API_HOST="http://127.0.0.1:42042"
sh ops/local.api.test.sh ethereum  # or base, unichain
```

### Code quality and linting
```bash
# Run comprehensive linting and formatting
sh clean.sh
```
This runs:
- `cargo clippy` with auto-fix
- `cargo check`
- `cargo fmt` (with nightly)
- Clippy with all warnings as errors

### Individual checks
```bash
cargo check --all
cargo clippy --workspace --all-features --all-targets
cargo fmt
```

## Architecture

### Core Components

1. **Stream Module** (`src/stream.rs`)
   - Main entry point for the streaming service
   - Connects to Tycho protocol via OrderbookBuilder
   - Manages network connections and data streaming
   - Handles reconnection logic with configurable delays

2. **Axum API** (`src/axum.rs`)
   - REST API server using Axum framework
   - OpenAPI/Swagger documentation via utoipa
   - Endpoints for:
     - Network status and information
     - Token and component listings
     - Orderbook data retrieval
     - Transaction execution simulation

3. **Shared Library** (`src/shared/`)
   - `data.rs`: Redis data layer for caching
   - `getters.rs`: Data retrieval utilities
   - `helpers.rs`: Request validation and utilities
   - `types.rs`: Common type definitions
   - `misc.rs`: Static configurations and constants

### Key Dependencies

- **tycho-orderbook**: Local SDK for orderbook operations (path: `../sdk`)
- **tycho-simulation**: External simulation library from GitHub
- **axum**: Web framework for the REST API
- **redis**: Caching layer (port 42777 in development)
- **alloy**: Ethereum interaction library

### Network Support

The service supports multiple blockchain networks:
- Ethereum (mainnet)
- Base
- Unichain

Each network has specific token addresses configured in test scripts.

### API Structure

Base URL: `/api/{network}/`

Key endpoints:
- `GET /version` - API version
- `GET /networks` - List supported networks
- `GET /{network}/status` - Network stream status
- `GET /{network}/tokens` - Available tokens
- `GET /{network}/components` - Protocol components
- `GET /{network}/pairs` - Trading pairs
- `POST /{network}/orderbook` - Get orderbook for a pair
- `POST /{network}/execute` - Simulate transaction execution

### Environment Configuration

Required environment variables:
- `RUST_LOG`: Logging configuration (e.g., `stream=trace,shared=trace`)
- API authentication uses custom headers:
  - Header key: `tycho-orderbook-web-api-key`
  - Header value: `42` (for local development)

### Redis Usage

The service uses Redis for caching:
- Default port: 42777 (local development)
- Used for storing stream state, tokens, components, and pairs data
- Keys follow pattern: `stream:{network}:{datatype}`

## Important Notes

- The service requires a running Redis instance
- Stream connections automatically retry on failure with configurable delays
- All API responses are wrapped in a standard format with success/error status
- The service uses Tycho protocol for real-time blockchain data streaming