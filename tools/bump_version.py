#!/usr/bin/env python3
"""Cache-busting: stamp a new build id into every local JS/CSS/JSON/image reference + docs/version.json.
Run before every commit/push:  python3 tools/bump_version.py
GitHub Pages caches files ~10 min; versioned URLs make phones fetch the new files, and the tiny loader in the
HTML pages compares the baked build id with version.json (fetched with no-store) and refreshes a stale page once."""
import json, os, re, time
ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
V = time.strftime("%Y%m%d%H%M%S")
LOADER = ('<script id="buildcheck">window.BUILD="%s";fetch("version.json?"+Date.now(),{cache:"no-store"}).then(r=>r.json()).then(j=>{'
          'if(j.v!==window.BUILD&&sessionStorage.getItem("xmas-reloaded")!==j.v){sessionStorage.setItem("xmas-reloaded",j.v);'
          'return fetch(location.pathname,{cache:"reload"}).then(()=>location.reload())}}).catch(()=>{})</script>')
for f in os.listdir(ROOT):
    p = os.path.join(ROOT, f)
    if f.endswith(".html"):
        s = open(p).read()
        s = re.sub(r'((?:href|src)=")((?!https?:|data:)[\w./-]+\.(?:css|js))(?:\?v=\w+)?(")', rf"\g<1>\g<2>?v={V}\g<3>", s)
        s = re.sub(r'<script id="buildcheck">.*?</script>', "", s)
        s = s.replace("</head>", LOADER % V + "\n</head>", 1)
        open(p, "w").write(s)
    elif f.endswith(".js"):
        s = open(p).read()
        s = re.sub(r'((?:from\s+|import\s*\(\s*)")(\./[\w./-]+\.js)(?:\?v=\w+)?(")', rf"\g<1>\g<2>?v={V}\g<3>", s)
        s = re.sub(r'const BUILD = "\w*";', f'const BUILD = "{V}";', s)
        open(p, "w").write(s)
json.dump({"v": V}, open(os.path.join(ROOT, "version.json"), "w"))
print("build", V)
