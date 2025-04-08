# Dockerfile version with parent folder as workspace in Compose
# Used because we need local crate for the SDK, because cannot push to crates.io for now.
FROM rust:slim
# Install required dependencies
RUN apt-get update && apt-get install -y libssl-dev pkg-config curl
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*
# Optional: install cargo-watch for development convenience
# RUN cargo install cargo-watch
WORKDIR /app


# Copy the application code
# COPY tycho-orderbook-web/back /app
# COPY tycho-orderbook-sdk /tycho-orderbook-sdk
COPY back /app
COPY sdk /tycho-orderbook-sdk


# Remove any local patch override file
RUN rm -f .cargo/config.toml
# Accept build arguments for build type and program name; set defaults
ARG BUILD_TYPE=release
ARG PROGRAM=stream
# Make them available as environment variables at runtime
ENV BUILD_TYPE=${BUILD_TYPE}
ENV PROGRAM=${PROGRAM}
RUN echo "Binary: $PROGRAM, Build type: $BUILD_TYPE" 
RUN if [ "$BUILD_TYPE" = "release" ]; then \
    echo "---- Release target directory listing ----" && ls ./target/release; \
    else \
    echo "---- Debug target directory listing ----" && ls ./target/debug; \
    fi
# Build the program based on BUILD_TYPE
RUN if [ "$BUILD_TYPE" = "release" ]; then \
    cargo build --release --bin $PROGRAM; \
    else \
    cargo build --bin $PROGRAM; \
    fi
# Debug KO
# RUN pwd > /tmp/output.txt && cat /tmp/output.txt
# RUN ls -la .. > /tmp/output.txt && cat /tmp/output.txt
# RUN ls -la > /tmp/output.txt && cat /tmp/output.txt
# Set the CMD to run the appropriate binary based on BUILD_TYPE and PROGRAM
CMD [ "bash", "-c", "if [ \"$BUILD_TYPE\" = \"release\" ]; then exec ./target/release/$PROGRAM; else exec ./target/debug/$PROGRAM; fi" ]