#!/usr/bin/env python3
"""Génère le dépôt Homebrew Channel d'ApOS (repo/index.json et repo/<id>.manifest.json) pour GitHub.

Le paquet .ipk est publié comme pièce jointe d'une « release » GitHub ; l'index et le manifeste sont lus
par Homebrew Channel depuis raw.githubusercontent.com. URL à ajouter dans Homebrew Channel :
  https://raw.githubusercontent.com/<owner>/<repo>/<branche>/repo/index.json
"""
import argparse
import hashlib
import json
import os
import re
import sys

SAFE = re.compile(r"^[A-Za-z0-9._-]+$")


def main(argv):
    parser = argparse.ArgumentParser()
    parser.add_argument("--owner", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--branch", default="main")
    parser.add_argument("--ipk", required=True)
    parser.add_argument("--appinfo", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    for value in (args.owner, args.repo, args.tag, args.branch):
        if not SAFE.match(value):
            sys.exit("valeur invalide : " + value)

    with open(args.appinfo) as f:
        info = json.load(f)
    with open(args.ipk, "rb") as f:
        sha256 = hashlib.sha256(f.read()).hexdigest()
    ipk_name = os.path.basename(args.ipk)
    web = "https://github.com/%s/%s" % (args.owner, args.repo)
    raw = "https://raw.githubusercontent.com/%s/%s/%s" % (args.owner, args.repo, args.branch)
    manifest = {
        "id": info["id"],
        "version": info["version"],
        "type": info["type"],
        "title": info["title"],
        "appDescription": "Lanceur local ApOS : apps, fonds d'écran, temps d'écran, sans publicité ni télémétrie",
        "iconUri": raw + "/app/icon.png",
        "sourceUrl": web,
        "rootRequired": False,
        "ipkUrl": "%s/releases/download/%s/%s" % (web, args.tag, ipk_name),
        "ipkHash": {"sha256": sha256},
    }
    entry = dict(manifest)
    entry["manifestUrl"] = "%s/repo/%s.manifest.json" % (raw, info["id"])
    os.makedirs(args.out, exist_ok=True)
    with open(os.path.join(args.out, info["id"] + ".manifest.json"), "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(os.path.join(args.out, "index.json"), "w") as f:
        json.dump({"packages": [entry]}, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print("dépôt généré dans %s (paquet %s, sha256 %s…)" % (args.out, ipk_name, sha256[:12]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
