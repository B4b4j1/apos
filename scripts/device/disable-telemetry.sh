#!/usr/bin/env bash
set -euo pipefail
# shellcheck source=lib/backup.sh
source "$(dirname "$0")/lib/backup.sh"
DRY=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY=1; shift; fi
HOST="${1:?usage: disable-telemetry.sh [--dry-run] <ip-tv>}"
STAMP=$(date +%Y%m%d-%H%M%S)
DEST="backups/${STAMP}"
SERVICES_FILE="scripts/device/services-to-disable.txt"

# shellcheck disable=SC2294  # eval est voulu : commandes construites en chaîne
run() { if [[ $DRY -eq 1 ]]; then echo "DRY-RUN: $*"; else eval "$@"; fi; }

run "backup_remote ${HOST} ${DEST}"
while read -r svc; do
  [[ -z "$svc" || "$svc" == \#* ]] && continue
  run "ssh root@${HOST} 'mv /usr/palm/services/${svc} /usr/palm/services/${svc}.disabled-by-apos'"
done < "$SERVICES_FILE"
run "mkdir -p backups && echo ${STAMP} > ${DEST}.stamp"
