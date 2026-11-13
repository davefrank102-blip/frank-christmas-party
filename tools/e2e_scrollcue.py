"""Scroll cue E2E: .venv/bin/python tools/e2e_scrollcue.py [BASE]  (adds + deletes a temp TEST household)"""
import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8642/"
KEY = open(".admin_secret").read().strip(); NAME = "TEST – Scroll Cue Family"; FAILS = []
ok = lambda c, m: print(("PASS " if c else "FAIL ") + m) or (c or FAILS.append(m))
VIS = "(()=>{const c=document.querySelector('#scrollCue');const s=getComputedStyle(c);return !c.hidden&&s.visibility!=='hidden'&&+s.opacity>0.5})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        adm = await (await b.new_context()).new_page(); adm.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await adm.goto(BASE + "admin.html#k=" + KEY); await adm.wait_for_selector("#hq:not([hidden])", timeout=20000)
        await adm.fill("#addName", NAME); await adm.click("#addForm button[type=submit]"); await adm.wait_for_selector("#addMsg.ok", timeout=15000)
        tok = await adm.get_attribute(f'#rows tr[data-t]:has(b:text-is("{NAME}"))', "data-t")
        try:
            for label, ctxargs in [("phone", dict(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)),
                                   ("desktop", dict(viewport={"width": 1280, "height": 800}))]:
                pg = await (await b.new_context(**ctxargs)).new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(BASE + "#t=" + tok); await pg.wait_for_function("document.querySelector('#giftTag').textContent.length>6", timeout=20000)
                await pg.wait_for_timeout(800); await pg.click("#gift"); await pg.wait_for_timeout(2600)
                ok(await pg.evaluate(VIS), f"{label}: cue visible at top")
                if label == "phone": await pg.screenshot(path="screenshots/32a-scroll-cue-top.png")
                y0 = await pg.evaluate("scrollY"); await pg.click("#scrollCue", force=True); await pg.wait_for_timeout(1200); y1 = await pg.evaluate("scrollY")
                ok(y1 > y0 + 200, f"{label}: click scrolls ({y0} -> {y1})")
                await pg.evaluate("scrollTo({top:(document.documentElement.scrollHeight-innerHeight)/2,behavior:'instant'})"); await pg.wait_for_timeout(800)
                ok(await pg.evaluate(VIS), f"{label}: cue visible mid-page")
                print("  cue box:", await pg.evaluate("(()=>{const c=document.querySelector('#scrollCue');const r=c.getBoundingClientRect();return [c.className,Math.round(r.width),Math.round(r.height),innerWidth]})()"))
                if label == "phone": await pg.screenshot(path="screenshots/32b-scroll-cue-mid.png")
                await pg.evaluate("scrollTo({top:document.documentElement.scrollHeight-innerHeight-20,behavior:'instant'})"); await pg.wait_for_timeout(800)
                ok(not await pg.evaluate(VIS), f"{label}: cue hidden within 40px of bottom")
                if label == "phone": await pg.screenshot(path="screenshots/32c-scroll-cue-bottom.png")
                await pg.evaluate("scrollTo({top:document.documentElement.scrollHeight-innerHeight-300,behavior:'instant'})"); await pg.wait_for_timeout(800)
                ok(await pg.evaluate(VIS), f"{label}: cue back after scrolling up")
                # tapping through to the bottom with the cue alone
                for _ in range(25):
                    if not await pg.evaluate(VIS): break
                    await pg.click("#scrollCue", force=True); await pg.wait_for_timeout(900)
                ok(not await pg.evaluate(VIS), f"{label}: repeated cue taps reach the bottom")
                pe = await pg.evaluate("getComputedStyle(document.querySelector('#scrollCue')).pointerEvents")
                ok(pe == "none", f"{label}: hidden cue doesn't take taps ({pe})")
                ok(not errs, f"{label}: no page errors {errs[:2]}")
        finally:
            await adm.click(f'#rows tr[data-t]:has(b:text-is("{NAME}")) button[data-a=del]'); await adm.wait_for_timeout(2000)
            left = await adm.eval_on_selector_all("#rows tr[data-t] b", "e=>e.map(x=>x.textContent)"); ok(NAME not in left, f"temp household deleted (left: {left})")
        await b.close()
    print("FAILS:", FAILS)
asyncio.run(main())
