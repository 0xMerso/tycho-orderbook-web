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

# Install required dependencies
RUN apt-get update && apt-get install -y libssl-dev pkg-config curl

# Optional: install cargo-watch for development convenience
RUN cargo install cargo-watch

WORKDIR /app

# Copy the application code
COPY tycho-orderbook-web/back /app
COPY tycho-orderbook-sdk /tycho-orderbook-sdk

# Remove any local patch override file
RUN rm -f .cargo/config.toml

# Accept build arguments for build type and program name; set defaults
ARG BUILD_TYPE=release
ARG PROGRAM=stream

# Make them available as environment variables at runtime
ENV BUILD_TYPE=${BUILD_TYPE}
ENV PROGRAM=${PROGRAM}

# Build the program based on BUILD_TYPE
RUN if [ "$BUILD_TYPE" = "release" ]; then \
    cargo build --release --bin $PROGRAM; \
    else \
    cargo build --bin $PROGRAM; \
    fi

# Set the CMD to run the appropriate binary based on BUILD_TYPE and PROGRAM
CMD [ "sh", "-c", "if [ \"$BUILD_TYPE\" = \"release\" ]; then ./target/release/$PROGRAM; else ./target/debug/$PROGRAM; fi" ]

# --- DEBUG ---
# FROM rust:slim
# RUN apt-get update && apt-get install -y libssl-dev pkg-config curl
# RUN cargo install cargo-watch
# WORKDIR /app
# # Copy the back directory
# COPY tycho-orderbook-web/back /app
# # Copy the local crate
# COPY tycho-orderbook-sdk /tycho-orderbook-sdk
# # Remove the local patch override file
# RUN rm -f .cargo/config.toml
# RUN cargo build --bin stream
# CMD ["cargo", "run", "--bin", "stream"]