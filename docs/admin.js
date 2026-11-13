import { db, withTimeout, mountCountdown, esc, PARTY } from "./shared.js?v=20261113140947";
import { collection, doc, onSnapshot, writeBatch, serverTimestamp, getDocs, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { parseEmails, parseBulkLine, MAX_EMAILS, emailHtml, emailText, mailtoUrl, copyRich, buildEml } from "./email.js?v=20261113140947";

const $ = (s) => document.querySelector(s);
const KEY = new URLSearchParams(location.hash.slice(1)).get("k") || "";
const BASE = location.origin + location.pathname.replace(/admin\.html$/, "");
const linkFor = (t) => `${BASE}#t=${t}`;
// lights + snow (lightweight copy of the invite's)
$(".lights").innerHTML = "<i></i>".repeat(Math.ceil(innerWidth / 44));
(() => { const c = $("#snow"), x = c.getContext("2d"); let W, H, f = [];
  const r = () => { W = c.width = innerWidth; H = c.height = innerHeight; f = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2 + .6, v: Math.random() * .5 + .25 })); };
  const s = () => { x.clearRect(0, 0, W, H); x.fillStyle = "rgba(255,255,255,.8)"; for (const p of f) { p.y += p.v; if (p.y > H) p.y = -4; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill(); } requestAnimationFrame(s); };
  addEventListener("resize", r); r(); s(); })();

$("#hqWhen").textContent = `${PARTY.timeText} · ${PARTY.title}`;
mountCountdown($("#countdown"));

const toast = (t, ms = 2200) => { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, ms); };
const copy = async (text, label = "Copied!") => { try { await navigator.clipboard.writeText(text); toast(label); } catch { prompt("Copy this:", text); } };
function newToken(n = 24) {
  const a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; let out = "";
  while (out.length < n) { const b = crypto.getRandomValues(new Uint8Array(32)); for (const v of b) if (v < 248 && out.length < n) out += a[v % 62]; }
  return out;
}

const guests = new Map();   // token -> {name, memo, emails, emailedAt, emailedVia, createdAt}
const invites = new Map();  // token -> invite doc data
const unsub = new Map();
let filter = "all";

if (KEY.length < 20) { $("#locked").hidden = false; }
else start();

function start() {
  const col = collection(db, "hosts", KEY, "guests");
  onSnapshot(col, (snap) => {
    $("#hq").hidden = false; $("#locked").hidden = true;
    const seen = new Set();
    snap.forEach((d) => { seen.add(d.id); guests.set(d.id, d.data());
      if (!unsub.has(d.id)) unsub.set(d.id, onSnapshot(doc(db, "invites", d.id), (s) => { if (s.exists()) invites.set(d.id, s.data()); else invites.delete(d.id); render(); }, () => {})); });
    for (const t of [...guests.keys()]) if (!seen.has(t)) { guests.delete(t); invites.delete(t); unsub.get(t)?.(); unsub.delete(t); }
    render();
  }, (err) => { console.error(err); $("#hq").hidden = true; $("#locked").hidden = false; });
}

