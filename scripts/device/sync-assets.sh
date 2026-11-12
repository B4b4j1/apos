#!/usr/bin/env bash
# Envoie les éléments personnels d'ApOS (photos préparées, icônes, liste des apps) vers la TV, dans l'app
# ET dans /var/lib/webosbrew/apos (copie persistante). Le service de la TV restaure ces fichiers dans
# l'app après une mise à jour par Homebrew Channel, qui remplace tout le dossier de l'app.
set -euo pipefail
HOST="${1:?usage: sync-assets.sh <ip-tv>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP=/media/developer/apps/usr/palm/applications/com.apos.launcher
PERSIST=/var/lib/webosbrew/apos
# shellcheck disable=SC2206
SSH_OPTS=(-o BatchMode=yes ${APOS_SSH_OPTS:-})

ssh "${SSH_OPTS[@]}" "root@${HOST}" "mkdir -p $APP/assets $APP/config $PERSIST/assets $PERSIST/config"
for item in assets/wallpapers assets/icons config/launchpoints.json; do
  [ -e "$ROOT/app/$item" ] || continue
  scp -q -r "${SSH_OPTS[@]}" "$ROOT/app/$item" "root@${HOST}:$APP/$(dirname "$item")/"
done
"$ROOT/scripts/device/persist-assets.sh" "$HOST"
