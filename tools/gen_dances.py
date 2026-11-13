#!/usr/bin/env python3
"""Generate the tap-an-elf pop-culture dances -> docs/dances.css + docs/dances.js.

Poses are written in a mirrored "outward" convention so dances read naturally:
  aL / aR = (upper-arm angle, forearm bend)  0 = hanging down, 90 = straight out to that side, 180 = straight up;
            negative upper = across the body. Forearm bend is relative to the upper arm (+ = keeps turning the same way).
  lL / lR = (leg angle outward, lift px)    lift < 0 raises the leg.
  b = body (x, y, rotate)    h = head (rotate, x, y)
Everything animates `transform` only (smooth on phones). Run: python3 tools/gen_dances.py
"""
import json, os
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
N = dict(aL=(0, 0), aR=(0, 0), lL=(0, 0), lR=(0, 0), b=(0, 0, 0), h=(0, 0, 0))
def P(**k): return {**N, **k}
def mirror(p):
    q = dict(p); q["aL"], q["aR"] = p["aR"], p["aL"]; q["lL"], q["lR"] = p["lR"], p["lL"]
    q["b"] = (-p["b"][0], p["b"][1], -p["b"][2]); q["h"] = (-p["h"][0], -p["h"][1], p["h"][2]); return q
def cycle(poses, reps, a, b):
    """repeat a list of poses `reps` times between a% and b% (closing on the first pose)."""
    out, n = [], len(poses) * reps
    for i in range(n + 1): out.append((a + (b - a) * i / n, poses[i % len(poses)]))
    return out
def hold(seq):
    """[(start%, end%, pose)] -> keyframes that hold each pose (snappy, robot-style)."""
    out = []
    for s, e, p in seq: out += [(s, p), (e, p)]
    return out

D = []  # (id, label, seconds, timing, keyframes)
# --- The Floss: straight arms swing to one side while the hips swing the other way
fl = P(aL=(42, 0), aR=(-42, 0), b=(7, 0, 4), h=(-5, 0, 0), lL=(4, 0), lR=(-4, 0))
D.append(("floss", "🦷 The Floss!", 2.9, "ease-in-out", [(0, N), (6, fl)] + cycle([fl, mirror(fl)], 5, 6, 92) + [(100, N)]))
# --- The Dab: one arm straight up-out, face buried in the other elbow; left, then right, then left
dab = P(aL=(132, 0), aR=(-112, 45), h=(-30, -8, 10), b=(-5, 3, -7), lL=(10, 0), lR=(4, 0))
D.append(("dab", "😎 The Dab!", 2.8, "cubic-bezier(.2,.9,.3,1.2)",
          [(0, N), (8, dab), (28, dab), (36, N), (44, mirror(dab)), (64, mirror(dab)), (72, N), (80, dab), (95, dab), (100, N)]))
# --- The Robot: rigid 90-degree arm poses that snap, with sharp head turns
r1 = P(aL=(90, 90), aR=(90, -90), h=(0, 0, 0), b=(0, -2, 0)); r2 = P(aL=(90, -90), aR=(90, 90), h=(16, 0, 0), b=(0, 0, 0))
r3 = P(aL=(90, 90), aR=(90, 90), h=(-16, 0, 0), b=(0, -3, 0)); r4 = P(aL=(4, 90), aR=(4, 90), h=(0, 0, 0)); r5 = P(aL=(4, 90), aR=(4, 90), h=(18, 0, 0), b=(0, -2, 0))
D.append(("robot", "🤖 The Robot!", 3.4, "linear", hold([(0, 3, N), (7, 16, r4), (20, 30, r1), (34, 44, r2), (48, 58, r3), (62, 72, r1), (76, 86, r5), (90, 96, r4), (100, 100, N)])))
# --- The Carlton: bent arms swing side to side across the body, stepping the other way
c1 = P(aL=(38, 55), aR=(-34, -58), b=(7, -2, 5), h=(8, 2, 0), lL=(3, 0), lR=(-10, -4))
D.append(("carlton", "🕺 The Carlton!", 3.0, "ease-in-out", [(0, N), (5, c1)] + cycle([c1, mirror(c1)], 6, 5, 86)
          + [(90, P(aL=(170, 20), aR=(60, -110), h=(-10, 0, 0), b=(0, -6, 0))), (97, P(aL=(170, 20), aR=(60, -110), h=(-10, 0, 0))), (100, N)]))
# --- The Macarena: arm out, arm out, palms, shoulders, head, hips, hip-roll, jump
m = [P(aR=(90, 0))]; m.append({**m[-1], "aL": (90, 0)}); m.append({**m[-1], "aR": (90, 18)}); m.append({**m[-1], "aL": (90, 18)})
m.append({**m[-1], "aR": (-62, -88)}); m.append({**m[-1], "aL": (-62, -88)}); m.append({**m[-1], "aR": (160, 105)}); m.append({**m[-1], "aL": (160, 105)})
m.append({**m[-1], "aR": (40, -105)}); m.append({**m[-1], "aL": (40, -105)})
roll = lambda x: {**m[-1], "b": (x, 0, x * .9), "h": (-x, 0, 0)}
kf = [(0, N)] + [(6 + i * 7, p if i % 2 else {**p, "h": (5, 0, 0)}) for i, p in enumerate(m)]
kf += [(77, roll(7)), (82, roll(-7)), (87, roll(7)), (91, {**m[-1], "b": (0, -16, 0), "lL": (14, -6), "lR": (14, -6)}), (95, {**m[-1], "b": (0, 0, 0)}), (100, N)]
D.append(("macarena", "💃 The Macarena!", 4.4, "ease-in-out", kf))
# --- The Moonwalk: glide backward while the feet "walk" forward (heel lifts alternate)
kf, steps = [(0, N)], 8
for i in range(steps + 1):
    x = 30 - 60 * i / steps; up = P(lL=(-8, -9), lR=(0, 0)) if i % 2 == 0 else P(lL=(0, 0), lR=(8, -9))
    kf.append((4 + 80 * i / steps, {**up, "b": (x, 0, -5), "aL": (14 + 8 * (i % 2), 20), "aR": (22 - 8 * (i % 2), 20), "h": (-6, -2, 0)}))