function rows() {
  return [...guests.entries()].map(([t, g]) => ({ t, ...g, ...(invites.get(t) || {}), name: g.name, memo: g.memo || "" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function totals(rs) {
  const T = { invited: rs.length, yes: 0, maybe: 0, no: 0, none: 0, adults: 0, kids: 0, mAdults: 0, mKids: 0, opened: 0 };
  for (const r of rs) { const s = r.status && r.status !== "none" ? r.status : "none"; T[s]++;
    if (r.openedAt) T.opened++;
    if (s === "yes") { T.adults += r.adults || 0; T.kids += r.kids || 0; }
    if (s === "maybe") { T.mAdults += r.adults || 0; T.mKids += r.kids || 0; } }
  return T;
}
const fmt = (ts) => ts?.toDate ? ts.toDate().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const label = { yes: "Yes 🎄", maybe: "Maybe", no: "No", none: "No reply" };
const isTest = (n) => /^test\b/i.test(n);

function render() {
  const rs = rows(), T = totals(rs);
  $("#tiles").innerHTML = [["", T.invited, "households"], ["yes", T.yes, "yes"], ["maybe", T.maybe, "maybe"], ["no", T.no, "no"], ["none", T.none, "no reply"],
    ["ppl", T.adults + T.kids, "guests coming"], ["ppl", T.adults, "adults"], ["ppl", T.kids, "kids"]]
    .map(([c, n, l]) => `<div class="tile ${c}"><b>${n}</b><span>${l}</span></div>`).join("");
  donut(T); bars(T);
  const list = rs.filter((r) => filter === "all" || (r.status && r.status !== "none" ? r.status : "none") === filter);
  $("#rows").innerHTML = list.length ? list.map((r) => { const s = r.status && r.status !== "none" ? r.status : "none";
    return `<tr data-t="${r.t}">
      <td><b>${esc(r.name)}</b>${isTest(r.name) ? '<span class="test">TEST</span>' : ""}${r.emails?.length ? `<span class="emails">${r.emails.map(esc).join(", ")}</span>` : '<span class="noemail">no email yet</span>'}${r.memo ? `<span class="memo">${esc(r.memo)}</span>` : ""}</td>
      <td data-l="RSVP"><span class="pill ${s}">${label[s]}</span>${r.updatedAt ? `<span class="memo">${esc(fmt(r.updatedAt))}</span>` : ""}</td>
      <td class="num" data-l="Adults">${s === "yes" || s === "maybe" ? r.adults ?? 0 : "–"}</td><td class="num" data-l="Kids">${s === "yes" || s === "maybe" ? r.kids ?? 0 : "–"}</td>
      <td class="note" data-l="Note">${esc(r.note || "")}</td>
      <td data-l="Seen">${r.openedAt ? `👀 <span class="memo">${esc(fmt(r.openedAt))}</span>` : '<span class="memo">not yet</span>'}</td>
      <td class="mailed" data-l="Emailed">${r.emailedAt ? `✅ <span class="memo">${esc(fmt(r.emailedAt))}${r.emailedVia === "eml" ? " · .eml" : ""}</span>` : '<span class="memo">not yet</span>'}</td>
      <td class="acts"><button class="mail" data-a="mail" title="Copy the picture invite + open a new e-mail">✉️ Email invite</button><button data-a="eml" title="Download a draft e-mail (.eml) with the picture inside — opens in Outlook / Apple Mail">⬇ .eml</button><button class="copy" data-a="copy">🔗 Copy link</button><button data-a="msg" title="Copy a text-message invite">💬</button><button data-a="open" title="Preview invite">👁</button><button data-a="edit" title="Edit name, emails, memo">✏️</button><button class="del" data-a="del" title="Remove">🗑</button></td></tr>`; }).join("")
    : `<tr><td colspan="8" style="text-align:center;color:#8a6a5a;padding:20px">${guests.size ? "Nobody in this group yet." : "No guests yet — add your first household above! 🎄"}</td></tr>`;
  const waiting = rs.filter((r) => !r.status || r.status === "none");
  $("#waiting").innerHTML = waiting.length ? waiting.map((r) => `<li>${esc(r.name)} ${r.openedAt ? "<small>(opened 👀)</small>" : "<small>(not opened)</small>"}</li>`).join("") : "<li>Everyone has answered! 🎉</li>";
}

function donut(T) {
  const parts = [["Yes", T.yes, "#25a85a"], ["Maybe", T.maybe, "#e3a400"], ["No", T.no, "#d7263d"], ["No reply", T.none, "#9aa5b8"]];
  const tot = parts.reduce((a, p) => a + p[1], 0); const R = 70, C = 2 * Math.PI * R; let off = 0;
  const arcs = tot ? parts.filter((p) => p[1]).map(([l, v, c]) => { const len = (v / tot) * C; const s = `<circle r="${R}" cx="100" cy="100" fill="none" stroke="${c}" stroke-width="34" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 100 100)"><title>${l}: ${v}</title></circle>`; off += len; return s; }).join("")
    : `<circle r="${R}" cx="100" cy="100" fill="none" stroke="#e6d6c0" stroke-width="34"/>`;
  $("#donut").innerHTML = `<svg viewBox="0 0 200 200" width="200" height="200">${arcs}<text x="100" y="96" text-anchor="middle" font-size="34" font-weight="800" fill="#2a1a12">${tot}</text><text x="100" y="120" text-anchor="middle" font-size="13" fill="#8a6a5a">households</text></svg>
    <div class="legend">${parts.map(([l, v, c]) => `<div><i style="background:${c}"></i>${l}: ${v}${tot ? ` <small style="color:#8a6a5a">(${Math.round(v / tot * 100)}%)</small>` : ""}</div>`).join("")}</div>`;
}
function bars(T) {
  const data = [["Coming (Yes)", T.adults, T.kids], ["Maybe", T.mAdults, T.mKids], ["Best case", T.adults + T.mAdults, T.kids + T.mKids]];
  const max = Math.max(4, ...data.map((d) => d[1] + d[2])); const W = 360, H = 220, bw = 70, gap = (W - 40 - bw * 3) / 3;
  const ys = (v) => (v / max) * (H - 60);
  const g = data.map(([l, a, k], i) => { const x = 40 + gap / 2 + i * (bw + gap), ha = ys(a), hk = ys(k), base = H - 30;
    return `<rect x="${x}" y="${base - ha}" width="${bw}" height="${ha}" rx="6" fill="#1f7a3a"><title>Adults: ${a}</title></rect>
      <rect x="${x}" y="${base - ha - hk}" width="${bw}" height="${hk}" rx="6" fill="#ffd23f"><title>Kids: ${k}</title></rect>
      <text x="${x + bw / 2}" y="${base - ha - hk - 8}" text-anchor="middle" font-weight="800" font-size="16" fill="#2a1a12">${a + k}</text>
      <text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle" font-size="12" fill="#6b4a3a">${l}</text>`; }).join("");
  $("#bars").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><line x1="30" x2="${W - 5}" y1="${H - 30}" y2="${H - 30}" stroke="#e6d6c0" stroke-width="2"/>${g}</svg>
    <div class="legend"><div><i style="background:#1f7a3a"></i>Adults</div><div><i style="background:#ffd23f"></i>Kids</div></div>`;
}

$("#filters").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; filter = b.dataset.f;
  document.querySelectorAll("#filters button").forEach((x) => x.classList.toggle("on", x === b)); render(); });

$("#addForm").addEventListener("submit", async (e) => {
  e.preventDefault(); const name = $("#addName").value.trim(), memo = $("#addMemo").value.trim(); if (!name) return;
  const pe = checkEmails($("#addEmails").value, $("#addEmailsHint")); if (!pe) return;
  const t = newToken(), m = $("#addMsg"); m.hidden = false; m.className = "save-msg busy"; m.textContent = "⏳ Adding…";
  const b = writeBatch(db);
  const g = { name, createdAt: serverTimestamp() }; if (memo) g.memo = memo; if (pe.length) g.emails = pe;
  b.set(doc(db, "hosts", KEY, "guests", t), g);
  b.set(doc(db, "invites", t), { name, status: "none", adults: 0, kids: 0, note: "", createdAt: serverTimestamp() });
  try { await withTimeout(b.commit(), 10000);
    m.className = "save-msg ok"; m.innerHTML = `<div style="width:100%">✅ Added <b>${esc(name)}</b>. Their personal link:<div class="linkbox"><input readonly value="${linkFor(t)}"><button class="btn" type="button" id="cpNew">Copy</button></div></div>`;
    $("#cpNew").onclick = () => copy(linkFor(t), "Link copied");
    $("#addName").value = ""; $("#addMemo").value = ""; $("#addEmails").value = ""; $("#addEmailsHint").hidden = true;
  } catch (err) { console.error(err); m.className = "save-msg err"; m.textContent = "❌ Couldn't add the guest — check your connection and try again."; }
});

$("#rows").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-a]"); if (!b) return; const t = b.closest("tr").dataset.t; const g = guests.get(t);
  if (b.dataset.a === "copy") copy(linkFor(t), "Link copied 🔗");
  if (b.dataset.a === "open") window.open(linkFor(t) + "&intro", "_blank", "noopener");
  if (b.dataset.a === "msg") copy(`🎄 You're invited to ${PARTY.title}! ${PARTY.timeText}. Open your invitation & RSVP here: ${linkFor(t)}`, "Invite message copied ✉️");
  if (b.dataset.a === "edit") openEdit(t);
  if (b.dataset.a === "mail") emailInvite(t);
  if (b.dataset.a === "eml") downloadEml(t);
  if (b.dataset.a === "del") {
    if (!confirm(`Remove ${g.name}? Their link will stop working and their RSVP is deleted.`)) return;
    const batch = writeBatch(db); batch.delete(doc(db, "hosts", KEY, "guests", t)); batch.delete(doc(db, "invites", t));
    try { await withTimeout(batch.commit()); toast("Removed"); } catch (err) { console.error(err); alert("Couldn't remove. Check your connection."); }
  }
});

$("#csv").addEventListener("click", () => {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [["Household", "Emails", "RSVP", "Adults", "Kids", "Note", "Memo", "Opened", "Updated", "Emailed", "Link"].map(q).join(",")]
    .concat(rows().map((r) => [r.name, (r.emails || []).join("; "), label[r.status && r.status !== "none" ? r.status : "none"], r.adults ?? 0, r.kids ?? 0, r.note || "", r.memo, fmt(r.openedAt), fmt(r.updatedAt), fmt(r.emailedAt), linkFor(r.t)].map(q).join(",")));
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); a.download = "christmas-rsvps.csv"; a.click();
});

// ================= Emails =================
/** Validate an emails box; shows a hint under it. Returns the clean list, or null if something is wrong. */
function checkEmails(text, hintEl) {
  const { emails, bad } = parseEmails(text);
  const err = bad.length ? `❌ Not an email address: ${bad.map((x) => `"${x}"`).join(", ")}` : emails.length > MAX_EMAILS ? `❌ Max ${MAX_EMAILS} emails per household` : "";
  if (hintEl) { hintEl.hidden = !err && !emails.length; hintEl.className = "email-hint " + (err ? "err" : "ok");
    hintEl.textContent = err || `✅ ${emails.length} email${emails.length === 1 ? "" : "s"}: ${emails.join(", ")}`; }
  return err ? null : emails;
}
$("#addEmails").addEventListener("input", (e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight + 4, 160) + "px"; checkEmails(e.target.value, $("#addEmailsHint")); });

// ---- bulk add ----
const bulkParse = () => {
  const have = new Set([...guests.values()].map((g) => g.name.toLowerCase())), mine = new Set();
  return $("#bulkText").value.split(/\r?\n/).map(parseBulkLine).filter(Boolean).map((l) => {
    const k = l.name.toLowerCase(); l.dup = have.has(k) || mine.has(k); mine.add(k);
    l.err = !l.name ? "missing household name" : l.bad.length ? `bad email: ${l.bad.join(", ")}` : l.emails.length > MAX_EMAILS ? `max ${MAX_EMAILS} emails` : "";
    return l; });
};
function bulkPreview() {
  const ls = bulkParse(), ok = ls.filter((l) => !l.err && !l.dup);
  $("#bulkPreview").innerHTML = ls.map((l) => `<div class="${l.err ? "bad" : l.dup ? "dup" : ""}">${l.err ? "❌" : l.dup ? "⚠️" : "✅"} <b>${esc(l.name || "?")}</b> ${l.emails.length ? "— " + l.emails.map(esc).join(", ") : "<i>(no email)</i>"}${l.err ? ` — ${esc(l.err)}` : l.dup ? " — already on the list, will be skipped" : ""}</div>`).join("");
  const nbad = ls.filter((l) => l.err).length;
  $("#bulkAdd").disabled = !ok.length || nbad > 0;
  $("#bulkAdd").textContent = nbad ? `Fix ${nbad} line${nbad > 1 ? "s" : ""} first` : ok.length ? `Add ${ok.length} household${ok.length === 1 ? "" : "s"}` : "Add households";
}
$("#bulkText").addEventListener("input", bulkPreview);
$("#bulkAdd").addEventListener("click", async () => {
  const ls = bulkParse(); if (ls.some((l) => l.err)) return bulkPreview();
  const todo = ls.filter((l) => !l.dup), m = $("#bulkMsg"); if (!todo.length) return;
  m.hidden = false; m.className = "save-msg busy"; m.textContent = `⏳ Adding ${todo.length}…`; $("#bulkAdd").disabled = true;
  let done = 0;
  try {
    for (let i = 0; i < todo.length; i += 200) {
      const b = writeBatch(db);
      for (const l of todo.slice(i, i + 200)) { const t = newToken(), g = { name: l.name, createdAt: serverTimestamp() }; if (l.emails.length) g.emails = l.emails;
        b.set(doc(db, "hosts", KEY, "guests", t), g);
        b.set(doc(db, "invites", t), { name: l.name, status: "none", adults: 0, kids: 0, note: "", createdAt: serverTimestamp() }); }
      await withTimeout(b.commit(), 15000); done += Math.min(200, todo.length - i);
    }
    m.className = "save-msg ok"; m.textContent = `✅ Added ${done} household${done === 1 ? "" : "s"}. Use ✉️ Email invite on each row (or "Email all" below).`;
    $("#bulkText").value = ""; bulkPreview();
  } catch (err) { console.error(err); m.className = "save-msg err"; m.textContent = `❌ Stopped after ${done} — check your connection and try again (already-added ones will be skipped).`; bulkPreview(); }
});

// ---- edit dialog ----
let editing = null;
function openEdit(t) {
  const g = guests.get(t); editing = t;
  $("#edName").value = g.name; $("#edMemo").value = g.memo || ""; $("#edEmails").value = (g.emails || []).join(", ");
  $("#edHint").hidden = true; $("#edReset").checked = false; $("#edResetWrap").hidden = !g.emailedAt;
  const dlg = $("#editDlg"); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
}
$("#edEmails").addEventListener("input", (e) => checkEmails(e.target.value, $("#edHint")));
$("#editForm").addEventListener("submit", async (e) => {
  if (e.submitter?.value !== "save") return;
  e.preventDefault();
  const t = editing, g = guests.get(t); if (!g) return $("#editDlg").close();
  const name = $("#edName").value.trim(), memo = $("#edMemo").value.trim().slice(0, 300);
  const emails = checkEmails($("#edEmails").value, $("#edHint")); if (!name || !emails) return;
  const upd = { name, memo: memo || deleteField(), emails: emails.length ? emails : deleteField() };
  if ($("#edReset").checked) { upd.emailedAt = deleteField(); upd.emailedVia = deleteField(); }
  const batch = writeBatch(db); batch.update(doc(db, "hosts", KEY, "guests", t), upd);
  if (name !== g.name) batch.update(doc(db, "invites", t), { name });
  $("#edSave").disabled = true;
  try { await withTimeout(batch.commit()); $("#editDlg").close(); toast("Saved ✏️"); }
  catch (err) { console.error(err); alert("Couldn't save the change. Check your connection."); }
  finally { $("#edSave").disabled = false; }
});

// ---- email a household ----
const markEmailed = (t, via) => updateDoc(doc(db, "hosts", KEY, "guests", t), { emailedAt: serverTimestamp(), emailedVia: via }).catch((err) => console.error("markEmailed", err));
function openMailto(url) { const a = document.createElement("a"); a.href = url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
/** Tap handler: copies the picture e-mail (rich HTML) and opens a new e-mail addressed to the household. Keep it synchronous up to copyRich (iOS). */
function emailInvite(t) {
  const g = guests.get(t); if (!g) return;
  const copied = copyRich(emailHtml(g.name, t), emailText(g.name, t));
  const mail = mailtoUrl(g.emails || [], g.name, t);
  Promise.race([copied, new Promise((r) => setTimeout(() => r(null), 700))]).then((ok) => {
    toast(ok === false ? "Couldn't copy the picture — the e-mail still has the link" : "Invite copied — paste it into the email body", 6000);
    if (!(g.emails || []).length) setTimeout(() => toast("No email on file — add one with ✏️, or type it in the To: line", 5000), 6000);
    openMailto(mail); markEmailed(t, "copy");
  });
}
async function downloadEml(t) {
  const g = guests.get(t); if (!g) return;
  try {
    const eml = await buildEml(g.emails || [], g.name, t);
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([eml], { type: "message/rfc822" }));
    a.download = `Invite - ${g.name.replace(/[\\/:*?"<>|]+/g, "").slice(0, 60)}.eml`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    toast("Draft downloaded — open it in Outlook or Apple Mail, then hit Send", 5000); markEmailed(t, "eml");
  } catch (err) { console.error(err); alert("Couldn't build the draft. Check your connection."); }
}

// ---- email all not-yet-emailed (one at a time; each needs its own tap) ----
let queue = [];
function showQueue() {
  queue = queue.filter((t) => guests.has(t));
  if (!queue.length) { $("#queue").hidden = true; return; }
  const t = queue[0], g = guests.get(t);
  $("#qCount").textContent = `${queue.length} left to email`; $("#qName").textContent = g.name;
  $("#qTo").textContent = (g.emails || []).join(", ") || "no email on file"; $("#queue").hidden = false;
}
$("#emailAll").addEventListener("click", () => {
  queue = rows().filter((r) => !r.emailedAt && r.emails?.length).map((r) => r.t);
  if (!queue.length) return toast(rows().some((r) => !r.emailedAt) ? "Everyone not yet emailed is missing an email — add them with ✏️" : "Everyone has been emailed already 🎉", 4000);
  showQueue();
});
$("#qGo").addEventListener("click", () => { const t = queue.shift(); emailInvite(t); showQueue(); });
$("#qEml").addEventListener("click", () => { const t = queue.shift(); downloadEml(t); showQueue(); });
$("#qSkip").addEventListener("click", () => { queue.shift(); showQueue(); });
$("#qStop").addEventListener("click", () => { queue = []; showQueue(); });
