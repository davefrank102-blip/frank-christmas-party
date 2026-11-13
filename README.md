# Frank Family Christmas Eve Party 🎄

Custom invite + RSVP tracker. Static site on GitHub Pages (`docs/` on `main`), data in Firebase Firestore (project `frank-xmas-2026`).

- **Guest invite:** `https://davefrank102-blip.github.io/frank-christmas-party/#t=<guest-token>`
- **Host dashboard:** `https://davefrank102-blip.github.io/frank-christmas-party/admin.html#k=<host-key>` — the host key is secret (not in this repo).

## Change party details / address
Edit `docs/config.js` → `PARTY.address` (replace `"TBD"`). Everything else (title, times, RSVP-by text) is in the same object. Commit + push; Pages updates in ~1 minute.

## Add photos
1. Put JPG/PNGs in `docs/images/photos/` (landscape ~1200×900 looks best).
2. List them in `docs/images/photos/photos.json`: `[{"file":"house.jpg","caption":"Our house"}, …]` and remove the `placeholder-*` entries.

## Add Elf Dance faces
1. Drop face photos into `tools/faces_src/` named after the person (`Grandma.jpg` → label "Grandma"). This folder is git-ignored.
2. `python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt` (once)
3. `.venv/bin/python tools/make_faces.py tools/faces_src --replace` (`--all` = every face in group photos)
   → round PNG cut-outs land in `docs/images/faces/` and `faces.json` is updated. Up to 12 elves show.

## Guests
Add / rename / remove households and copy their personal links from the dashboard. Links are 24-char random tokens.

## Security model
- `invites/{token}`: anyone can GET a doc only by knowing its token; LIST is denied. Guests can change only status/adults/kids/note (validated), nothing else.
- `hosts/<host-key>/guests/{token}`: host index; the host key is hard-coded into the deployed rules (template: `firestore.rules.tmpl`, real key is substituted at deploy time and never committed).
- Deploy rules: `sed "s/__ADMIN__/$(cat .admin_secret)/g" firestore.rules.tmpl > firestore.rules && firebase deploy --only firestore:rules --project frank-xmas-2026`

## Publishing changes
Run `python3 tools/bump_version.py` before every commit/push. It stamps a build id onto every JS/CSS/JSON/image URL (cache-busting) and writes `docs/version.json`; pages that loaded a stale cached copy refresh themselves once.
