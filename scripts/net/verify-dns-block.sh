#!/usr/bin/env bash
set -euo pipefail
RESOLVER="${1:?usage: verify-dns-block.sh <resolver[:port]> [liste-domaines]}"
LIST="${2:-blocklist/edu-tv.hosts}"
HOST="${RESOLVER%%:*}"
PORT="${RESOLVER#*:}"; [[ "$PORT" == "$RESOLVER" ]] && PORT=53
fail=0
while read -r _ domain; do
  [[ -z "${domain:-}" ]] && continue
  ans=$(dig +short +time=2 +tries=1 @"$HOST" -p "$PORT" "$domain" A | head -n1)
  if [[ "$ans" != "0.0.0.0" ]]; then
    echo "NON BLOQUÉ: $domain -> ${ans:-aucune réponse}"
    fail=1
  fi
done < <(grep '^0.0.0.0' "$LIST")
exit $fail
