#!/usr/bin/env bash
# Construit dist/com.apos.launcher_<version>_all.ipk à partir de app/.
# Paquet « propre », publiable : ni tests, ni photos, ni icônes des apps de la TV, ni liste d'apps, ni données de
# temps d'écran. Ces éléments personnels sont restaurés sur la TV par le service (voir sync-assets.sh).
# Les tests et fichiers de suivi ne sont pas embarqués. Échec si une référence
# distante (http/https) se trouve dans le code ou les pages de l'app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ARES_PACKAGE="${ARES_PACKAGE:-ares-package}"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp -R "$ROOT/app/." "$STAGE/"
rm -rf "$STAGE/tests" "$STAGE/data" "$STAGE/assets/icons" "$STAGE/config/launchpoints.json"
find "$STAGE/assets/wallpapers" -type f -delete 2>/dev/null || true
find "$STAGE" \( -name .gitkeep -o -name .DS_Store \) -delete

# seule exception : l'API locale du service de temps d'écran (127.0.0.1, jamais Internet)
if grep -rEn 'https?://' "$STAGE" --include='*.js' --include='*.html' --include='*.css' --include='*.json' | grep -v -F -e 'http://127.0.0.1:8742' -e 'http://www.w3.org/2000/svg'; then
  echo "Référence distante détectée dans le paquet : abandon." >&2
  exit 1
fi

mkdir -p "$ROOT/dist"
"$ARES_PACKAGE" "$STAGE" -o "$ROOT/dist/"
ls "$ROOT"/dist/com.apos.launcher_*.ipk
