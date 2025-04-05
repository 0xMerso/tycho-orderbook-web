FROM rust:slim
RUN apt-get update && apt-get install -y libssl-dev pkg-config
RUN apt-get update && apt-get install -y curl
RUN cargo install cargo-watch
WORKDIR /app
COPY . .
# Remove the local patch override file
RUN rm -f .cargo/config.toml
RUN cargo build --bin stream
CMD ["cargo", "run", "--bin", "stream"]