kf += [(92, P(b=(0, -12, 0), aL=(150, 30), aR=(30, -100), h=(8, 0, 0), lL=(6, -6))), (100, N)]
D.append(("moonwalk", "🌙 The Moonwalk!", 3.6, "linear", kf))
# --- The Griddy: high-knee heel taps with pumping arms, then the "goggles" finish
g1 = P(lL=(14, -16), aL=(30, 75), aR=(-12, 25), b=(0, -5, 4), h=(4, 0, 0)); g0 = P(b=(0, 2, 0), aL=(10, 40), aR=(10, 40))
D.append(("griddy", "🏈 The Griddy!", 3.2, "ease-in-out", [(0, N)] + cycle([g1, g0, mirror(g1), g0], 3, 2, 70)
          + [(76, P(aL=(165, 100), aR=(165, 100), b=(0, -4, 0), lL=(10, -8))), (84, P(aL=(165, 100), aR=(165, 100), lR=(10, -8))),
             (92, P(aL=(165, 100), aR=(165, 100), b=(0, -4, 0), lL=(10, -8))), (100, N)]))
# --- YMCA
y_ = P(aL=(150, 0), aR=(150, 0), b=(0, -6, 0)); m_ = P(aL=(165, 45), aR=(165, 45), b=(0, -3, 0)); c_ = P(aL=(140, 25), aR=(-75, -35), b=(-4, 0, -6), h=(-10, 0, 0))
a_ = P(aL=(165, 28), aR=(165, 28), b=(0, -8, 0))
D.append(("ymca", "🙌 Y·M·C·A!", 3.6, "cubic-bezier(.3,1.4,.5,1)", hold([(0, 2, N), (8, 22, y_), (28, 42, m_), (48, 62, c_), (68, 90, a_), (100, 100, N)])))
# --- The Running Man: knee up, slide back, swap — arms punching
rm = P(lL=(-6, -18), lR=(6, 0), aL=(20, 95), aR=(-5, 60), b=(0, -7, 2), h=(4, 0, 0)); rd = P(aL=(10, 70), aR=(10, 70), b=(0, 1, 0))
D.append(("runningman", "🏃 The Running Man!", 3.0, "ease-in-out", [(0, N)] + cycle([rm, rd, mirror(rm), rd], 3, 3, 95) + [(100, N)]))
# --- Gangnam Style: horse-ride hop with crossed wrists, then the lasso
gs = P(aL=(-28, -72), aR=(-28, -72), lL=(10, -8), b=(0, -9, 0), h=(6, 0, 0)); gd = P(aL=(-28, -72), aR=(-28, -72), b=(0, 2, 0))
kf = [(0, N)] + cycle([gs, gd, mirror(gs), gd], 2, 3, 55)
for i, f in enumerate([0, 70, 140, 70, 0, 70, 140, 70, 0]):
    kf.append((60 + i * 4.5, P(aR=(168, f), aL=(40, -105), b=(0, -6 if i % 2 else 0, 0), lL=(8, -6 if i % 2 else 0), h=(-6, 0, 0))))
kf.append((100, N))
D.append(("gangnam", "🐎 Gangnam Style!", 3.6, "ease-in-out", kf))

# ---------- emit CSS ----------
def tf(part, p):
    if part == "body": x, y, r = p["b"]; return f"translate({x:g}px,{y:g}px) rotate({r:g}deg)"
    if part == "head": r, x, y = p["h"]; return f"translate({x:g}px,{y:g}px) rotate({r:g}deg)"
    side, seg = part.split("-")
    if seg in ("arm", "fore"):
        u, f = p["a" + side]; v = u if seg == "arm" else f
        return f"rotate({(v if side == 'L' else -v):g}deg)"
    r, lift = p["l" + side]; return f"translateY({lift:g}px) rotate({(r if side == 'L' else -r):g}deg)"
SEL = {"body": ".elf-in", "head": ".elf-head", "L-arm": ".arm-l", "R-arm": ".arm-r", "L-fore": ".arm-l .fore", "R-fore": ".arm-r .fore", "L-leg": ".leg-l", "R-leg": ".leg-r"}
css = ["/* generated by tools/gen_dances.py — edit the poses there, not here */"]
for did, label, sec, timing, kfs in D:
    kfs = sorted(kfs, key=lambda k: k[0])
    for part, sel in SEL.items():
        name = f"d-{did}-{part}"
        frames = " ".join(f"{pct:.2f}%{{transform:{tf(part, p)}}}" for pct, p in kfs)
        css.append(f"@keyframes {name}{{{frames}}}")
        css.append(f".elf.dancing.d-{did} {sel}{{animation:{name} {sec}s {timing} 1 both;animation-delay:0s!important}}")
open(os.path.join(ROOT, "dances.css"), "w").write("\n".join(css) + "\n")
open(os.path.join(ROOT, "dances.js"), "w").write("// generated by tools/gen_dances.py\nexport const DANCES = "
    + json.dumps([{"id": d, "label": l, "ms": round(s * 1000)} for d, l, s, _, _ in D], ensure_ascii=False) + ";\n")
print(len(D), "dances:", ", ".join(d[0] for d in D))
