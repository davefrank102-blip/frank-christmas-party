#!/usr/bin/env python3
"""Generates cartoon placeholder faces + festive placeholder photos (run once)."""
import json, os, math, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FACES = os.path.join(ROOT, "docs/images/faces"); PH = os.path.join(ROOT, "docs/images/photos")
S = 320; K = 4
people = [("Dad", "#f1c27d", "#4a3020", "short"), ("Mom", "#ffdbac", "#b5651d", "long"),
          ("Kiddo", "#e0ac69", "#2b1b10", "curly"), ("Grandma", "#ffe0bd", "#d9d9d9", "bun"),
          ("Uncle", "#c68642", "#111111", "short"), ("Cousin", "#f6d1b0", "#e8b04a", "long")]
faces = []
for name, skin, hair, style in people:
    big = Image.new("RGBA", (S * K, S * K), (0, 0, 0, 0)); d = ImageDraw.Draw(big)
    u = lambda *v: [x * K for x in v]
    if style == "long": d.rounded_rectangle(u(50, 70, 270, 300), 90 * K, fill=hair)
    if style == "bun": d.ellipse(u(120, 10, 200, 80), fill=hair)
    d.ellipse(u(60, 55, 260, 280), fill=skin)
    if style in ("short", "long", "bun"): d.chord(u(55, 45, 265, 200), 180, 360, fill=hair)
    if style == "curly":
        for i in range(9): a = math.pi + i * math.pi / 8; d.ellipse(u(160 + 100 * math.cos(a) - 30, 165 + 100 * math.sin(a) - 30, 160 + 100 * math.cos(a) + 30, 165 + 100 * math.sin(a) + 30), fill=hair)
    for ex in (120, 200):
        d.ellipse(u(ex - 16, 150, ex + 16, 186), fill="white"); d.ellipse(u(ex - 9, 160, ex + 9, 182), fill="#222")
        d.ellipse(u(ex - 3, 163, ex + 3, 169), fill="white")
    d.ellipse(u(85, 195, 125, 225), fill=(255, 120, 120, 110)); d.ellipse(u(195, 195, 235, 225), fill=(255, 120, 120, 110))
    d.arc(u(115, 185, 205, 250), 15, 165, fill="#7a2e2e", width=7 * K)
    if style == "short" and name == "Uncle": d.chord(u(110, 225, 210, 290), 0, 180, fill=hair)
    img = big.resize((S, S), Image.LANCZOS)
    m = Image.new("L", (S * K, S * K)); ImageDraw.Draw(m).ellipse((8, 8, S * K - 8, S * K - 8), fill=255)
    bg = Image.new("RGBA", (S, S), "#fdf3e1"); bg.alpha_composite(img); bg.putalpha(m.resize((S, S), Image.LANCZOS))
    fn = f"placeholder-{name.lower()}.png"; bg.save(os.path.join(FACES, fn)); faces.append({"file": fn, "name": name, "placeholder": True})
json.dump(faces, open(os.path.join(FACES, "faces.json"), "w"), indent=2)

def font(sz):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
scenes = [("Our House", "#0b3d2e", "#1d6b4f", "house"), ("The Family", "#5a0f1c", "#a3233a", "tree"),
          ("Christmas Past", "#13254d", "#2f4f8f", "star"), ("The Tree", "#163d1f", "#2e7d32", "tree")]
photos = []
random.seed(7)
for i, (cap, c1, c2, kind) in enumerate(scenes):
    W, H = 1200, 900; img = Image.new("RGB", (W, H), c1); d = ImageDraw.Draw(img)
    for y in range(H): t = y / H; d.line([(0, y), (W, y)], fill=tuple(int(int(c1[j:j+2], 16) * (1 - t) + int(c2[j:j+2], 16) * t) for j in (1, 3, 5)))
    for _ in range(140): x, y, r = random.randint(0, W), random.randint(0, H), random.choice([2, 3, 4, 6]); d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255))
    d.rectangle((0, 720, W, H), fill="#f4f7fb")
    if kind == "house":
        d.rectangle((400, 430, 800, 720), fill="#7b4a2a"); d.polygon([(360, 440), (600, 260), (840, 440)], fill="#3b2416")
        d.rectangle((560, 580, 640, 720), fill="#2a1a0e")
        for wx in (450, 690): d.rectangle((wx - 40, 490, wx + 40, 560), fill="#ffd56b")
        for k in range(16): x = 370 + k * 30; d.ellipse((x - 7, 436 - (k % 2) * 4, x + 7, 450 - (k % 2) * 4), fill=["#ff4d4d", "#ffd23f", "#3ddc84", "#4dabff"][k % 4])
    elif kind == "tree":
        for k, (w, y) in enumerate([(340, 680), (270, 560), (200, 450), (130, 350)]): d.polygon([(600 - w, y), (600, y - 170), (600 + w, y)], fill="#1f7a3a")
        d.rectangle((570, 680, 630, 740), fill="#5b3a1e")
        for _ in range(28): x, y = random.randint(380, 820), random.randint(260, 660); d.ellipse((x - 11, y - 11, x + 11, y + 11), fill=random.choice(["#ff4d4d", "#ffd23f", "#4dabff", "#ff8fd1"]))
        d.polygon([(600, 150), (620, 200), (672, 200), (630, 230), (646, 282), (600, 250), (554, 282), (570, 230), (528, 200), (580, 200)], fill="#ffd23f")
    else:
        d.polygon([(600, 200), (640, 330), (780, 330), (668, 410), (710, 540), (600, 460), (490, 540), (532, 410), (420, 330), (560, 330)], fill="#ffd23f")
    d.rounded_rectangle((300, 770, 900, 870), 30, fill=(255, 255, 255))
    f = font(46); tw = d.textlength(f"{cap} — photo coming soon", font=f)
    d.text(((W - tw) / 2, 795), f"{cap} — photo coming soon", font=f, fill=c1)
    fn = f"placeholder-{i + 1}.jpg"; img.save(os.path.join(PH, fn), quality=85); photos.append({"file": fn, "caption": cap, "placeholder": True})
json.dump(photos, open(os.path.join(PH, "photos.json"), "w"), indent=2)
print("done")
