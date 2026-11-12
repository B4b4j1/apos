#!/usr/bin/env bash
# Retire le blocage ApOS de la TV : script de démarrage, liste, et bloc dans /etc/hosts.
set -euo pipefail
HOST="${1:?usage: restore-hosts-block.sh <ip-tv>}"
# shellcheck disable=SC2206
SSH_OPTS=(-o BatchMode=yes ${APOS_SSH_OPTS:-})
ssh "${SSH_OPTS[@]}" "root@${HOST}" 'sh /var/lib/webosbrew/init.d/50-apos-hosts remove; rm -f /var/lib/webosbrew/init.d/50-apos-hosts /var/lib/webosbrew/apos-hosts.block; echo "blocage ApOS retiré"'
