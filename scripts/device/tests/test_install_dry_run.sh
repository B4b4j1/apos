#!/usr/bin/env bash
set -euo pipefail
out=$(bash scripts/device/install-launcher.sh --dry-run 192.0.2.10) || { echo "install-launcher a échoué"; exit 1; }
echo "$out" | grep -q "DRY-RUN" || { echo "pas de marqueur DRY-RUN"; exit 1; }
echo "$out" | grep -q "ares-install" || { echo "installation absente"; exit 1; }
echo "OK"
