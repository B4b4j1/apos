#!/usr/bin/env bash
# Arrête le collecteur de temps d'écran et retire son démarrage automatique (les données restent dans l'app).
set -euo pipefail
HOST="${1:?usage: restore-screentime.sh <ip-tv>}"
# shellcheck disable=SC2206
SSH_OPTS=(-o BatchMode=yes ${APOS_SSH_OPTS:-})
ssh "${SSH_OPTS[@]}" "root@${HOST}" '[ -f /tmp/apos-screentime.pid ] && kill "$(cat /tmp/apos-screentime.pid)" 2>/dev/null; rm -f /tmp/apos-screentime.pid /var/lib/webosbrew/init.d/70-apos-screentime /var/lib/webosbrew/apos_screentime.py; echo "service de temps d ecran retire"'
