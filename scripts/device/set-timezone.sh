#!/usr/bin/env bash
# Règle le fuseau horaire de la TV (par défaut Europe/Paris). Retour arrière : set-timezone.sh <ip> Etc/GMT-0
# Utilise le service système de webOS (luna-send doit lire un stdin redirigé : </dev/null).
set -euo pipefail
HOST="${1:?usage: set-timezone.sh <ip-tv> [zone, ex. Europe/Paris]}"
ZONE="${2:-Europe/Paris}"
[[ "$ZONE" =~ ^[A-Za-z0-9_/+-]+$ ]] || { echo "zone invalide" >&2; exit 2; }
CITY="${ZONE##*/}"
# shellcheck disable=SC2206
SSH_OPTS=(-o BatchMode=yes ${APOS_SSH_OPTS:-})
ssh "${SSH_OPTS[@]}" "root@${HOST}" "luna-send -n 1 luna://com.webos.service.systemservice/setPreferences '{\"timeZone\":{\"ZoneID\":\"${ZONE}\",\"Description\":\"${CITY}\",\"supportsDST\":1,\"offsetFromUTC\":60,\"CountryCode\":\"\",\"City\":\"${CITY}\",\"Country\":\"\"}}' </dev/null; sleep 2; date"
