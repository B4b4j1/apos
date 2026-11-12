#!/usr/bin/env bash
# Installe le collecteur de temps d'écran sur la TV et le démarre tout de suite.
# Réversible : scripts/device/restore-screentime.sh <ip-tv> (les données sont conservées).
set -euo pipefail
HOST="${1:?usage: install-screentime.sh <ip-tv>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck disable=SC2206
SSH_OPTS=(-o BatchMode=yes ${APOS_SSH_OPTS:-})
scp -q "${SSH_OPTS[@]}" "$ROOT/scripts/device/screentime/apos-screentime.sh" "root@${HOST}:/var/lib/webosbrew/apos-screentime.sh"
scp -q "${SSH_OPTS[@]}" "$ROOT/scripts/device/screentime/70-apos-screentime" "root@${HOST}:/var/lib/webosbrew/init.d/70-apos-screentime"
ssh "${SSH_OPTS[@]}" "root@${HOST}" 'chmod 755 /var/lib/webosbrew/apos-screentime.sh /var/lib/webosbrew/init.d/70-apos-screentime && sh /var/lib/webosbrew/init.d/70-apos-screentime; sleep 1; echo "collecteur lancé (PID $(cat /tmp/apos-screentime.pid))"'
