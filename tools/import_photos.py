#!/usr/bin/env python3
"""Resize + strip ALL metadata (EXIF/GPS) from real photos and publish them to the slideshow.
Usage: .venv/bin/python tools/import_photos.py <src.jpg> "<caption>" [<src.jpg> "<caption>" ...]
Order on the command line = slideshow order. Replaces photos.json entirely.
"""
import json, os, sys
from PIL import Image, ImageOps
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs/images/photos")
args = sys.argv[1:]
if not args or len(args) % 2: sys.exit(__doc__)
manifest = []
for i in range(0, len(args), 2):
    src, cap = args[i], args[i + 1]
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")   # bake rotation, then drop EXIF
    im.thumbnail((1600, 1600), Image.LANCZOS)
    clean = Image.new("RGB", im.size); clean.paste(im)               # fresh image = no metadata carried over
    fn = f"photo-{i // 2 + 1}.jpg"
    clean.save(os.path.join(OUT, fn), "JPEG", quality=82, optimize=True, progressive=True)
    chk = Image.open(os.path.join(OUT, fn))
    assert not chk.getexif() and "icc_profile" not in chk.info and "exif" not in chk.info, fn
    manifest.append({"file": fn, "caption": cap}); print("ok", fn, clean.size, cap)
for f in os.listdir(OUT):
    if f.startswith("placeholder-"): os.remove(os.path.join(OUT, f))
json.dump(manifest, open(os.path.join(OUT, "photos.json"), "w"), indent=2)
