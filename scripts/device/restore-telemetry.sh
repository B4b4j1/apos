#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="${1:?usage: restore-telemetry.sh <dossier-sauvegarde> <ip-tv>}"
HOST="${2:?usage: restore-telemetry.sh <dossier-sauvegarde> <ip-tv>}"
if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "dossier de sauvegarde introuvable : $BACKUP_DIR" >&2
  exit 2
fi
if ! list=$(ssh "root@${HOST}" 'ls /usr/palm/services'); then
  echo "ssh échoué : aucune restauration effectuée" >&2
  exit 2
fi
for f in $(printf '%s\n' "$list" | grep '\.disabled-by-apos$' || true); do
  orig="${f%.disabled-by-apos}"
  # shellcheck disable=SC2029  # chemins issus de la liste distante, déjà filtrés
  if ! ssh "root@${HOST}" "mv '/usr/palm/services/${f}' '/usr/palm/services/${orig}'"; then
    echo "échec de restauration : $f" >&2
    exit 1
  fi
done
echo "services restaurés depuis ${BACKUP_DIR}"
