#!/usr/bin/env bash
set -euo pipefail

# Database restore script for Kovarti PM Assistant
# Usage: bash scripts/restore-db.sh path/to/backup.sql.gz

if [ $# -lt 1 ]; then
  echo "Usage: $0 <backup-file.sql.gz>" >&2
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found: $BACKUP_FILE" >&2
  exit 1
fi

# Load .env if present
if [ -f "$(dirname "$0")/../.env" ]; then
  set -a
  source "$(dirname "$0")/../.env"
  set +a
fi

# Validate required vars
for var in DB_HOST DB_USER DB_PASSWORD DB_NAME; do
  if [ -z "${!var:-}" ]; then
    echo "Error: $var is not set" >&2
    exit 1
  fi
done

echo "WARNING: This will overwrite the '${DB_NAME}' database on ${DB_HOST}."
read -p "Continue? (y/N) " -r
if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring ${DB_NAME} from ${BACKUP_FILE}..."

gunzip -c "$BACKUP_FILE" | mysql \
  --host="$DB_HOST" \
  --user="$DB_USER" \
  --password="$DB_PASSWORD" \
  "$DB_NAME"

echo "Restore complete."
