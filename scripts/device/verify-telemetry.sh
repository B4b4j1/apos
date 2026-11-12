#!/usr/bin/env bash
set -euo pipefail
HOST="${1:?usage: verify-telemetry.sh <ip-tv>}"
SERVICES_FILE="${SERVICES_FILE:-scripts/device/services-to-disable.txt}"

if ! remote=$(ssh "root@${HOST}" 'ls /usr/palm/services'); then
  echo "ssh échoué : état de la TV inconnu, rien n'est garanti" >&2
  exit 2
fi
names=$(grep -v '^#' "$SERVICES_FILE" | grep -v '^$' || true)
active=""
if [[ -n "$names" ]]; then
  # Correspondance exacte de ligne : « svc.disabled-by-apos » ne compte pas comme « svc ».
  active=$(printf '%s\n' "$remote" | grep -Fxf <(printf '%s\n' "$names") || true)
fi
if [[ -n "$active" ]]; then echo "ACTIFS: $active"; exit 1; fi
echo "OK: aucun service de collecte actif"
