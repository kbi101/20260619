#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# QuantStation — Start Pod
# ═══════════════════════════════════════════════════════
# Master orchestration script: starts Docker services,
# waits for health checks, then launches the backend.
# ═══════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$ROOT_DIR/infra"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() { echo -e "${CYAN}[QuantStation]${NC} $1"; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn(){ echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }

# ── Step 1: Check prerequisites ──────────────────────
log "Checking prerequisites..."

# Check Docker/OrbStack
if command -v docker &>/dev/null; then
  if docker info &>/dev/null; then
    DOCKER_CONTEXT=$(docker info --format '{{.Name}}' 2>/dev/null || echo "unknown")
    ok "Docker is running (context: $DOCKER_CONTEXT)"
  else
    err "Docker daemon is not running. Start OrbStack or Docker Desktop."
    exit 1
  fi
else
  err "Docker not found. Install OrbStack: https://orbstack.dev"
  exit 1
fi

# Check Java
if command -v java &>/dev/null; then
  JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2)
  ok "Java $JAVA_VERSION found"
else
  warn "Java not found. Spring Boot backend will not start."
fi

# ── Step 2: Load environment ─────────────────────────
if [ -f "$ROOT_DIR/.env" ]; then
  log "Loading environment from .env"
  set -a
  source "$ROOT_DIR/.env"
  set +a
  ok "Environment loaded"
else
  warn "No .env file found. Copy .env.example to .env and configure."
fi

# ── Step 3: Start Docker services ────────────────────
log "Starting Docker services..."
docker compose -f "$INFRA_DIR/docker-compose.yml" up -d

# ── Step 4: Wait for health checks ───────────────────
log "Waiting for services to become healthy..."

wait_for_service() {
  local name="$1"
  local check_cmd="$2"
  local max_wait="${3:-60}"
  local elapsed=0

  while [ $elapsed -lt $max_wait ]; do
    if eval "$check_cmd" &>/dev/null; then
      ok "$name is ready"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  err "$name failed to become ready after ${max_wait}s"
  return 1
}

wait_for_service "Redis" \
  "docker exec quantstation-redis redis-cli ping | grep -q PONG" 30

wait_for_service "QuestDB" \
  "curl -sf http://localhost:9000/exec?query=SELECT+1" 45

wait_for_service "Core Engine" \
  "curl -sf http://localhost:8081/actuator/health | grep -q UP" 60

# ── Summary ──────────────────────────────────────────
echo ""
log "═══════════════════════════════════════════════"
log "  QuantStation Pod is starting up"
log "═══════════════════════════════════════════════"
log "  Spring Boot:    http://localhost:8080"
log "  WebSocket:      ws://localhost:8080/ws"
log "  Actuator:       http://localhost:8081"
log "  QuestDB:        http://localhost:9000"
log "  Redis:          localhost:6379"
log "  IB Gateway:     localhost:4002 (paper)"
log "═══════════════════════════════════════════════"
echo ""
log "To stop: bash scripts/stop-pod.sh"
