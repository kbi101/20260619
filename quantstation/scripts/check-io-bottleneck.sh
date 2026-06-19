#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# QuantStation — I/O Bottleneck Checker
# ═══════════════════════════════════════════════════════
# Validates Docker I/O path for QuestDB performance.
# Target: ≥1GB/s sequential write throughput.
# ═══════════════════════════════════════════════════════
set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${CYAN}[I/O Check]${NC} $1"; }
ok()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn(){ echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[✗]${NC} $1"; }

echo ""
log "═══════════════════════════════════════════════"
log "  QuantStation I/O Bottleneck Checker"
log "═══════════════════════════════════════════════"
echo ""

# ── Detect runtime ───────────────────────────────────
log "Detecting container runtime..."
if docker info 2>/dev/null | grep -qi "orbstack"; then
  ok "OrbStack detected (optimal for Apple Silicon)"
elif docker info 2>/dev/null | grep -qi "docker desktop"; then
  warn "Docker Desktop detected — check VirtioFS is enabled"
  # Check VirtioFS
  if docker info 2>/dev/null | grep -qi "virtiofs"; then
    ok "VirtioFS is enabled"
  else
    err "VirtioFS not detected. Enable in Docker Desktop Settings > General"
  fi
else
  log "Unknown runtime — proceeding with tests"
fi

# ── Docker VM Resources ─────────────────────────────
log "Checking Docker VM resources..."
DOCKER_CPUS=$(docker info --format '{{.NCPU}}' 2>/dev/null || echo "?")
DOCKER_MEM=$(docker info --format '{{.MemTotal}}' 2>/dev/null || echo "?")
log "  CPUs: $DOCKER_CPUS"
log "  Memory: $DOCKER_MEM"

# ── Sequential Write Test ────────────────────────────
log "Running sequential write test (256MB)..."

if docker ps | grep -q "quantstation-questdb"; then
  # Test inside QuestDB container for realistic results
  RESULT=$(docker exec quantstation-questdb \
    dd if=/dev/zero of=/tmp/io_test bs=1M count=256 conv=fdatasync 2>&1 | tail -1)
  docker exec quantstation-questdb rm -f /tmp/io_test

  # Parse throughput
  SPEED=$(echo "$RESULT" | grep -oP '[\d.]+ [GM]B/s' || echo "unknown")
  log "  Write throughput: $SPEED"

  # Check against threshold
  if echo "$RESULT" | grep -qP '[1-9]\d*(\.\d+)? GB/s'; then
    ok "Write throughput meets target (≥1GB/s)"
  else
    warn "Write throughput below 1GB/s target — consider OrbStack"
  fi
else
  warn "QuestDB container not running — testing host I/O instead"
  RESULT=$(dd if=/dev/zero of=/tmp/qs_io_test bs=1M count=256 conv=fsync 2>&1 | tail -1)
  rm -f /tmp/qs_io_test
  SPEED=$(echo "$RESULT" | grep -oP '[\d.]+ [GM]B/s' || echo "$RESULT")
  log "  Host write throughput: $SPEED"
fi

# ── Named Volume Check ──────────────────────────────
log "Checking Docker volume configuration..."
if docker volume inspect questdb_data &>/dev/null 2>&1 || \
   docker volume inspect infra_questdb_data &>/dev/null 2>&1; then
  ok "QuestDB named volume exists (better than bind mounts)"
else
  warn "QuestDB named volume not found — will be created on first run"
fi

echo ""
log "═══════════════════════════════════════════════"
log "  I/O Check Complete"
log "═══════════════════════════════════════════════"
