#!/bin/bash

# Default values
REQUESTS=100
API_URL="http://localhost:3000/api/conversion/upload"
MAX_PARALLEL=10

usage() {
    echo "Usage: $0 -f <file> [-n requests] [-u url] [-p parallel]"
    echo "  -f: Test file path (required)"
    echo "  -n: Number of requests (default: 100)"
    echo "  -u: API URL (default: http://localhost:3000/api/conversion/upload)"
    echo "  -p: Max parallel requests (default: 10)"
    exit 1
}

# Parse command line arguments
while getopts "n:u:f:p:h" opt; do
    case $opt in
        n) REQUESTS=$OPTARG ;;
        u) API_URL=$OPTARG ;;
        f) TEST_FILE=$OPTARG ;;
        p) MAX_PARALLEL=$OPTARG ;;
        h) usage ;;
        ?) usage ;;
    esac
done

# Check if test file parameter is provided
if [ -z "$TEST_FILE" ]; then
    echo "Error: Test file parameter (-f) is required!"
    usage
fi

# Check if test file exists
if [ ! -f "$TEST_FILE" ]; then
    echo "Error: Test file $TEST_FILE not found!"
    exit 1
fi

# Get script directory and create results directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
mkdir -p "$SCRIPT_DIR/results"
RESULTS_FILE="$SCRIPT_DIR/results/load_test_$(date +%Y%m%d_%H%M%S).txt"
echo "Timestamp,Response_Time,Status" > "$RESULTS_FILE"

echo "Starting load test with following parameters:"
echo "Requests: $REQUESTS"
echo "URL: $API_URL"
echo "Test file: $TEST_FILE"
echo "Max parallel requests: $MAX_PARALLEL"
echo "Results will be saved to: $RESULTS_FILE"

start_time=$(date +%s)
active_jobs=0

for i in $(seq 1 $REQUESTS); do
    # Wait if we have too many parallel jobs
    while [ $active_jobs -ge $MAX_PARALLEL ]; do
        active_jobs=$(jobs -p | wc -l)
        sleep 0.1
    done

    # Send request in background
    (
        request_start=$(date +%s.%N)
        response=$(curl -s -w "%{http_code}" -X POST -F "video=@$TEST_FILE" "$API_URL")
        status_code=${response: -3}
        request_end=$(date +%s.%N)
        duration=$(echo "$request_end - $request_start" | bc)
        echo "$(date +%Y-%m-%d_%H:%M:%S),$duration,$status_code" >> "$RESULTS_FILE"

        # Progress indicator
        if [ $((i % 10)) -eq 0 ]; then
            echo "Completed $i requests..."
        fi
    ) &

    active_jobs=$((active_jobs + 1))
done

# Wait for all jobs to complete
wait

end_time=$(date +%s)
total_time=$((end_time - start_time))

# Calculate statistics
total_requests=$(wc -l < "$RESULTS_FILE")
total_requests=$((total_requests - 1))  # Subtract header line
successful_requests=$(grep ",200$" "$RESULTS_FILE" | wc -l)
failed_requests=$((total_requests - successful_requests))
requests_per_second=$(echo "scale=2; $total_requests / $total_time" | bc)
avg_response_time=$(awk -F',' 'NR>1 {sum+=$2} END {printf "%.3f", sum/(NR-1)}' "$RESULTS_FILE")

# Print summary
echo -e "\nTest completed!"
echo "Total time: ${total_time}s"
echo "Average response time: ${avg_response_time}s"
echo "Total requests: $total_requests"
echo "Successful requests: $successful_requests"
echo "Failed requests: $failed_requests"
echo "Requests per second: $requests_per_second"

# Print status code distribution
echo -e "\nStatus code distribution:"
cut -d',' -f3 "$RESULTS_FILE" | sort | uniq -c | tail -n +2
