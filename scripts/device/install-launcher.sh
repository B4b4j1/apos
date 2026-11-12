#!/usr/bin/env bash
set -euo pipefail
DRY=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY=1; shift; fi
HOST="${1:?usage: install-launcher.sh [--dry-run] <ip-tv>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IPK=$(ls dist/com.apos.launcher_*.ipk 2>/dev/null | tail -n1 || true)
if [[ -z "$IPK" ]]; then
  if [[ $DRY -eq 0 ]]; then echo "paquet absent : lancer scripts/app/package.sh d'abord" >&2; exit 1; fi
  IPK="dist/com.apos.launcher_0.1.0_all.ipk"
fi
run() { if [[ $DRY -eq 1 ]]; then echo "DRY-RUN: $*"; else eval "$@"; fi; }
run "ares-install --device tv '${IPK}'"
run "scp '${ROOT}/scripts/device/autostart/60-apos-launcher' root@${HOST}:/var/lib/webosbrew/init.d/60-apos-launcher"
run "ssh root@${HOST} 'chmod 755 /var/lib/webosbrew/init.d/60-apos-launcher'"
