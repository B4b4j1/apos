#!/usr/bin/env python3
"""Prépare les compagnons de l'accueil à partir des planches sources (companions-src/<id>/*.png).

Pour chaque compagnon : recadre toutes les têtes sur une même boîte (elles ne « sautent » pas d'une humeur à l'autre),
réduit en WebP avec transparence, détecte les yeux vides (blancs, sans pupille) des têtes pour y poser la pupille,
puis écrit app/assets/companions/<id>/*.webp et app/js/companion-data.js.

Usage : python scripts/app/build-companions.py   (nécessite Pillow ; voir build/venv)
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "companions-src")
OUT = os.path.join(ROOT, "app", "assets", "companions")
DATA_JS = os.path.join(ROOT, "app", "js", "companion-data.js")

HEAD = 320
POSE = 360
PUPIL = 64
SCAN = 512

LABELS = {"cat": "Chat", "unicorn": "Licorne", "rabbit": "Lapin"}
ORDER = ["cat", "unicorn", "rabbit"]
# humeur ApOS -> (fichier source, type)
MOODS = {
    "idle": ("neutral", "head"),
    "happy": ("happy", "head"),
    "curious": ("curious", "head"),
    "worried": ("worried", "head"),
    "proud": ("proud", "head"),
    "sleepy": ("pose-sleep", "pose"),
    "surprised": ("pose-jump", "pose"),
}


def alpha_bbox(im, threshold=16):
    return im.getchannel("A").point(lambda v: 255 if v > threshold else 0).getbbox()


def union_box(images):
    boxes = [alpha_bbox(im) for im in images]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def square_crop(box, size_hint=0.04):
    """Boîte carrée centrée sur la boîte donnée, avec une petite marge."""
    w, h = box[2] - box[0], box[3] - box[1]
    side = int(max(w, h) * (1 + size_hint * 2))
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    left, top = int(round(cx - side / 2)), int(round(cy - side / 2))
    return (left, top, left + side, top + side)


def crop_to(im, box):
    canvas = Image.new("RGBA", (box[2] - box[0], box[3] - box[1]), (0, 0, 0, 0))
    canvas.paste(im, (-box[0], -box[1]))
    return canvas


def find_eyes(im):
    """Deux régions blanches arrondies entourées par le contour (les yeux vides). Coordonnées en fraction de l'image."""
    small = im.resize((SCAN, SCAN), Image.LANCZOS)
    px = small.load()
    light = bytearray(SCAN * SCAN)
    for y in range(SCAN):
        for x in range(SCAN):
            r, g, b, a = px[x, y]
            if a >= 250 and min(r, g, b) >= 238:
                light[y * SCAN + x] = 1
    seen = bytearray(SCAN * SCAN)
    comps = []
    for start in range(SCAN * SCAN):
        if not light[start] or seen[start]:
            continue
        stack = [start]
        seen[start] = 1
        n = sx = sy = 0
        x0 = y0 = SCAN
        x1 = y1 = 0
        while stack:
            p = stack.pop()
            x, y = p % SCAN, p // SCAN
            n += 1
            sx += x
            sy += y
            x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
            for q in (p - 1 if x > 0 else -1, p + 1 if x < SCAN - 1 else -1, p - SCAN if y > 0 else -1, p + SCAN if y < SCAN - 1 else -1):
                if q >= 0 and light[q] and not seen[q]:
                    seen[q] = 1
                    stack.append(q)
        bw, bh = x1 - x0 + 1, y1 - y0 + 1
        if 500 <= n <= 22000 and 0.5 <= bw / bh <= 1.9 and n / (3.14159 / 4 * bw * bh) >= 0.72:
            comps.append({"area": n, "cx": sx / n, "cy": sy / n, "w": bw, "h": bh})
    best = None
    for i in range(len(comps)):
        for j in range(i + 1, len(comps)):
            a, b = comps[i], comps[j]
            if abs(a["cy"] - b["cy"]) > SCAN * 0.06 or abs(a["cx"] - b["cx"]) < SCAN * 0.15:
                continue
            if max(a["area"], b["area"]) > 1.6 * min(a["area"], b["area"]):
                continue
            score = a["area"] + b["area"]
            if best is None or score > best[0]:
                best = (score, sorted([a, b], key=lambda c: c["cx"]))
    if best is None:
        return None
    return [{"x": round(c["cx"] / SCAN, 4), "y": round(c["cy"] / SCAN, 4), "w": round(c["w"] / SCAN, 4), "h": round(c["h"] / SCAN, 4)} for c in best[1]]


def save_webp(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=84, method=6)
    return os.path.getsize(path)


def build(cid):
    src = os.path.join(SRC, cid)
    load = lambda name: Image.open(os.path.join(src, name + ".png")).convert("RGBA")
    heads = {m: load(f) for m, (f, kind) in MOODS.items() if kind == "head"}
    poses = {m: load(f) for m, (f, kind) in MOODS.items() if kind == "pose"}
    head_box = square_crop(union_box(list(heads.values())))
    pose_box = square_crop(union_box(list(poses.values())))
    moods = {}
    total = 0
    for m, (fname, kind) in MOODS.items():
        im = heads[m] if kind == "head" else poses[m]
        box = head_box if kind == "head" else pose_box
        size = HEAD if kind == "head" else POSE
        cropped = crop_to(im, box)
        eyes = find_eyes(cropped) if kind == "head" else None
        out = cropped.resize((size, size), Image.LANCZOS)
        total += save_webp(out, os.path.join(OUT, cid, m + ".webp"))
        entry = {"img": "assets/companions/%s/%s.webp" % (cid, m)}
        if kind == "head" and eyes:
            entry["eyes"] = eyes
        if kind == "head" and m in ("idle", "curious", "worried") and not eyes:
            print("  ATTENTION : yeux non détectés pour %s/%s" % (cid, m), file=sys.stderr)
        moods[m] = entry
    pupil = load("pupil")
    pupil = pupil.crop(alpha_bbox(pupil)).resize((PUPIL, PUPIL), Image.LANCZOS)
    total += save_webp(pupil, os.path.join(OUT, cid, "pupil.webp"))
    print("%-8s %6.1f Ko  %s" % (cid, total / 1024, {m: len(v.get("eyes", [])) for m, v in moods.items()}))
    return {"label": LABELS[cid], "pupil": "assets/companions/%s/pupil.webp" % cid, "moods": moods}


def main():
    data = {}
    for cid in ORDER:
        data[cid] = build(cid)
    lines = [
        "// Généré par scripts/app/build-companions.py : ne pas modifier à la main.",
        "// Positions des yeux en fraction (0 à 1) de l'image de la tête ; les humeurs sans yeux n'ont pas de pupille mobile.",
        "export const COMPANION_ORDER = %s;" % json.dumps(ORDER),
        "export const COMPANIONS = %s;" % json.dumps(data, indent=2, ensure_ascii=False),
        "",
    ]
    with open(DATA_JS, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("écrit", os.path.relpath(DATA_JS, ROOT))


if __name__ == "__main__":
    main()
