#!/usr/bin/env bash
# Copie l'app (code, styles, config) dans l'app ApOS installée sur la TV et la relance.
# Ne touche ni aux données de temps d'écran (data/), ni aux icônes et fonds déjà présents sur la TV.
# Nécessite ares-launch (build/cli/node_modules/.bin/ares-launch ou ARES_LAUNCH).
set -euo pipefail
HOST="${1:?usage: deploy-app.sh <ip-tv>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP=/media/developer/apps/usr/palm/applications/com.apos.launcher
# shellcheck disable=SC2206
SSH_OPTS=(-o BatchMode=yes ${APOS_SSH_OPTS:-})
ARES_LAUNCH="${ARES_LAUNCH:-$ROOT/build/cli/node_modules/.bin/ares-launch}"

# supprime les anciens fichiers de code pour ne pas laisser de modules orphelins
ssh "${SSH_OPTS[@]}" "root@${HOST}" "rm -f $APP/js/*.js $APP/config/*.js"
scp -q -r "${SSH_OPTS[@]}" "$ROOT/app/index.html" "$ROOT/app/appinfo.json" "$ROOT/app/css" "$ROOT/app/js" "root@${HOST}:$APP/"
scp -q "${SSH_OPTS[@]}" "$ROOT"/app/config/*.js "root@${HOST}:$APP/config/"
"$ARES_LAUNCH" --device tv --close com.apos.launcher >/dev/null 2>&1 || true
"$ARES_LAUNCH" --device tv com.apos.launcher
