# FROM rust:slim
# # Install required dependencies
# RUN apt-get update && apt-get install -y libssl-dev pkg-config curl git && rm -rf /var/lib/apt/lists/*

# RUN apt-get update && \
#     apt-get install -y --no-install-recommends git && \
#     apt-get clean && \
#     rm -rf /var/lib/apt/lists/*

# RUN apt-get update && \
#     apt-get install -y --no-install-recommends \
#     git \
#     build-essential && \
#     apt-get clean && \
#     rm -rf /var/lib/apt/lists/*

# WORKDIR /workspace
# # Copy both directories preserving the relative structure
# COPY back ./back
# COPY sdk ./sdk
# # Change working directory to 'back' so that Cargo.toml’s relative path works as expected.
# WORKDIR /workspace/back

# # Remove any local patch override file if present
# RUN rm -f .cargo/config.toml

# # Accept build arguments
# ARG BUILD_TYPE=release
# ARG PROGRAM=stream
# ENV BUILD_TYPE=${BUILD_TYPE}
# ENV PROGRAM=${PROGRAM}
# RUN echo "Binary: $PROGRAM, Build type: $BUILD_TYPE"

# # Build the program based on BUILD_TYPE
# RUN if [ "$BUILD_TYPE" = "release" ]; then \
#     cargo build --release --bin $PROGRAM; \
#     else \
#     cargo build --bin $PROGRAM; \
#     fi

# CMD [ "bash", "-c", "if [ \"$BUILD_TYPE\" = \"release\" ]; then exec ./target/release/$PROGRAM; else exec ./target/debug/$PROGRAM; fi" ]

# Stage 1: Builder
FROM rust:slim AS builder

# Install build dependencies (combining commands for cache efficiency).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl-dev \
    pkg-config \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy only manifest files first (to use Docker cache for dependencies)
COPY back/Cargo.toml back/Cargo.lock ./back/
COPY sdk/Cargo.toml sdk/Cargo.lock ./sdk/

# Pre-fetch dependencies (cache hit if manifest files don’t change)
WORKDIR /workspace/back
RUN cargo fetch --locked

# Copy the entire source code now:
WORKDIR /workspace
COPY back ./back
COPY sdk ./sdk

# Diagnostic: list the SDK folder to confirm Cargo.toml is present.
RUN ls -la /workspace/sdk

# Change working directory to back so the relative dependency works.
WORKDIR /workspace/back

# Accept build arguments for build type and binary name.
ARG BUILD_TYPE=release
ARG PROGRAM=stream
ENV BUILD_TYPE=${BUILD_TYPE}
ENV PROGRAM=${PROGRAM}

# Build the project based on BUILD_TYPE.
RUN if [ "$BUILD_TYPE" = "release" ]; then \
    cargo build --release --bin $PROGRAM; \
    else \
    cargo build --bin $PROGRAM; \
    fi

# Stage 2: Final (Runtime) Image
FROM debian:stable-slim

# Install runtime dependencies; adjust as needed.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl1.1 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from the builder stage.
ARG BUILD_TYPE=release
ARG PROGRAM=stream
COPY --from=builder /workspace/back/target/${BUILD_TYPE}/$PROGRAM /usr/local/bin/$PROGRAM

CMD [ "$PROGRAM" ]