#!/usr/bin/env python3
"""Turn face photos into round PNG cut-outs for the Elf Dance.

Usage:
  # JibJab-style cut-outs (face-contour mask from MediaPipe face landmarks, hair kept for the hat, feathered edge):
  .venv/bin/python tools/make_faces.py <photo.jpg or folder> --cutout --replace --names "Dylan,David,Juliette,Brielle,Krissy"
    (needs: pip install mediapipe; model file tools/models/face_landmarker.task from
     https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task)
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
    """Largest-first face boxes."""
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


# ---------------------------------------------------------------- JibJab-style cut-outs
# Output canvas: CW x CH. Every face is rotated upright (eye line level) and scaled so the
# forehead landmark (10) sits at y=TOP and the chin (152) at y=CHIN -> heads line up on every elf.
CW, CH, TOP, CHIN = 300, 390, 118, 362
OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
        148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
MODEL = os.path.join(ROOT, "tools", "models", "face_landmarker.task")

def landmarker():
    import mediapipe as mp
    from mediapipe.tasks.python import vision, BaseOptions
    if not os.path.exists(MODEL): sys.exit(f"missing {MODEL} (see usage)")
    det = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=BaseOptions(model_asset_path=MODEL), num_faces=1))
    def run(img):
        r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(np.array(img))))
        return [(p.x * img.width, p.y * img.height) for p in r.face_landmarks[0]] if r.face_landmarks else None
    return run

def cutout_jibjab(img, box, run):
    """crop around a detected face box, find 478 landmarks, return (RGBA cut-out, skin hex)."""
    x, y, w, h = box; s = int(max(w, h) * 2.8); cx, cy = x + w / 2, y + h / 2
    l, t = int(cx - s / 2), int(cy - s / 2)
    crop = img.crop((l, t, l + s, t + s)); scale = 768 / s
    pts = run(crop.resize((768, 768), Image.LANCZOS))
    if not pts: return None
    P = np.array(pts) / scale + (l, t)                               # landmarks in original-image pixels
    le, re_ = P[[33, 133, 159, 145]].mean(0), P[[263, 362, 386, 374]].mean(0)
    ang = np.degrees(np.arctan2(re_[1] - le[1], re_[0] - le[0]))
    top, chin = P[10], P[152]; k = (CHIN - TOP) / np.linalg.norm(chin - top)
    mid = (P[234] + P[454]) / 2
    # affine: rotate by -ang around the face, scale k, put mid-face x at CW/2 and forehead at TOP
    a = np.radians(-ang); R = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]]) * k
    def T(q): return (np.atleast_2d(q) - mid) @ R.T
    off = np.array([CW / 2, TOP]) - T(top)[0] * [0, 1] - [0, 0]; off[0] = CW / 2
    Q = T(P) + off
    inv = np.linalg.inv(R); M = np.hstack([inv, (mid - off @ inv.T)[:, None]])  # output -> source
    face = img.transform((CW, CH), Image.AFFINE, M.flatten().tolist(), Image.BICUBIC)
    # mask: face oval, upper half pushed up/out to keep the hairline (the hat covers it), lower half a touch wider
    oval = Q[OVAL]; c = np.array([CW / 2, Q[[33, 263]][:, 1].mean()]); out = []
    for p in oval:
        d = p - c
        ty = max(0.0, -d[1]) / max(1.0, c[1] - Q[10][1])          # 0 at eye line -> 1 at forehead
        out.append(c + d * ((1.10 + .14 * ty, 1.45 + .35 * ty) if d[1] < 0 else (1.09 - .05 * min(1, d[1] / (CHIN - c[1])), 1.03)))
    out = np.array(out); out[:, 1] = np.maximum(out[:, 1], 6)
    big = Image.new("L", (CW * 4, CH * 4), 0); ImageDraw.Draw(big).polygon([tuple(q * 4) for q in out], fill=255)
    mask = big.resize((CW, CH), Image.LANCZOS).filter(ImageFilter.GaussianBlur(4.0))
    m = np.array(mask).astype(np.float32) / 255; m = np.clip((m - .08) / .84, 0, 1) ** 1.2   # soft but not mushy
    from PIL import ImageEnhance
    face = ImageEnhance.Contrast(ImageEnhance.Brightness(face).enhance(1.08)).enhance(1.05)
    res = face.convert("RGBA"); res.putalpha(Image.fromarray((m * 255).astype("uint8")))
    # skin tone from both cheeks (for the neck + hands)
    arr = np.array(face).reshape(-1, 3)
    samp = []
    for idx in (50, 280, 205, 425):
        qx, qy = Q[idx].astype(int); samp.append(np.array(face)[qy - 6:qy + 6, qx - 6:qx + 6].reshape(-1, 3))
    sk = np.median(np.vstack(samp), 0)
    sk = np.clip(sk * .55 + np.array([246, 204, 170]) * .45, 0, 255).astype(int)   # cartoon-friendly: brighter, matches the face
    skin = "#%02x%02x%02x" % tuple(int(v) for v in sk)
    return res, skin

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "face"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--all", action="store_true", help="extract every face, not just the largest")
    ap.add_argument("--replace", action="store_true", help="remove placeholder faces from the manifest")
    ap.add_argument("--cutout", action="store_true", help="JibJab-style face-contour cut-outs (needs mediapipe), saved as .webp")
    ap.add_argument("--names", help='comma list, assigned to faces LEFT-TO-RIGHT in a group photo (implies --all), e.g. "David,Krissy,Brielle"')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else []
    if a.replace:
        manifest = [m for m in manifest if not m.get("placeholder")]
    cascades = load_cascades()
    src_dir, only = (a.src, None) if os.path.isdir(a.src) else (os.path.dirname(a.src) or ".", os.path.basename(a.src))
    a.src = src_dir
    run = landmarker() if a.cutout else None
    files = sorted(f for f in os.listdir(a.src) if (only is None or f == only) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic")))
    if not files:
        sys.exit(f"No photos in {a.src}")
    for f in files:
        try:
            img = ImageOps.exif_transpose(Image.open(os.path.join(a.src, f))).convert("RGB"); img.info.clear()
        except Exception as e:
            print(f"!! {f}: can't open ({e})"); continue
        gray = cv2.equalizeHist(cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY))
        faces = detect(gray, cascades)
        label = os.path.splitext(f)[0].replace("_", " ").strip()
        if not faces:
            s = min(img.size); faces = [((img.width - s) // 2 + s // 6, (img.height - s) // 2 + s // 6, s * 2 // 3, s * 2 // 3)]
            print(f"?? {f}: no face found, used centre crop (check it)")
        names = [n.strip() for n in a.names.split(",")] if a.names else None
        if names:
            faces = sorted(faces[:len(names)], key=lambda f: f[0])
            if len(faces) < len(names): print(f"!! {f}: found {len(faces)} faces but {len(names)} names - check labels")
        for i, box in enumerate(faces if (a.all or names) else faces[:1]):
            name = names[i] if names and i < len(names) else (label if i == 0 else f"{label} {i + 1}")
            entry = {"name": name}
            if run:
                got = cutout_jibjab(img, box, run)
                if not got: print(f"!! {f}: no landmarks for {name}, skipped"); continue
                face, entry["skin"] = got; fn = slug(name) + ".webp"
                clean = Image.new("RGBA", face.size); clean.paste(face)            # fresh image -> no metadata
                clean.save(os.path.join(OUT, fn), "WEBP", quality=86, method=6)
                entry["cutout"] = True
            else:
                fn = slug(name) + ".png"
                cutout(img, box).save(os.path.join(OUT, fn))
            entry = {"file": fn, **entry}
            manifest = [m for m in manifest if m["name"] != name] + [entry]
            print(f"ok {f} -> images/faces/{fn}")
    json.dump(manifest, open(MANIFEST, "w"), indent=2)
    print(f"faces.json now lists {len(manifest)} faces")

if __name__ == "__main__":
    main()
