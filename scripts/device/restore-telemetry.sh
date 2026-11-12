#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${1:?usage: restore-telemetry.sh <dossier-sauvegarde> <ip-tv>}"
HOST="${2:?usage: restore-telemetry.sh <dossier-sauvegarde> <ip-tv>}"
# shellcheck disable=SC2029  # $f vient de la liste distante, pas de l'utilisateur
for f in $(ssh "root@${HOST}" 'ls /usr/palm/services | grep "\.disabled-by-apos$"' || true); do
  orig="${f%.disabled-by-apos}"
  ssh "root@${HOST}" "mv /usr/palm/services/${f} /usr/palm/services/${orig}"
done
echo "services restaurés depuis ${BACKUP_DIR}"
