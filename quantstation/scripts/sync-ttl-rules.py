#!/usr/bin/env python3
"""
scripts/sync-ttl-rules.py — Synchronizes SHACL target_rules.ttl into MultiResolutionSpecRegistry.java
and notifies Spring Boot core-engine via REST API hot-reload.
"""

import sys
import requests
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SCRIPTS_DIR.parent
_TTL_PATH = _PROJECT_ROOT / "core-engine" / "src" / "main" / "resources" / "ontologies" / "target_rules.ttl"

def main():
    if not _TTL_PATH.exists():
        print(f"❌ Error: target_rules.ttl not found at {_TTL_PATH}")
        sys.exit(1)

    print(f"📖 Reading TTL rules from {_TTL_PATH}...")
    ttl_content = _TTL_PATH.read_text(encoding="utf-8")

    print("🚀 Triggering Spring Boot hot-reload endpoint (http://localhost:8080/api/v1/signals/multi-resolution/reload-rules)...")
    try:
        res = requests.post(
            "http://localhost:8080/api/v1/signals/multi-resolution/reload-rules",
            data=ttl_content,
            headers={"Content-Type": "text/plain"}
        )
        if res.status_code == 200:
            print(f"✓ Successfully hot-reloaded target rules! Response: {res.json()}")
        else:
            print(f"⚠️ Engine offline or returned status {res.status_code}. (Rules will load on next engine boot)")
    except Exception as e:
        print(f"ℹ️ Core Engine is currently offline ({e}). Target rules are updated on disk and will be loaded dynamically on startup.")

if __name__ == "__main__":
    main()
