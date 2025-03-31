networks=(mainnet base)
rpcs=(
    "https://eth.llamarpc.com"
    "https://base.drpc.org"
)

IDX=0
STATUS=()
RED='\033[0;31m'
NC='\033[0m'
PORT=8888

TARGET="$1"

for i in ${networks[@]}; do

    export rpc=${rpcs[$IDX]}
    IDX=$(($IDX + 1))

    if [ "$#" -gt 0 ]; then
        if [ "$1" = "$i" ]; then
            echo "Match."
        else
            continue
        fi
    fi

    echo "Network: ${RED}${i}${NC} | RPC: $rpc"
    ps -ef | grep anvil | grep -v grep | awk '{print $2}' | xargs kill
    echo "Running: anvil --port $PORT --fork-url $rpc"
    anvil --port $PORT --fork-url $rpc >/dev/null 2>&1 &
    while true; do
        response=$(curl 127.0.0.1:$PORT -X POST -H "Content-Type: application/json" --data '{"method":"eth_blockNumber","params":[],"id":1,"jsonrpc":"2.0"}' --write-out '%{http_code}' --silent --output /dev/null)
        if [ "$response" = "200" ]; then
            echo "Fork Ready"
            break
        else
            echo "Waiting for Fork to be ready"
            sleep 1
        fi
    done

    # ------------------------------------------------------------------------------------------------------------------------------------------------
    export NETWORK=${i}
    echo "Running Tycho execution on fork for ${RED}${i}${NC} network"
    # forge test --fork-url http://127.0.0.1:$PORT -vv --match-contract FlashSimu --summary --detailed # --match-test testFlashSimu_u2multi_FuLL
    # ------------------------------------------------------------------------------------------------------------------------------------------------
    STATUS+=($?)
    if [ $STATUS -ne 0 ]; then
        echo "Error: $STATUS for network ${RED}${i}${NC} on program ${RED}${program}${NC}"
    fi
    sleep 1
    echo '\n'
done

echo "Status: ${RED}${networks[@]}${NC}: ${RED}${STATUS[@]}${NC}"
