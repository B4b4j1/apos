#!/usr/bin/env bash
# Régénère la liste des apps (config/launchpoints.json) et leurs icônes dans l'app ApOS installée.
# À relancer après l'installation ou la suppression d'une app sur la TV.
set -euo pipefail
HOST="${1:?usage: refresh-apps.sh <ip-tv>}"
HERE="$(cd "$(dirname "$0")" && pwd)"
APP=/media/developer/apps/usr/palm/applications/com.apos.launcher
ssh -o BatchMode=yes ${APOS_SSH_OPTS:-} "root@${HOST}" python3 - "$APP" \
  /usr/palm/applications \
  /media/cryptofs/apps/usr/palm/applications \
  /media/developer/apps/usr/palm/applications \
  < "$HERE/gen_launchpoints.py"
