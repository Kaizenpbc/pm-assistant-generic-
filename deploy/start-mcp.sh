#!/bin/bash
# Start MCP server in HTTP mode with OAuth support
# Run from: /home/kaizenmo/pm.ca/mcp-server/

# Activate Node.js environment
source /home/kaizenmo/nodevenv/pm.ca/22/bin/activate

# PM API base URL
export PM_BASE_URL="https://pm.kpbc.ca"

# Transport mode
export PM_TRANSPORT="http"
export PM_PORT="3100"

# Database credentials (same as main PM app)
export DB_HOST="localhost"
export DB_USER="kaizenmo_pmuser"
export DB_PASSWORD="PmAssist2025Secure"
export DB_NAME="kaizenmo_pmassist"

# Start the server
cd /home/kaizenmo/pm.ca/mcp-server
exec node dist/index.js
