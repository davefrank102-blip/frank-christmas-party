"""E2E for household emails + invite e-mail drafts. Usage: .venv/bin/python tools/e2e_email.py [BASE]"""
import asyncio, sys, os, re, json, email, urllib.parse
from email import policy
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8642/"
KEY = open(".admin_secret").read().strip()
SS = "screenshots"; os.makedirs(SS, exist_ok=True)
PUB = "https://davefrank102-blip.github.io/frank-christmas-party/"
TEST = "TEST – The Mailbox Family"
ok = lambda c, m: print(("PASS " if c else "FAIL ") + m) or (c or FAILS.append(m))
FAILS = []
CAP = "HTMLAnchorElement.prototype.click=(o=>function(){if(this.href.startsWith('mailto:')){window.__mailto=this.href;return}return o.call(this)})(HTMLAnchorElement.prototype.click)"
async def names(pg): return await pg.eval_on_selector_all("#rows tr[data-t] td:first-child b", "els=>els.map(e=>e.textContent)")
async def row(pg, name): return pg.locator("#rows tr[data-t]", has=pg.locator("b", has_text=name))
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={"width": 1280, "height": 900}, permissions=["clipboard-read", "clipboard-write"], accept_downloads=True)
        await ctx.add_init_script(CAP)
        pg = await ctx.new_page(); pg.on("console", lambda m: m.type == "error" and errs.append(m.text)); pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(BASE + "admin.html#k=" + KEY); await pg.wait_for_selector("#hq:not([hidden])", timeout=20000); await pg.wait_for_timeout(2000)
        before = sorted(await names(pg)); print("existing:", before)
        for n in before:
            if n.startswith("TEST – The Mailbox") or n.startswith("TEST – Bulk"): await (await row(pg, n)).locator("button[data-a=del]").click(); await pg.wait_for_timeout(1500)
        before = sorted(await names(pg))
        # validation
        await pg.fill("#addName", TEST); await pg.fill("#addEmails", "elf.one@example.com, not-an-email@")
        ok(await pg.locator("#addEmailsHint.err").is_visible(), "bad email shows error"); await pg.click("#addForm button[type=submit]"); await pg.wait_for_timeout(800)
        ok(TEST not in await names(pg), "bad email blocks add")
        await pg.fill("#addEmails", "Elf One <elf.one@example.com>; elf.two@example.org\nelf.one@EXAMPLE.com")
        ok("2 emails" in await pg.inner_text("#addEmailsHint"), "parses+dedupes 2 emails")
        await pg.fill("#addMemo", "temporary e2e household, auto-deleted"); await pg.click("#addForm button[type=submit]")
        await pg.wait_for_selector("#addMsg.ok", timeout=15000); await pg.wait_for_timeout(1500)
        r = await row(pg, TEST); tok = await r.get_attribute("data-t")
        ok("elf.one@example.com, elf.two@example.org" in await r.inner_text(), "emails shown in row")
        # public invite doc must not hold emails
        inv = await pg.evaluate("""async (t)=>{const v=window.BUILD;const {db}=await import('./shared.js?v='+v);
          const fs=await import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js');
          const s=await fs.getDoc(fs.doc(db,'invites',t)); const out={keys:Object.keys(s.data()).sort()};
          const tryw=async(f)=>{try{await f();return 'allowed'}catch(e){return e.code}};
          out.inviteEmails=await tryw(()=>fs.updateDoc(fs.doc(db,'invites',t),{emails:['x@y.com']}));
          out.badEmail=await tryw(()=>fs.updateDoc(fs.doc(db,'hosts',location.hash.slice(3),'guests',t),{emails:['nope']}));
          out.tooMany=await tryw(()=>fs.updateDoc(fs.doc(db,'hosts',location.hash.slice(3),'guests',t),{emails:Array.from({length:11},(_,i)=>`a${i}@b.co`)}));
          out.fakeTime=await tryw(()=>fs.updateDoc(fs.doc(db,'hosts',location.hash.slice(3),'guests',t),{emailedAt:fs.Timestamp.fromDate(new Date(2020,1,1))}));
          out.badVia=await tryw(()=>fs.updateDoc(fs.doc(db,'hosts',location.hash.slice(3),'guests',t),{emailedVia:'sms'}));
          out.wrongKey=await tryw(()=>fs.getDocs(fs.collection(db,'hosts','x'.repeat(32),'guests')));
          out.list=await tryw(()=>fs.getDocs(fs.collection(db,'invites')));
          return out}""", tok)
        print("rules:", inv)
        ok("emails" not in inv["keys"], "invites doc has no emails"); ok(inv["inviteEmails"] == "permission-denied", "can't put emails on invite doc")
        ok(inv["badEmail"] == "permission-denied", "rules reject bad email"); ok(inv["tooMany"] == "permission-denied", "rules reject >10 emails")
        ok(inv["fakeTime"] == "permission-denied", "rules reject fake emailedAt"); ok(inv["badVia"] == "permission-denied", "rules reject bad emailedVia")
        ok(inv["list"] == "permission-denied", "invites still not listable")
        # bulk
        await pg.click("#bulk summary")
        await pg.fill("#bulkText", "TEST – Bulk One: b1@example.com b2@example.com\nTEST – Bulk Bad: oops@\nTEST – Bulk Two")
        ok(await pg.is_disabled("#bulkAdd") and "Fix 1" in await pg.inner_text("#bulkAdd"), "bulk flags bad line")
        await pg.fill("#bulkText", "TEST – Bulk One: b1@example.com, b2@example.com\nTEST – Bulk Two\n" + TEST + ": dup@example.com")
        ok("Add 2 households" in await pg.inner_text("#bulkAdd"), "bulk preview counts 2 (dup skipped)")
        await pg.screenshot(path=f"{SS}/29b-bulk-preview.png", full_page=False, clip=None)
        await pg.click("#bulkAdd"); await pg.wait_for_selector("#bulkMsg.ok", timeout=15000); await pg.wait_for_timeout(1500)
        ns = await names(pg); ok("TEST – Bulk One" in ns and "TEST – Bulk Two" in ns, "bulk added 2")
        ok("b1@example.com, b2@example.com" in await (await row(pg, "TEST – Bulk One")).inner_text(), "bulk emails stored")
        # edit emails
        await (await row(pg, "TEST – Bulk Two")).locator("button[data-a=edit]").click()
        await pg.fill("#edEmails", "late@example.com"); await pg.click("#edSave"); await pg.wait_for_timeout(1500)
        ok("late@example.com" in await (await row(pg, "TEST – Bulk Two")).inner_text(), "edit adds email")
        # email invite
        await pg.locator("#rows").scroll_into_view_if_needed()
        await (await row(pg, TEST)).locator("button[data-a=mail]").click(); await pg.wait_for_timeout(1500)
        toast = await pg.inner_text("#toast"); ok("Invite copied — paste it into the email body" in toast, "toast: " + toast)
        clip = await pg.evaluate("""async()=>{const it=(await navigator.clipboard.read())[0];return {types:it.types,html:await (await it.getType('text/html')).text(),text:await (await it.getType('text/plain')).text()}}""")
        h = clip["html"]; link = PUB + "#t=" + tok
        ok(set(clip["types"]) >= {"text/html", "text/plain"}, "clipboard has html+plain")
        ok(f'<a href="{link}"' in h and f'<img src="{PUB}images/invite-card.jpg" width="600" height="315"' in h, "html: image is a link to personal invite")
        ok(re.search(r'<a href="%s"[^>]*>[^<]*RSVP here' % re.escape(link), h) is not None, "html: RSVP button")
        ok("2374 Orchard Crest Blvd" in h and "5:00 – 9:00 PM" in h, "html: details")
        ok(link in clip["text"], "plain fallback has link")
        mt = await pg.evaluate("window.__mailto"); u = urllib.parse.urlsplit(mt); q = urllib.parse.parse_qs(u.query)
        print("mailto:", mt[:160], "…")
        ok(urllib.parse.unquote(u.path) == "elf.one@example.com,elf.two@example.org", "mailto To = both")
        ok(q["subject"][0] == "You're invited: Frank Family Christmas Eve 🎄", "mailto subject")
        ok(link in q["body"][0], "mailto body has link")
        await pg.wait_for_timeout(1500)
        ok("✅" in await (await row(pg, TEST)).locator("td.mailed").inner_text(), "emailed flag shown")
        # eml
        async with pg.expect_download() as dl: await (await row(pg, TEST)).locator("button[data-a=eml]").click()
        d = await dl.value; path = "/tmp/test-invite.eml"; await d.save_as(path)
        m = email.message_from_bytes(open(path, "rb").read(), policy=policy.default)
        ok(m["X-Unsent"] == "1" and m["To"] == "elf.one@example.com, elf.two@example.org", "eml headers")
        ok(str(m["Subject"]) == "You're invited: Frank Family Christmas Eve 🎄", "eml subject")
        parts = list(m.walk()); img = [x for x in parts if x.get_content_type() == "image/jpeg"]; html = [x for x in parts if x.get_content_type() == "text/html"]
        ok(any(x.get_content_type() == "multipart/related" for x in parts) and img and html, "eml multipart/related with html+jpeg")
        cid = img[0]["Content-ID"].strip("<>"); ok(f'src="cid:{cid}"' in html[0].get_content(), "eml html uses inline cid image")
        ok(len(img[0].get_content()) == os.path.getsize("docs/images/invite-card.jpg"), "eml image bytes intact")
        ok(link in html[0].get_content(), "eml html has personal link")
        open("/tmp/email-render.html", "w").write(h)
        # email-all queue
        await pg.click("#emailAll"); await pg.wait_for_timeout(400); qn = await pg.inner_text("#qName")
        ok(await pg.is_visible("#queue") and qn != TEST, f"queue skips emailed (first: {qn})")
        await pg.evaluate("document.querySelector('#toast').hidden=true")
        await pg.evaluate("scrollTo(0, document.querySelector('#rows').getBoundingClientRect().top+scrollY-140)"); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f"{SS}/29-dashboard-emails.png")
        await pg.click("#qStop")
        await pg.evaluate("scrollTo(0, document.querySelector('#addForm').getBoundingClientRect().top+scrollY-80)"); await pg.fill("#addEmails", "john@x.com, jane@y.com"); await pg.wait_for_timeout(200)
        await pg.screenshot(path=f"{SS}/29a-add-form-emails.png"); await pg.fill("#addEmails", "")
        # render email html
        ep = await ctx.new_page(); await ep.set_viewport_size({"width": 700, "height": 900})
        await ep.set_content(f'<body style="margin:0;background:#f2f2f2"><div style="background:#fff;margin:20px auto;padding:24px;max-width:620px"><div style="font:13px Arial;color:#666;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:16px"><b>To:</b> elf.one@example.com, elf.two@example.org<br><b>Subject:</b> You\'re invited: Frank Family Christmas Eve 🎄</div>{h.replace(PUB + "images/invite-card.jpg", BASE + "images/invite-card.jpg")}</div></body>')
        await ep.wait_for_load_state("networkidle"); await ep.wait_for_timeout(800)
        await ep.screenshot(path=f"{SS}/30-email-render.png", full_page=True)
        # mobile dashboard
        mob = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        mp = await mob.new_page(); await mp.goto(BASE + "admin.html#k=" + KEY); await mp.wait_for_selector("#hq:not([hidden])", timeout=20000); await mp.wait_for_timeout(1500)
        await mp.locator("#addForm").scroll_into_view_if_needed(); await mp.screenshot(path=f"{SS}/31-dashboard-mobile-add.png")
        await mp.locator("#rows").scroll_into_view_if_needed(); await mp.screenshot(path=f"{SS}/31b-dashboard-mobile-list.png")
        await (await row(mp, TEST)).locator("button[data-a=edit]").click(); await mp.wait_for_timeout(400); await mp.screenshot(path=f"{SS}/31c-mobile-edit.png")
        await mob.close()
        # cleanup
        for n in [TEST, "TEST – Bulk One", "TEST – Bulk Two"]:
            await (await row(pg, n)).locator("button[data-a=del]").click(); await pg.wait_for_timeout(1500)
        after = sorted(await names(pg)); ok(after == before, f"cleanup restored list {after}")
        ok(not errs, "no console errors " + str(errs[:3]))
        await b.close()
    print("FAILS:", FAILS)
asyncio.run(main())
