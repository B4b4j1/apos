#!/usr/bin/env bash
# Construit dist/com.apos.launcher_<version>_all.ipk à partir de app/.
# Les tests et fichiers de suivi ne sont pas embarqués. Échec si une référence
# distante (http/https) se trouve dans le code ou les pages de l'app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARES_PACKAGE="${ARES_PACKAGE:-ares-package}"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp -R "$ROOT/app/." "$STAGE/"
rm -rf "$STAGE/tests"
find "$STAGE" -name .gitkeep -delete

if grep -rEn 'https?://' "$STAGE" --include='*.js' --include='*.html' --include='*.css' --include='*.json'; then
  echo "Référence distante détectée dans le paquet : abandon." >&2
  exit 1
fi

mkdir -p "$ROOT/dist"
"$ARES_PACKAGE" "$STAGE" -o "$ROOT/dist/"
ls "$ROOT"/dist/com.apos.launcher_*.ipk
