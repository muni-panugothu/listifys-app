#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Listifys — Automated MongoDB Backup Script
# Run via cron: 0 2 * * * /app/scripts/backup.sh >> /var/log/backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="listifys_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup: ${BACKUP_NAME}"

# Extract connection details from MONGODB_URI
if [ -z "$MONGODB_URI" ]; then
  echo "[$(date)] ERROR: MONGODB_URI not set"
  exit 1
fi

# Run mongodump
mongodump --uri="$MONGODB_URI" --out="$BACKUP_PATH" --gzip --quiet

# Verify backup was created
if [ -d "$BACKUP_PATH" ]; then
  BACKUP_SIZE=$(du -sh "$BACKUP_PATH" | cut -f1)
  echo "[$(date)] Backup completed: ${BACKUP_NAME} (${BACKUP_SIZE})"
else
  echo "[$(date)] ERROR: Backup directory was not created"
  exit 1
fi

# Upload to S3 if configured
if [ -n "$BACKUP_S3_BUCKET" ]; then
  tar -czf "${BACKUP_PATH}.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME"
  aws s3 cp "${BACKUP_PATH}.tar.gz" "s3://${BACKUP_S3_BUCKET}/db-backups/${BACKUP_NAME}.tar.gz" --quiet
  rm -f "${BACKUP_PATH}.tar.gz"
  echo "[$(date)] Uploaded to S3: s3://${BACKUP_S3_BUCKET}/db-backups/${BACKUP_NAME}.tar.gz"
fi

# Prune old backups (keep last N days)
if [ "$RETENTION_DAYS" -gt 0 ]; then
  PRUNED=$(find "$BACKUP_DIR" -maxdepth 1 -name "listifys_*" -type d -mtime +"$RETENTION_DAYS" | wc -l)
  find "$BACKUP_DIR" -maxdepth 1 -name "listifys_*" -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} +
  echo "[$(date)] Pruned ${PRUNED} backups older than ${RETENTION_DAYS} days"
fi

echo "[$(date)] Backup complete"
