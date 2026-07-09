#!/usr/bin/env bash
# Deploy PM Assistant to Oracle Cloud (pm.kpbc.ca)
# Usage: bash deploy.sh [--skip-tests] [--server-only] [--client-only]
set -euo pipefail

SSH_KEY='/c/Users/gerog/Downloads/ssh-key-2026-07-08 (1).key'
SSH_HOST="ubuntu@147.5.127.99"

do_ssh()  { ssh  -i "$SSH_KEY" "$SSH_HOST" "$@"; }
do_scp()  { scp  -i "$SSH_KEY" "$@"; }

SKIP_TESTS=false
SERVER_ONLY=false
CLIENT_ONLY=false

for arg in "$@"; do
  case $arg in
    --skip-tests)  SKIP_TESTS=true ;;
    --server-only) SERVER_ONLY=true ;;
    --client-only) CLIENT_ONLY=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

echo "=== PM Assistant Deploy ==="
echo ""

# --- Step 1: Type check ---
echo "[1/7] Type checking..."
npx tsc --noEmit
echo "  OK"

# --- Step 2: Tests ---
if [ "$SKIP_TESTS" = true ]; then
  echo "[2/7] Tests skipped (--skip-tests)"
else
  echo "[2/7] Running tests..."
  npx vitest run --reporter=dot
  echo "  OK"
fi

# --- Step 3: Build ---
if [ "$CLIENT_ONLY" = true ]; then
  echo "[3/7] Building client only..."
  npm run build:client
elif [ "$SERVER_ONLY" = true ]; then
  echo "[3/7] Building server only..."
  npm run build:server
else
  echo "[3/7] Building server + client..."
  npm run build
fi
echo "  OK"

# --- Step 4: Copy migration SQL files (not included in tsc output) ---
echo "[4/7] Copying migration SQL files to dist..."
cp src/server/database/migrations/*.sql dist/server/database/migrations/ 2>/dev/null || true
echo "  OK"

# --- Step 5: Upload server ---
if [ "$CLIENT_ONLY" = false ]; then
  echo "[5/7] Uploading server dist..."
  do_scp -r dist/server "$SSH_HOST":/opt/pm-app/dist/
  echo "  OK"
else
  echo "[5/7] Server upload skipped (--client-only)"
fi

# --- Step 6: Upload client ---
if [ "$SERVER_ONLY" = false ]; then
  echo "[6/7] Uploading client dist..."
  tar czf /tmp/client-dist.tar.gz -C src/client/dist .
  do_scp /tmp/client-dist.tar.gz "$SSH_HOST":/tmp/
  do_ssh "rm -rf /opt/pm-app/client-dist/assets && tar xzf /tmp/client-dist.tar.gz -C /opt/pm-app/client-dist"
  rm -f /tmp/client-dist.tar.gz
  echo "  OK"
else
  echo "[6/7] Client upload skipped (--server-only)"
fi

# --- Step 7: Restart & verify ---
echo "[7/7] Restarting app..."
do_ssh "sudo systemctl restart pm-app"
sleep 3

echo ""
echo "=== Verifying ==="
STATUS=$(do_ssh "sudo systemctl is-active pm-app")
if [ "$STATUS" = "active" ]; then
  echo "  Service: RUNNING"
else
  echo "  Service: $STATUS (PROBLEM!)"
  do_ssh "sudo journalctl -u pm-app --no-pager -n 20"
  exit 1
fi

HEALTH=$(do_ssh "curl -s http://127.0.0.1:3001/health | head -c 200")
echo "  Health:  $HEALTH"

echo ""
echo "=== Deploy complete ==="
