#!/usr/bin/env bash
set -euo pipefail
out=$(bash scripts/device/disable-telemetry.sh --dry-run 192.0.2.10)
echo "$out" | grep -q "DRY-RUN" || { echo "pas de marqueur DRY-RUN"; exit 1; }
echo "$out" | grep -q "backup" || { echo "pas d'étape de sauvegarde"; exit 1; }
if echo "$out" | grep -E "rm -rf|mv .* /dev/null"; then
  echo "commande destructive en dry-run"; exit 1
fi
echo "OK"
