#!/usr/bin/env bash
# Prépare un dépôt local (dist/repo/) : copie le .ipk et écrit son manifeste
# (champs repris du manifeste publié par Homebrew Channel 0.7.3 : id, version,
# type, title, ipkUrl relatif, ipkHash.sha256). Ne touche pas au réseau.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REPO="$ROOT/dist/repo"
IPK=$(ls "$ROOT"/dist/com.apos.launcher_*.ipk | tail -n1)
mkdir -p "$REPO"
cp "$IPK" "$REPO/"
NAME="$(basename "$IPK")"
SHA=$(shasum -a 256 "$IPK" | cut -d' ' -f1)
python3 - "$ROOT/app/appinfo.json" "$NAME" "$SHA" "$REPO/com.apos.launcher.manifest.json" <<'PY'
import json, sys
info = json.load(open(sys.argv[1]))
manifest = {
    "id": info["id"],
    "version": info["version"],
    "type": info["type"],
    "title": info["title"],
    "appDescription": "Lanceur local ApOS : fonds d'écran et réglages, sans réseau",
    "iconUri": "com.apos.launcher_icon.png",
    "rootRequired": False,
    "ipkUrl": sys.argv[2],
    "ipkHash": {"sha256": sys.argv[3]},
}
json.dump(manifest, open(sys.argv[4], "w"), ensure_ascii=False, indent=2)
PY
cp "$ROOT/app/icon.png" "$REPO/com.apos.launcher_icon.png"
echo "dépôt prêt : $REPO"
