#!/usr/bin/env bash
set -euo pipefail

# Database backup script for Kovarti PM Assistant
# Usage: bash scripts/backup-db.sh
# Cron example (daily at 2 AM): 0 2 * * * cd /path/to/project && bash scripts/backup-db.sh

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/pm-assistant}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

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

mkdir -p "$BACKUP_DIR"

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Backing up ${DB_NAME} to ${BACKUP_FILE}..."

mysqldump \
  --host="$DB_HOST" \
  --user="$DB_USER" \
  --password="$DB_PASSWORD" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "Backup complete: $(du -h "$BACKUP_FILE" | cut -f1)"

# Prune old backups
PRUNED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [ "$PRUNED" -gt 0 ]; then
  echo "Pruned $PRUNED backup(s) older than ${RETENTION_DAYS} days"
fi
