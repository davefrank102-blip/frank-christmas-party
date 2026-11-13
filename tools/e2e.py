import asyncio, sys, os, re
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8642/"
KEY = open(".admin_secret").read().strip()
SS = "screenshots"; os.makedirs(SS, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        desk = await b.new_context(viewport={"width": 1280, "height": 900}, permissions=["clipboard-read", "clipboard-write"])
        adm = await desk.new_page(); adm.on("console", lambda m: m.type == "error" and errs.append("admin: " + m.text))
        await adm.goto(BASE + "admin.html#k=" + KEY); await adm.wait_for_selector("#hq:not([hidden])", timeout=20000)
        links = {}
        existing = await adm.eval_on_selector_all("#rows tr[data-t] td:first-child b", "els=>els.map(e=>e.textContent)")
        for name, memo in [("TEST – The Elf Family", "test guest, delete me"), ("TEST – The Snowmans", "")]:
            if name not in existing:
                await adm.fill("#addName", name); await adm.fill("#addMemo", memo); await adm.click("#addForm button")
                await adm.wait_for_selector("#addMsg.ok", timeout=15000)
        await adm.wait_for_timeout(1500)
        for tr in await adm.query_selector_all("#rows tr[data-t]"):
            n = await (await tr.query_selector("b")).inner_text(); links[n] = BASE + "#t=" + await tr.get_attribute("data-t")
        print("LINKS", links)
        mob = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        results = []
        for i, (name, url) in enumerate(l for l in links.items() if l[0].startswith("TEST")):
            pg = await mob.new_page(); pg.on("console", lambda m: m.type == "error" and errs.append("guest: " + m.text))
            await pg.goto(url); await pg.wait_for_function("document.querySelector('#giftTag').textContent.length>6", timeout=20000)
            await pg.wait_for_timeout(1800)
            if i == 0: await pg.screenshot(path=f"{SS}/01-intro.png")
            await pg.click("#gift"); await pg.wait_for_timeout(450)
            if i == 0: await pg.screenshot(path=f"{SS}/02-intro-opening.png")
            await pg.wait_for_timeout(1500)
            if i == 0:
                await pg.screenshot(path=f"{SS}/03-invite-hero.png")
                await pg.locator("#photos").scroll_into_view_if_needed(); await pg.wait_for_timeout(1400); await pg.locator("#photos").screenshot(path=f"{SS}/04-photos.png")
                await pg.locator("#elves").scroll_into_view_if_needed(); await pg.wait_for_timeout(1200); await pg.locator("#elves").screenshot(path=f"{SS}/05-elf-dance.png")
                await pg.wait_for_timeout(300); await pg.locator("#elves").screenshot(path=f"{SS}/05b-elf-dance-frame2.png")
                await pg.click("#discoBtn"); await pg.wait_for_timeout(700); await pg.locator("#elves").screenshot(path=f"{SS}/06-elf-disco.png")
            st = "yes" if i == 0 else "maybe"
            await pg.locator("#rsvp").scroll_into_view_if_needed(); await pg.wait_for_timeout(900)
            await pg.click(f".ch[data-v={st}]")
            await pg.click("[data-s=kids][data-d='1']")
            await pg.fill("#note", "Automated test RSVP – please ignore" if i == 0 else "Test maybe")
            await pg.click("#saveBtn"); await pg.wait_for_selector("#saveMsg.ok, #saveMsg.err", timeout=15000)
            cls = await pg.get_attribute("#saveMsg", "class"); txt = await pg.inner_text("#saveMsg"); results.append((name, st, cls, txt))
            if i == 0:
                await pg.wait_for_timeout(600); await pg.locator("#rsvp").screenshot(path=f"{SS}/07-rsvp-saved.png")
                await pg.locator("#cal").scroll_into_view_if_needed(); await pg.wait_for_timeout(900); await pg.locator("#cal").screenshot(path=f"{SS}/08-calendar.png")
                # reload: intro skipped, current answer shown
                await pg.reload(); await pg.wait_for_selector("#rsvpCurrent:not([hidden])", timeout=15000)
                results.append(("reload-current", await pg.inner_text("#rsvpCurrent")))
                # change answer later via same link
                await pg.click(".ch[data-v=maybe]"); await pg.click("#saveBtn"); await pg.wait_for_selector("#saveMsg.ok", timeout=15000)
                await pg.click(".ch[data-v=yes]"); await pg.click("#saveBtn"); await pg.wait_for_selector("#saveMsg.ok", timeout=15000)
                # failure path: go offline
                await mob.set_offline(True); await pg.click(".ch[data-v=no]"); await pg.click("#saveBtn")
                await pg.wait_for_selector("#saveMsg.err", timeout=20000); await pg.locator("#rsvp").screenshot(path=f"{SS}/09-rsvp-failure.png")
                results.append(("offline", await pg.inner_text("#saveMsg"))); await mob.set_offline(False)
                await pg.click("#retry"); await pg.wait_for_selector("#saveMsg.ok", timeout=25000)
                await pg.click(".ch[data-v=yes]"); await pg.click("#saveBtn"); await pg.wait_for_selector("#saveMsg.ok", timeout=15000)
                await pg.screenshot(path=f"{SS}/03b-invite-full.png", full_page=True)
            await pg.close()
        bad = await mob.new_page(); await bad.goto(BASE + "#t=NotARealTokenXXXXXXXXXXXX"); await bad.wait_for_timeout(2500); await bad.click("#gift"); await bad.wait_for_selector("#noToken:not([hidden])", timeout=15000)
        results.append(("badtoken", await bad.inner_text("#noToken")))
        await adm.wait_for_timeout(2500); await adm.screenshot(path=f"{SS}/10-dashboard.png", full_page=True)
        await adm.click("#filters [data-f=none]"); await adm.wait_for_timeout(300); await adm.click("#filters [data-f=all]")
        mobadm = await mob.new_page(); await mobadm.goto(BASE + "admin.html#k=" + KEY); await mobadm.wait_for_selector("#hq:not([hidden])", timeout=20000); await mobadm.wait_for_timeout(2500)
        await mobadm.screenshot(path=f"{SS}/11-dashboard-mobile.png", full_page=True)
        locked = await mob.new_page(); await locked.goto(BASE + "admin.html#k=wrongkeywrongkeywrongkey12"); await locked.wait_for_timeout(5000)
        results.append(("wrongkey-locked-visible", await locked.is_visible("#locked")))
        for r in results: print("RESULT", r)
        print("ERRORS", errs)
        await b.close()
asyncio.run(main())
