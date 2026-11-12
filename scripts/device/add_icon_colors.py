#!/usr/bin/env python3
"""Ajoute à config/launchpoints.json une couleur de tuile par app (moyenne du bord de l'icône).

Usage : build/venv/bin/python scripts/device/add_icon_colors.py <copie-locale-du-dossier-app>
Une icône dont le bord est transparent n'a pas de couleur (tuile neutre).
"""
import json
import os
import sys

from PIL import Image

GRID = 16
MIN_OPAQUE_RATIO = 0.8


def edge_color(path):
    with Image.open(path) as img:
        small = img.convert("RGBA").resize((GRID, GRID), Image.Resampling.BILINEAR)
    pixels = small.load()
    ring = [pixels[x, y] for x in range(GRID) for y in range(GRID) if x in (0, GRID - 1) or y in (0, GRID - 1)]
    opaque = [p for p in ring if p[3] >= 200]
    if len(opaque) < MIN_OPAQUE_RATIO * len(ring):
        return None
    r = sum(p[0] for p in opaque) // len(opaque)
    g = sum(p[1] for p in opaque) // len(opaque)
    b = sum(p[2] for p in opaque) // len(opaque)
    return "#{:02x}{:02x}{:02x}".format(r, g, b)


def main(argv):
    if len(argv) != 1:
        sys.stderr.write("usage: add_icon_colors.py <dossier-app>\n")
        return 2
    root = argv[0]
    path = os.path.join(root, "config", "launchpoints.json")
    with open(path) as f:
        data = json.load(f)
    colored = 0
    for app in data.get("apps", []):
        app.pop("color", None)
        icon = app.get("icon")
        if not icon:
            continue
        full = os.path.join(root, icon)
        if os.path.isfile(full):
            color = edge_color(full)
            if color:
                app["color"] = color
                colored += 1
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print("{} couleurs d'icônes calculées".format(colored))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
