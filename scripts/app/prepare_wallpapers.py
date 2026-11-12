#!/usr/bin/env python3
"""Prépare les fonds d'écran pour la TV : 1920x1080, JPEG léger, sans EXIF/GPS, avec vignettes.

Usage : build/venv/bin/python scripts/app/prepare_wallpapers.py <dossier-originaux> <app/assets/wallpapers>
Écrit wp-NN.jpg, wp-NN-thumb.jpg (480x270) et index.json dans le dossier de sortie.
Les originaux (plusieurs dizaines de Mo, avec position GPS) ne sont jamais copiés dans l'app.
"""
import json
import os
import sys

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

WIDTH, HEIGHT = 1920, 1080
THUMB = (480, 270)
EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
LANCZOS = Image.Resampling.LANCZOS


def fit_image(img):
    """Image 16:9 de 1920x1080 : recadrée si proche du 16:9, sinon centrée sur un fond flouté."""
    img = ImageOps.exif_transpose(img).convert("RGB")
    if img.width / img.height >= 1.4:
        return ImageOps.fit(img, (WIDTH, HEIGHT), LANCZOS)
    small = ImageOps.fit(img, (WIDTH // 10, HEIGHT // 10), LANCZOS).filter(ImageFilter.GaussianBlur(6))
    background = ImageEnhance.Brightness(small.resize((WIDTH, HEIGHT), LANCZOS)).enhance(0.55)
    front = ImageOps.contain(img, (WIDTH, HEIGHT), LANCZOS)
    background.paste(front, ((WIDTH - front.width) // 2, (HEIGHT - front.height) // 2))
    return background


def main(argv):
    if len(argv) != 2:
        sys.stderr.write("usage: prepare_wallpapers.py <originaux> <sortie>\n")
        return 2
    src, out = argv
    names = sorted(n for n in os.listdir(src) if n.lower().endswith(EXTENSIONS))
    if not os.path.isdir(out):
        os.makedirs(out)
    for old in os.listdir(out):
        if old.startswith("wp-") or old == "index.json":
            os.remove(os.path.join(out, old))
    index = []
    total = 0
    for i, name in enumerate(names, start=1):
        with Image.open(os.path.join(src, name)) as img:
            if img.format == "JPEG":
                img.draft("RGB", (WIDTH * 2, HEIGHT * 2))  # décodage JPEG réduit : bien plus rapide sur les 8064x6048
            fitted = fit_image(img)
        wid = "wp-{:02d}".format(i)
        main_path = os.path.join(out, wid + ".jpg")
        thumb_path = os.path.join(out, wid + "-thumb.jpg")
        fitted.save(main_path, "JPEG", quality=82, optimize=True, progressive=True)  # aucun EXIF écrit
        fitted.resize(THUMB, LANCZOS).save(thumb_path, "JPEG", quality=80, optimize=True)
        total += os.path.getsize(main_path) + os.path.getsize(thumb_path)
        index.append({"id": wid, "title": "Photo {}".format(i), "src": "assets/wallpapers/" + wid + ".jpg",
                      "thumb": "assets/wallpapers/" + wid + "-thumb.jpg"})
    with open(os.path.join(out, "index.json"), "w") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print("{} photos, {:.1f} Mo au total".format(len(index), total / 1048576))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
