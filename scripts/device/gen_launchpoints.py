#!/usr/bin/env python3
"""Génère config/launchpoints.json et assets/icons/ pour le launcher ApOS.

S'exécute sur la TV (python3, bibliothèque standard seulement), en root, car une app
web ne peut pas lister les apps via Luna (groupe « applications.internal » refusé).
Usage : python3 gen_launchpoints.py <dossier-app-apos> <racine-apps> [<racine-apps> ...]
"""
import json
import os
import re
import shutil
import sys

EXCLUDED = ("com.apos.launcher", "com.webos.app.home")
SAFE_ID = re.compile(r"^[A-Za-z0-9._-]+$")
ICON_EXT = (".png", ".jpg", ".jpeg", ".webp")
MAX_ICON_BYTES = 300 * 1024


def read_info(path):
    try:
        with open(path, "r") as f:
            info = json.load(f)
    except (OSError, ValueError):
        return None
    return info if isinstance(info, dict) else None


def pick_icon(app_dir, info):
    """Chemin absolu d'une icône située dans le dossier de l'app, ou None."""
    for key in ("icon", "largeIcon"):
        rel = info.get(key)
        if not isinstance(rel, str) or not rel:
            continue
        full = os.path.realpath(os.path.join(app_dir, rel))
        if not full.startswith(os.path.realpath(app_dir) + os.sep):
            continue
        if os.path.splitext(full)[1].lower() not in ICON_EXT:
            continue
        if os.path.isfile(full) and os.path.getsize(full) <= MAX_ICON_BYTES:
            return full
    return None


def scan(roots, out_dir):
    icons_dir = os.path.join(out_dir, "assets", "icons")
    apps = []
    seen = set()
    for root in roots:
        if not os.path.isdir(root):
            continue
        for name in sorted(os.listdir(root)):
            app_dir = os.path.join(root, name)
            info = read_info(os.path.join(app_dir, "appinfo.json"))
            if info is None:
                continue
            app_id = info.get("id")
            if not isinstance(app_id, str) or not SAFE_ID.match(app_id):
                continue
            if info.get("visible") is False or app_id in EXCLUDED or app_id in seen:
                continue
            seen.add(app_id)
            title = info.get("title") if isinstance(info.get("title"), str) and info.get("title") else app_id
            icon_rel = ""
            source = pick_icon(app_dir, info)
            if source:
                if not os.path.isdir(icons_dir):
                    os.makedirs(icons_dir)
                dest_name = app_id + os.path.splitext(source)[1].lower()
                shutil.copyfile(source, os.path.join(icons_dir, dest_name))
                icon_rel = "assets/icons/" + dest_name
            apps.append({"id": app_id, "title": title, "icon": icon_rel})
    apps.sort(key=lambda a: a["title"].lower())
    return apps


def main(argv):
    if len(argv) < 2:
        sys.stderr.write("usage: gen_launchpoints.py <dossier-app> <racine-apps>...\n")
        return 2
    out_dir, roots = argv[0], argv[1:]
    apps = scan(roots, out_dir)
    config_dir = os.path.join(out_dir, "config")
    if not os.path.isdir(config_dir):
        os.makedirs(config_dir)
    with open(os.path.join(config_dir, "launchpoints.json"), "w") as f:
        json.dump({"apps": apps}, f, ensure_ascii=False, indent=1)
    print("{} apps écrites".format(len(apps)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
