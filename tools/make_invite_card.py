#!/usr/bin/env python3
"""Build docs/images/invite-card.jpg (1200x630) — the picture used in invite emails and link previews."""
import os, random
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PH = os.path.join(ROOT, "docs/images/photos/photo-4.jpg")   # the whole crew at the fireplace
OUT = os.path.join(ROOT, "docs/images/invite-card.jpg")
XM = "/usr/share/fonts/truetype/sand-box/google/Mountains of Christmas/MountainsofChristmas-Bold.ttf"
NU = "/usr/share/fonts/truetype/sand-box/google/Nunito/Nunito-VariableFont_wght.ttf"
W, H, PW = 1200, 630, 560
def nunito(size, wght=800):
    f = ImageFont.truetype(NU, size)
    try: f.set_variation_by_axes([wght])
    except Exception: pass
    return f
# background: deep night-blue gradient
card = Image.new("RGB", (W, H))
d = ImageDraw.Draw(card)
for y in range(H):
    t = y / H; d.line([(0, y), (W, y)], fill=(int(11 + 30 * t), int(26 + 6 * t), int(51 - 10 * t)))
# snow dots
random.seed(7)
snow = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(snow)
for _ in range(170):
    x, y, r = random.randint(PW, W), random.randint(0, H), random.uniform(1, 3.2)
    sd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, random.randint(90, 200)))
card.paste(snow, (0, 0), snow)
# photo on the left, with soft fade into the panel
ph = ImageOps.fit(Image.open(PH).convert("RGB"), (PW + 60, H), centering=(0.5, 0.35))
mask = Image.new("L", ph.size, 255); md = ImageDraw.Draw(mask)
for x in range(PW - 40, PW + 60):
    md.line([(x, 0), (x, H)], fill=int(255 * max(0, 1 - (x - (PW - 40)) / 100)))
card.paste(ph, (0, 0), mask)
d = ImageDraw.Draw(card)
# string of lights along the top
cols = [(255, 70, 70), (255, 210, 63), (60, 200, 110), (80, 160, 255)]
d.line([(0, 14), (W, 14)], fill=(30, 40, 30), width=3)
for i, x in enumerate(range(18, W, 44)):
    c = cols[i % 4]
    glow = Image.new("RGBA", (40, 40), (0, 0, 0, 0)); ImageDraw.Draw(glow).ellipse([8, 8, 32, 32], fill=c + (120,))
    glow = glow.filter(ImageFilter.GaussianBlur(5)); card.paste(glow, (x - 20, 6), glow)
    d.ellipse([x - 6, 16, x + 6, 32], fill=c)
# text panel
cx = PW + (W - PW) // 2 + 10
def center(txt, y, font, fill, shadow=None):
    w = d.textlength(txt, font=font)
    if shadow: d.text((cx - w / 2 + 3, y + 4), txt, font=font, fill=shadow)
    d.text((cx - w / 2, y), txt, font=font, fill=fill)
center("You're invited to the", 62, nunito(30, 700), (255, 255, 255))
center("Frank Family", 100, ImageFont.truetype(XM, 82), (255, 210, 63), (140, 16, 30))
center("Christmas Eve", 186, ImageFont.truetype(XM, 82), (255, 210, 63), (140, 16, 30))
center("Party", 272, ImageFont.truetype(XM, 82), (255, 210, 63), (140, 16, 30))
center("Thursday, December 24", 386, nunito(34, 800), (255, 255, 255))
center("5:00 – 9:00 PM", 430, nunito(34, 800), (255, 255, 255))
center("Manasquan, NJ", 476, nunito(24, 600), (210, 222, 240))
# "Tap to RSVP" button
bf = nunito(30, 900); txt = "🎁  Tap to RSVP"; txt = "Tap to RSVP  ›"
bw = d.textlength(txt, font=bf) + 70
d.rounded_rectangle([cx - bw / 2, 530 + 4, cx + bw / 2, 590 + 4], 30, fill=(110, 10, 22))
d.rounded_rectangle([cx - bw / 2, 530, cx + bw / 2, 590], 30, fill=(215, 38, 61))
center(txt, 538, bf, (255, 255, 255))
card.save(OUT, "JPEG", quality=84, optimize=True, progressive=True)
print(OUT, os.path.getsize(OUT) // 1024, "KB")
