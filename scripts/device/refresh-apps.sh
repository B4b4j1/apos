#!/usr/bin/env bash
# Régénère la liste des apps (config/launchpoints.json), leurs icônes et leurs couleurs de tuile
# dans l'app ApOS installée. À relancer après l'ajout ou la suppression d'une app sur la TV.
# Les couleurs sont calculées sur le Mac (Pillow : build/venv/bin/python) puis renvoyées à la TV.
set -euo pipefail
HOST="${1:?usage: refresh-apps.sh <ip-tv>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
APP=/media/developer/apps/usr/palm/applications/com.apos.launcher
# shellcheck disable=SC2206
SSH_OPTS=(-o BatchMode=yes ${APOS_SSH_OPTS:-})
PY="$ROOT/build/venv/bin/python"
[ -x "$PY" ] || PY=python3

ssh "${SSH_OPTS[@]}" "root@${HOST}" python3 - "$APP" \
  /usr/palm/applications \
  /media/cryptofs/apps/usr/palm/applications \
  /media/developer/apps/usr/palm/applications \
  < "$HERE/gen_launchpoints.py"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/config" "$TMP/assets"
scp -q "${SSH_OPTS[@]}" "root@${HOST}:$APP/config/launchpoints.json" "$TMP/config/"
scp -q -r "${SSH_OPTS[@]}" "root@${HOST}:$APP/assets/icons" "$TMP/assets/"
"$PY" "$HERE/add_icon_colors.py" "$TMP"
scp -q "${SSH_OPTS[@]}" "$TMP/config/launchpoints.json" "root@${HOST}:$APP/config/launchpoints.json"
"$HERE/persist-assets.sh" "$HOST"
