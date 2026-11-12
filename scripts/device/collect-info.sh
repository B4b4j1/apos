#!/usr/bin/env bash
# Lecture seule : affiche les informations de l'appareil. N'écrit rien sur la TV.
set -euo pipefail
TV_HOST="${1:?usage: collect-info.sh <ip-tv>}"
ssh -o BatchMode=yes "root@${TV_HOST}" '
  echo "== release =="; cat /etc/os-release 2>/dev/null || true
  echo "== webos =="; grep -ri "webos_release\|version" /etc/palm-build-info 2>/dev/null | head -n 20 || true
  echo "== services Luna (noms) =="; ls /usr/palm/services 2>/dev/null | head -n 200 || true
  echo "== apps installées =="; ls /media/cryptofs/apps/usr/palm/applications 2>/dev/null || true
'
