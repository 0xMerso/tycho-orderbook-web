# FROM rust:slim
# RUN apt-get update && apt-get install -y libssl-dev pkg-config
# RUN apt-get update && apt-get install -y curl
# # RUN cargo install cargo-watch
# WORKDIR /app
# COPY . .
# # Remove the local patch override file
# RUN rm -f .cargo/config.toml
# RUN cargo build --bin stream
# CMD ["cargo", "run", "--bin", "stream"]

# Dockerfile version with parent folder as workspace in Compose
# Used because we need local crate for the SDK, because cannot push to crates.io for now.
FROM rust:slim
RUN apt-get update && apt-get install -y libssl-dev pkg-config curl
RUN cargo install cargo-watch
WORKDIR /app
# Copy the back directory
COPY tycho-orderbook-web/back /app
# Copy the local crate
COPY tycho-orderbook-sdk /tycho-orderbook-sdk
# Remove the local patch override file
RUN rm -f .cargo/config.toml
RUN cargo build --bin stream
CMD ["cargo", "run", "--bin", "stream"]