#!/usr/bin/env python3
"""Turn face photos into round PNG cut-outs for the Elf Dance.

Usage:
  .venv/bin/python tools/make_faces.py tools/faces_src            # one face per photo (largest)
  .venv/bin/python tools/make_faces.py tools/faces_src --all      # every face found (group shots)
  .venv/bin/python tools/make_faces.py tools/faces_src --replace  # drop placeholder faces from faces.json

File name -> label: "Grandma.jpg" becomes "Grandma". Output goes to docs/images/faces/
and docs/images/faces/faces.json is updated (the invite reads that manifest).
"""
import argparse, json, os, re, sys
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "images", "faces")
MANIFEST = os.path.join(OUT, "faces.json")
SIZE = 320

def load_cascades():
    d = cv2.data.haarcascades
    return [cv2.CascadeClassifier(os.path.join(d, n)) for n in
            ("haarcascade_frontalface_default.xml", "haarcascade_frontalface_alt2.xml",
             "haarcascade_profileface.xml")]

def detect(gray, cascades):
    h, w = gray.shape
    min_side = max(40, min(h, w) // 12)
    for c in cascades:
        faces = c.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6, minSize=(min_side, min_side))
        if len(faces):
            return sorted([tuple(map(int, f)) for f in faces], key=lambda f: -f[2] * f[3])
    return []

def cutout(img: Image.Image, box):
    x, y, w, h = box
    cx, cy = x + w / 2, y + h / 2 - h * 0.08   # nudge up a bit to keep hair
    side = max(w, h) * 1.45
    l, t = int(cx - side / 2), int(cy - side / 2)
    crop = img.crop((l, t, int(l + side), int(t + side))).resize((SIZE, SIZE), Image.LANCZOS)
    mask = Image.new("L", (SIZE * 4, SIZE * 4), 0)
    ImageDraw.Draw(mask).ellipse((8, 8, SIZE * 4 - 8, SIZE * 4 - 8), fill=255)
    mask = mask.resize((SIZE, SIZE), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.2))
    out = crop.convert("RGBA")
    out.putalpha(mask)
    return out

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "face"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--all", action="store_true", help="extract every face, not just the largest")
    ap.add_argument("--replace", action="store_true", help="remove placeholder faces from the manifest")
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else []
    if a.replace:
        manifest = [m for m in manifest if not m.get("placeholder")]
    cascades = load_cascades()
    files = sorted(f for f in os.listdir(a.src) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")))
    if not files:
        sys.exit(f"No photos in {a.src}")
    for f in files:
        try:
            img = ImageOps.exif_transpose(Image.open(os.path.join(a.src, f))).convert("RGB")
        except Exception as e:
            print(f"!! {f}: can't open ({e})"); continue
        gray = cv2.equalizeHist(cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY))
        faces = detect(gray, cascades)
        label = os.path.splitext(f)[0].replace("_", " ").strip()
        if not faces:
            s = min(img.size); faces = [((img.width - s) // 2 + s // 6, (img.height - s) // 2 + s // 6, s * 2 // 3, s * 2 // 3)]
            print(f"?? {f}: no face found, used centre crop (check it)")
        for i, box in enumerate(faces if a.all else faces[:1]):
            name = label if i == 0 else f"{label} {i + 1}"
            fn = slug(name) + ".png"
            cutout(img, box).save(os.path.join(OUT, fn))
            manifest = [m for m in manifest if m["file"] != fn] + [{"file": fn, "name": name}]
            print(f"ok {f} -> images/faces/{fn}")
    json.dump(manifest, open(MANIFEST, "w"), indent=2)
    print(f"faces.json now lists {len(manifest)} faces")

if __name__ == "__main__":
    main()
