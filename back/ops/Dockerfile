FROM rust:slim
# Install required dependencies
RUN apt-get update && apt-get install -y libssl-dev pkg-config curl git && rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git \
    build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
# Copy both directories preserving the relative structure
COPY back ./back
COPY sdk ./sdk

COPY sdk /workspace/sdk

# Change working directory to 'back' so that Cargo.toml’s relative path works as expected.
WORKDIR /workspace/back

# Remove any local patch override file if present
RUN rm -f .cargo/config.toml

# Accept build arguments
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

CMD [ "bash", "-c", "if [ \"$BUILD_TYPE\" = \"release\" ]; then exec ./target/release/$PROGRAM; else exec ./target/debug/$PROGRAM; fi" ]