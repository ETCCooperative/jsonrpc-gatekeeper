#!/bin/bash

# Health check is being run as a CRON
# The reason for this is that the service is to handle the crappy IPC with core-geth
# which is not reliable because of the streaming JSON RPC.
# The service is being restarted every minute if the health check fails.
#
# */1 * * * * /home/geth/jsonrpc-middleware-api/health_check.sh >> /var/log/jsonrpc-middleware-api_health_check.log 2>&1

# Load the .env file
source "$(dirname "$0")/.env"

# API URL
API_URL="http://127.0.0.1:$PORT"

NOW=$(date +"%Y-%m-%d %H:%M:%S")

if ! curl --fail -s -L -H "Content-Type: application/json" --data '{"jsonrpc": "2.0", "id": 2000000, "method": "admin_peers", "params": []}' "$API_URL" > /dev/null; then
    echo "[$NOW] Service check failed. Restarting $SYSTEMD_SERVICE..."
    systemctl restart "$SYSTEMD_SERVICE"
else
    echo "[$NOW] Service check passed."
fi