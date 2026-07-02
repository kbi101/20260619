#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# QuantStation — QuestDB Backup
# ═══════════════════════════════════════════════════════
# Dumps QuestDB data to timestamped cold storage archive.
# ═══════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$ROOT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/questdb_backup_$TIMESTAMP.tar.gz"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

log() { echo -e "${CYAN}[Backup]${NC} $1"; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }

mkdir -p "$BACKUP_DIR"

log "Starting QuestDB backup..."
log "Target: $BACKUP_FILE"

# Export data via QuestDB's COPY command or volume snapshot
if docker ps | grep -q "quantstation-questdb"; then
  # Create a snapshot of the QuestDB volume
  VOLUME_NAME=$(docker inspect quantstation-questdb \
    --format '{{range .Mounts}}{{if eq .Destination "/var/lib/questdb"}}{{.Name}}{{end}}{{end}}' 2>/dev/null || echo "")

  if [ -n "$VOLUME_NAME" ]; then
    log "Backing up volume: $VOLUME_NAME"
    docker run --rm \
      -v "$VOLUME_NAME":/data:ro \
      -v "$BACKUP_DIR":/backup \
      alpine tar czf "/backup/questdb_backup_$TIMESTAMP.tar.gz" -C /data .
    ok "Volume backup complete"
  else
    log "Exporting tables via SQL..."
    # Export key tables as CSV
    for TABLE in ticks ohlcv options_chain order_audit pnl_snapshots; do
      curl -sf "http://localhost:9002/exp?query=SELECT+*+FROM+$TABLE" \
        -o "$BACKUP_DIR/${TABLE}_${TIMESTAMP}.csv" 2>/dev/null && \
        ok "Exported $TABLE" || log "  $TABLE: no data or export failed"
    done

    # Compress CSVs
    tar czf "$BACKUP_FILE" -C "$BACKUP_DIR" \
      $(ls "$BACKUP_DIR"/*_${TIMESTAMP}.csv 2>/dev/null | xargs -n1 basename) 2>/dev/null
    rm -f "$BACKUP_DIR"/*_${TIMESTAMP}.csv
  fi
else
  log "QuestDB container not running — cannot backup"
  exit 1
fi

# Report size
BACKUP_SIZE=$(du -h "$BACKUP_FILE" 2>/dev/null | cut -f1)
ok "Backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Cleanup old backups (keep last 7)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/questdb_backup_*.tar.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 7 ]; then
  log "Cleaning old backups (keeping last 7)..."
  ls -1t "$BACKUP_DIR"/questdb_backup_*.tar.gz | tail -n +8 | xargs rm -f
  ok "Old backups cleaned"
fi
