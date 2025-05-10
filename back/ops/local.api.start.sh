RED='\033[0;31m'
NC='\033[0m' # No Color
RPC="https://rpc.payload.de"

function start() {

    trap '' SIGINT

    # ------------- Redis -------------
    rm -rf dump.rdb
    ps -ef | grep redis-server | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null
    redis-server --port 42777 --bind 127.0.0.1 2>&1 >/dev/null &
    # redis-server src/shared/config/redis.conf --bind 127.0.0.1 2>&1 >/dev/null &
    echo "Redis ready #$(ps -ef | grep redis-server | grep -v grep | awk '{print $2}')"
    sleep 1
    # ------------- Execute -------------
    echo "Building ..."
    # export RUSTFLAGS="--cfg tokio_unstable"
    cargo build --bin stream # -q 2>/dev/null
    echo "Build successful. Executing..."
    (
        trap - SIGINT
        # Dirty way to print all logs
        export RUST_LOG="off,stream=trace,shared=trace,tycho_orderbook=trace" #,tycho_client=debug" # ,tokio=trace,runtime=trace"
        # export RUST_LOG=trace
        cargo run --bin stream # 2>/dev/null
        # cargo watch -w src/ -x "run --bin stream" -q
    )
    echo "Program has finished or was interrupted. Continuing with the rest of the shell script ..."
    status+=($?)
    if [ $status -ne 0 ]; then
        echo "Error: $status on program ${RED}${program}${NC}"
        exit 1
    fi
    ps -ef | grep redis-server | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null
    rm -rf dump.rdb
}

start

# --- Custom logging ---
# RUST_LOG=debug,stream::module=trace && cargo run

# --- Tycho System Status ---
# https://grafana.propellerheads.xyz/public-dashboards/518dd877a470434383caf9fc5845652e?orgId=1&refresh=5s

# --- Cleanup ---
# cargo clippy --fix --allow-dirty --allow-staged --workspace --all-targets --all-features
