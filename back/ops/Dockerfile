FROM rust:slim

# Install required dependencies in one command
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libssl-dev pkg-config curl git build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set a workspace directory
WORKDIR /workspace

RUN echo $(ls -1 /tmp/dir)

# Copy local projects into container maintaining the relative structure
COPY back ./back
COPY sdk ./sdk

# Optional: Print directory and file details for debugging
RUN ls -la /workspace && \
    ls -la /workspace/sdk && \
    cat /workspace/back/Cargo.toml && \
    cat /workspace/sdk/Cargo.toml

# Change working directory to 'back' so that Cargo.toml’s relative path works as expected (../sdk)
WORKDIR /workspace/back
RUN echo $(ls -1 /tmp/dir)

# Remove any local patch override file if present
RUN rm -f .cargo/config.toml

# Accept build arguments for build type and program name
ARG BUILD_TYPE=release
ARG PROGRAM=stream
ENV BUILD_TYPE=${BUILD_TYPE}
ENV PROGRAM=${PROGRAM}
RUN echo "Binary: $PROGRAM, Build type: $BUILD_TYPE"

# Build the program based on BUILD_TYPE
RUN if [ "$BUILD_TYPE" = "release" ]; then \
    cargo build --release --bin $PROGRAM; \
    else \
    cargo build --bin $PROGRAM; \
    fi

# Set entrypoint to run the built binary
CMD [ "bash", "-c", "if [ \"$BUILD_TYPE\" = \"release\" ]; then exec ./target/release/$PROGRAM; else exec ./target/debug/$PROGRAM; fi" ]