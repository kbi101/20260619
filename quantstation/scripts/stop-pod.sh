#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# QuantStation — Stop Pod
# ═══════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$ROOT_DIR/infra"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
NC='\033[0m'

log() { echo -e "${CYAN}[QuantStation]${NC} $1"; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }

# ── Stop Spring Boot (if running) ────────────────────
BOOT_PID=$(pgrep -f "quantstation-core-engine" 2>/dev/null || true)
if [ -n "$BOOT_PID" ]; then
  log "Stopping Spring Boot (PID: $BOOT_PID)..."
  kill -TERM "$BOOT_PID" 2>/dev/null || true
  sleep 3
  ok "Spring Boot stopped"
else
  log "Spring Boot is not running"
fi

# ── Stop Docker services ─────────────────────────────
log "Stopping Docker services..."
docker compose -f "$INFRA_DIR/docker-compose.yml" down
ok "Docker services stopped"

echo ""
log "QuantStation pod is shut down."
