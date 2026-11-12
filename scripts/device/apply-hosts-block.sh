#!/usr/bin/env bash
# Installe le blocage des domaines pub/ACR/télémétrie LG sur la TV :
# liste dans /var/lib/webosbrew/apos-hosts.block + script de démarrage init.d, appliqué tout de suite.
# Réversible : scripts/device/restore-hosts-block.sh <ip-tv>
set -euo pipefail
HOST="${1:?usage: apply-hosts-block.sh <ip-tv>}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck disable=SC2206
SSH_OPTS=(-o BatchMode=yes ${APOS_SSH_OPTS:-})

python3 "$ROOT/blocklist/build_blocklist.py" "$ROOT/docs/telemetry-audit.tsv" "$ROOT/blocklist/allowlist.txt" "$ROOT/blocklist/edu-tv.hosts"
scp -q "${SSH_OPTS[@]}" "$ROOT/blocklist/edu-tv.hosts" "root@${HOST}:/var/lib/webosbrew/apos-hosts.block"
scp -q "${SSH_OPTS[@]}" "$ROOT/scripts/device/hosts-block/50-apos-hosts" "root@${HOST}:/var/lib/webosbrew/init.d/50-apos-hosts"
ssh "${SSH_OPTS[@]}" "root@${HOST}" 'chmod 755 /var/lib/webosbrew/init.d/50-apos-hosts && sh /var/lib/webosbrew/init.d/50-apos-hosts && echo "lignes de blocage dans /etc/hosts : $(grep -c "^0.0.0.0" /etc/hosts)"'
