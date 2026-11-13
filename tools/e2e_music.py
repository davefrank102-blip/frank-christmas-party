"""Music default-on E2E: .venv/bin/python tools/e2e_music.py [BASE]  (adds + deletes a temp TEST household)"""
import asyncio, sys
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8642/"
KEY = open(".admin_secret").read().strip(); NAME = "TEST – Music Family"; FAILS = []
ok = lambda c, m: print(("PASS " if c else "FAIL ") + m) or (c or FAILS.append(m))
HOOK = "window.__acs=[];const _AC=window.AudioContext||window.webkitAudioContext;window.AudioContext=window.webkitAudioContext=class extends _AC{constructor(...a){super(...a);window.__acs.push(this)}};"
STATE = "(async()=>{const m=await import('./music.js?v='+window.BUILD);const b=document.querySelector('#musicBtn');return {on:m.music.on,ac:window.__acs.map(a=>a.state),btn:b.hidden?'hidden':b.textContent.trim(),pressed:b.getAttribute('aria-pressed')}})()"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--autoplay-policy=user-gesture-required"])
        adm = await (await b.new_context()).new_page(); adm.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await adm.goto(BASE + "admin.html#k=" + KEY); await adm.wait_for_selector("#hq:not([hidden])", timeout=20000)
        await adm.fill("#addName", NAME); await adm.click("#addForm button[type=submit]"); await adm.wait_for_selector("#addMsg.ok", timeout=15000)
        tok = await adm.get_attribute(f'#rows tr[data-t]:has(b:text-is("{NAME}"))', "data-t")
        try:
            old = f"localStorage.setItem('xmas-seen-{tok}','1');localStorage.setItem('xmas-music','off');localStorage.setItem('muted','1');"
            for label, extra, ctxargs in [("fresh phone", "", dict(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)),
                                          ("old-saved-state", old, dict(viewport={"width": 1280, "height": 800})),
                                          ("preview", "", dict(viewport={"width": 1280, "height": 800}))]:
                ctx = await b.new_context(**ctxargs); await ctx.add_init_script(HOOK + extra)
                pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto(BASE + "#t=" + tok + ("&preview" if label == "preview" else ""))
                await pg.wait_for_function("document.querySelector('#giftTag').textContent.length>6", timeout=20000); await pg.wait_for_timeout(800)
                s0 = await pg.evaluate(STATE)
                ok(await pg.is_visible("#gift") and s0["on"] is False and not s0["ac"], f"{label}: present shown, silent before tap {s0}")
                await pg.click("#gift"); await pg.wait_for_timeout(1500); s1 = await pg.evaluate(STATE)
                ok(s1["on"] is True and s1["ac"] == ["running"] and s1["btn"].startswith("🔊") and s1["pressed"] == "true", f"{label}: tap -> music playing, button on {s1}")
                if label == "fresh phone":
                    await pg.click("#musicBtn"); await pg.wait_for_timeout(700); s2 = await pg.evaluate(STATE)
                    ok(s2["on"] is False and s2["btn"].startswith("🔇"), f"toggle off works {s2['btn']}")
                    await pg.click("#musicBtn"); await pg.wait_for_timeout(700); s3 = await pg.evaluate(STATE)
                    ok(s3["on"] is True and s3["ac"] == ["running"] and s3["btn"].startswith("🔊"), f"toggle back on works {s3}")
                ok(not errs, f"{label}: no page errors {errs[:2]}")
                await ctx.close()
                opened = await adm.evaluate("""async(t)=>{const {db}=await import('./shared.js?v='+window.BUILD);const fs=await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js');return !!(await fs.getDoc(fs.doc(db,'invites',t))).data().openedAt}""", tok)
                if label == "fresh phone": ok(opened, "real visit marks opened")
                if label == "preview":
                    ok(not opened, "dashboard preview does NOT mark opened (after clearing)")
                else:  # clear it so the next case starts clean (also proves the host 'reset viewed' rule)
                    await adm.evaluate("""async(t)=>{const {db}=await import('./shared.js?v='+window.BUILD);const fs=await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js');await fs.updateDoc(fs.doc(db,'invites',t),{openedAt:fs.deleteField()})}""", tok)
        finally:
            await adm.click(f'#rows tr[data-t]:has(b:text-is("{NAME}")) button[data-a=del]'); await adm.wait_for_timeout(2000)
            left = await adm.eval_on_selector_all("#rows tr[data-t] b", "e=>e.map(x=>x.textContent)"); ok(NAME not in left, f"temp household deleted (left: {left})")
        await b.close()
    print("FAILS:", FAILS)
asyncio.run(main())
