#!/usr/bin/env bash
set -euo pipefail
HOST="${1:?usage: restore-launcher.sh <ip-tv>}"
ares-install --device tv --remove com.apos.launcher || true
ssh "root@${HOST}" 'rm -f /var/lib/apos/autostart-app'
echo "launcher retiré ; redémarrer la TV pour revenir à l'accueil LG (à vérifier sur l'appareil)"
