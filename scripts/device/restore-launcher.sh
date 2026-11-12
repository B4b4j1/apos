#!/usr/bin/env bash
set -euo pipefail
HOST="${1:?usage: restore-launcher.sh <ip-tv>}"
ares-install --device tv --remove com.apos.launcher || true
ssh "root@${HOST}" 'rm -f /var/lib/webosbrew/init.d/60-apos-launcher'
echo "launcher retiré ; redémarrer la TV pour revenir à l'accueil LG (à vérifier sur l'appareil)"
