#!/usr/bin/env bash
# Publie ApOS sur GitHub pour Homebrew Channel : crée le dépôt public si besoin, génère l'index et le manifeste
# (repo/), pousse, puis publie le .ipk comme release. Exige que gh soit connecté AU COMPTE <owner>.
# Usage : publish.sh <owner> <repo> [--dry-run]
set -euo pipefail
OWNER="${1:?usage: publish.sh <owner> <repo> [--dry-run]}"
REPO="${2:?usage: publish.sh <owner> <repo> [--dry-run]}"
DRY="${3:-}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
ARES_PACKAGE="${ARES_PACKAGE:-$ROOT/build/cli/node_modules/.bin/ares-package}"
export ARES_PACKAGE

LOGIN="$(gh api user --jq .login)"
if [ "$(echo "$LOGIN" | tr '[:upper:]' '[:lower:]')" != "$(echo "$OWNER" | tr '[:upper:]' '[:lower:]')" ]; then
  echo "gh est connecté en tant que « $LOGIN », pas « $OWNER » : lancer « gh auth login » avec le bon compte." >&2
  exit 1
fi

VERSION="$(python3 -c 'import json;print(json.load(open("app/appinfo.json"))["version"])')"
TAG="v$VERSION"
find dist -maxdepth 1 -name '*.ipk' -delete 2>/dev/null || true
bash scripts/app/package.sh >/dev/null
IPK="$(ls dist/com.apos.launcher_*.ipk | tail -n1)"
python3 scripts/app/make_repo.py --owner "$OWNER" --repo "$REPO" --tag "$TAG" --ipk "$IPK" --appinfo app/appinfo.json --out repo

echo "dépôt : https://github.com/$OWNER/$REPO ; version $TAG ; paquet $IPK"
echo "URL à ajouter dans Homebrew Channel : https://raw.githubusercontent.com/$OWNER/$REPO/main/repo/index.json"
[ "$DRY" = "--dry-run" ] && { echo "(simulation : rien n'est publié)"; exit 0; }

if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$OWNER/$REPO" --public --description "ApOS : lanceur webOS local, sans publicité ni télémétrie (temps d'écran, fonds d'écran, limites)" --source . --remote origin
fi
git add repo
git diff --cached --quiet || git commit -q -m "chore: repository index for $TAG"
git push -u origin HEAD:main
if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "$IPK" --clobber
else
  gh release create "$TAG" "$IPK" --title "ApOS $VERSION" --notes "Paquet webOS d'ApOS $VERSION. Ajouter l'index dans Homebrew Channel : https://raw.githubusercontent.com/$OWNER/$REPO/main/repo/index.json"
fi
echo "publié."
