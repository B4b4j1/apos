#!/usr/bin/env bash
set -euo pipefail
DRY=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY=1; shift; fi
HOST="${1:?usage: install-launcher.sh [--dry-run] <ip-tv>}"
IPK=$(ls dist/com.apos.launcher_*.ipk 2>/dev/null | tail -n1 || true)
if [[ -z "$IPK" ]]; then
  if [[ $DRY -eq 0 ]]; then echo "paquet absent : lancer scripts/app/package.sh d'abord" >&2; exit 1; fi
  IPK="dist/com.apos.launcher_0.1.0_all.ipk"
fi
run() { if [[ $DRY -eq 1 ]]; then echo "DRY-RUN: $*"; else eval "$@"; fi; }
run "ares-install --device tv '${IPK}'"
run "ssh root@${HOST} 'mkdir -p /var/lib/apos && echo com.apos.launcher > /var/lib/apos/autostart-app'"
