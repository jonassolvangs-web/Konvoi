#!/bin/bash
# Daily database backup script for Konvoi
# Dumps the Supabase PostgreSQL database to a timestamped file
# Keeps the last 14 backups, deletes older ones

BACKUP_DIR="/Users/gallerisolvang/konvoi/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H%M")
FILENAME="konvoi_backup_${TIMESTAMP}.sql.gz"

# Direct connection (not pooler) required for pg_dump
DB_URL="postgresql://postgres.eybdetmetgdpcplntlxd:qowXe2-fywsah-xepfov@aws-1-eu-central-1.pooler.supabase.com:5432/postgres"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

pg_dump "$DB_URL" --no-owner --no-privileges --clean --if-exists 2>/dev/null | gzip > "$BACKUP_DIR/$FILENAME"

if [ ${PIPESTATUS[0]} -eq 0 ] && [ -s "$BACKUP_DIR/$FILENAME" ]; then
  SIZE=$(du -h "$BACKUP_DIR/$FILENAME" | cut -f1)
  echo "[$(date)] Backup OK: $FILENAME ($SIZE)"
else
  echo "[$(date)] BACKUP FAILED!"
  rm -f "$BACKUP_DIR/$FILENAME"
  exit 1
fi

# Delete backups older than 14 days
find "$BACKUP_DIR" -name "konvoi_backup_*.sql.gz" -mtime +14 -delete 2>/dev/null

echo "[$(date)] Done. Backups in $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"/konvoi_backup_*.sql.gz 2>/dev/null | tail -5
