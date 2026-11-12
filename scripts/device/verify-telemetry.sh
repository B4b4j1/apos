#!/usr/bin/env bash
set -euo pipefail
HOST="${1:?usage: verify-telemetry.sh <ip-tv>}"
active=$(ssh "root@${HOST}" 'ls /usr/palm/services 2>/dev/null' | grep -Ff <(grep -v '^#' scripts/device/services-to-disable.txt | grep -v '^$') || true)
if [[ -n "$active" ]]; then echo "ACTIFS: $active"; exit 1; fi
echo "OK: aucun service de collecte actif"
