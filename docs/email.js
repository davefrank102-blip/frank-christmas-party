// Invite e-mail helpers: address parsing, rich HTML e-mail, plain text, mailto and .eml drafts.
import { PARTY, hasAddress } from "./config.js?v=20261113131737";
import { esc } from "./shared.js?v=20261113131737";

export const MAX_EMAILS = 10;
const EMAIL_RE = /^[^\s@<>()",;:\\[\]]+@[^\s@<>()",;:\\[\]]+\.[A-Za-z]{2,}$/;
export const isEmail = (e) => e.length <= 254 && EMAIL_RE.test(e);

/** Split "a@x.com, b@y.com; c@z.com\nJane <jane@q.com>" into {emails, bad}. De-duplicates (case-insensitive). */
export function parseEmails(text) {
  const emails = [], bad = [], seen = new Set();
  const src = String(text || "").replace(/<([^>]*)>/g, " $1 ");           // "Jane <jane@q.com>" -> jane@q.com
  for (let tok of src.split(/[\s,;]+/)) {
    tok = tok.replace(/^mailto:/i, "").replace(/^["'(]+|["').]+$/g, "");
    if (!tok) continue;
    if (!tok.includes("@")) { if (/^[\p{L}'-]+$/u.test(tok)) continue; bad.push(tok); continue; } // ignore bare names like "Jane"
    if (!isEmail(tok)) { bad.push(tok); continue; }
    const k = tok.toLowerCase(); if (seen.has(k)) continue; seen.add(k); emails.push(tok);
  }
  return { emails, bad };
}

/** One bulk line -> {name, emails, bad}. Accepts "The Smiths: a@x.com, b@y.com", "The Smiths - a@x.com" or "The Smiths a@x.com". */
export function parseBulkLine(line) {
  line = line.trim(); if (!line) return null;
  let name, rest;
  const m = line.match(/^(.*?)\s*[:|\t]\s*(.*)$/);
  if (m && m[1]) { name = m[1]; rest = m[2]; }
  else {
    const at = line.search(/[^\s,;<]+@/);
    if (at > 0) { name = line.slice(0, at).replace(/[\s,;:<–—-]+$/, ""); rest = line.slice(at); }
    else if (at === 0) { name = ""; rest = line; }
    else { name = line; rest = ""; }
  }
  return { name: name.trim().slice(0, 80), ...parseEmails(rest) };
}

const abs = (base, path) => new URL(path, base).toString();
export const inviteLink = (token) => `${PARTY.publicBase}#t=${token}`;
export const cardUrl = () => abs(PARTY.publicBase, PARTY.inviteCard);
const greeting = (name) => { const n = String(name).replace(/^test\s*[–-]\s*/i, "").trim();
  return /^the\s+/i.test(n) ? `Hi to all the ${n.replace(/^the\s+/i, "")}!` : `Hi ${n}!`; };
const where = () => hasAddress() ? PARTY.address : PARTY.areaText;
const mapsUrl = () => "https://maps.google.com/?q=" + encodeURIComponent(where());

/** Rich HTML e-mail (inline styles + tables so Gmail/Outlook/Apple Mail render it). img = "https://…" or "cid:…". */
export function emailHtml(name, token, img = cardUrl()) {
  const link = inviteLink(token), f = "font-family:Helvetica,Arial,sans-serif";
  return `<div style="${f};color:#2a1a12;font-size:16px;line-height:1.5;max-width:600px">
<p style="margin:0 0 12px">${esc(greeting(name))} 🎄</p>
<p style="margin:0 0 12px">We'd love for you to come celebrate Christmas Eve with us! Expect good food, drinks, cookies, carols and plenty of Christmas cheer &mdash; kids very welcome.</p>
<p style="margin:0 0 16px">Tap the picture to open your personal invitation (turn your sound on 🔊) and let us know if you can make it.</p>
<p style="margin:0 0 16px"><a href="${esc(link)}" target="_blank" style="text-decoration:none"><img src="${esc(img)}" width="600" height="315" alt="${esc(PARTY.title)} &mdash; Thursday, December 24, 5&ndash;9 PM. Tap to RSVP" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:14px"></a></p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px"><tr><td style="background:#d7263d;border-radius:28px">
<a href="${esc(link)}" target="_blank" style="display:inline-block;padding:14px 34px;${f};font-size:19px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:28px">🎁&nbsp; RSVP here</a></td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="${f};font-size:15px;color:#2a1a12;margin:0 0 16px">
<tr><td style="padding:3px 12px 3px 0;vertical-align:top"><b>🗓️ When</b></td><td style="padding:3px 0">${esc(PARTY.timeText)}</td></tr>
<tr><td style="padding:3px 12px 3px 0;vertical-align:top"><b>📍 Where</b></td><td style="padding:3px 0"><a href="${esc(mapsUrl())}" target="_blank" style="color:#1f7a3a">${esc(where())}</a></td></tr>
${PARTY.rsvpBy ? `<tr><td style="padding:3px 12px 3px 0;vertical-align:top"><b>✉️ RSVP</b></td><td style="padding:3px 0">${esc(PARTY.rsvpBy)} &mdash; <a href="${esc(link)}" target="_blank" style="color:#1f7a3a">tap here</a></td></tr>` : ""}
</table>
<p style="margin:0 0 4px">Can't wait to celebrate with you!</p>
<p style="margin:0">${esc(PARTY.emailSignoff)}</p>
<p style="margin:14px 0 0;font-size:12px;color:#8a6a5a">Your personal invitation link: <a href="${esc(link)}" style="color:#8a6a5a">${esc(link)}</a></p>
</div>`;
}

export function emailText(name, token) {
  const link = inviteLink(token);
  return `${greeting(name)} 🎄

We'd love for you to come celebrate Christmas Eve with us! Expect good food, drinks, cookies, carols and plenty of Christmas cheer — kids very welcome.

Open your personal invitation & RSVP here:
${link}

When: ${PARTY.timeText}
Where: ${where()}
${PARTY.rsvpBy ? PARTY.rsvpBy + "\n" : ""}
Can't wait to celebrate with you!
${PARTY.emailSignoff}`;
}

export function mailtoUrl(emails, name, token) {
  const q = encodeURIComponent;
  const body = emailText(name, token).replace(/\n/g, "\r\n");
  return `mailto:${emails.map((e) => encodeURIComponent(e).replace(/%40/g, "@")).join(",")}?subject=${q(PARTY.emailSubject)}&body=${q(body)}`;
}

/** Copy the rich e-mail to the clipboard. MUST be called synchronously inside the tap/click (iOS Safari rule). */
export function copyRich(html, text) {
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      const item = new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) });
      return navigator.clipboard.write([item]).then(() => true, () => legacyCopy(html));
    } catch { /* fall through */ }
  }
  return Promise.resolve(legacyCopy(html));
}
function legacyCopy(html) {
  const d = document.createElement("div"); d.contentEditable = "true"; d.innerHTML = html;
  Object.assign(d.style, { position: "fixed", left: "-9999px", top: "0", background: "#fff" });
  document.body.appendChild(d); const r = document.createRange(); r.selectNodeContents(d);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  let ok = false; try { ok = document.execCommand("copy"); } catch {}
  s.removeAllRanges(); d.remove(); return ok;
}

// ---------- .eml draft (multipart/related, image inline via cid, X-Unsent: 1) ----------
const b64 = (bytes) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const b64utf8 = (str) => b64(new TextEncoder().encode(str));
const wrap76 = (s) => s.replace(/.{1,76}/g, "$&\r\n");
const encWord = (s) => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64utf8(s)}?=`;
let cardBytes = null;
async function loadCard() {
  if (!cardBytes) { const r = await fetch(new URL(PARTY.inviteCard + "?eml", location.href)); if (!r.ok) throw new Error("card " + r.status); cardBytes = new Uint8Array(await r.arrayBuffer()); }
  return cardBytes;
}
export async function buildEml(emails, name, token) {
  const img = await loadCard(), id = Math.random().toString(36).slice(2), cid = `invite-card-${id}@frank-xmas`;
  const alt = `alt_${id}`, rel = `rel_${id}`;
  const lines = [
    `To: ${emails.join(", ")}`, `Subject: ${encWord(PARTY.emailSubject)}`, "X-Unsent: 1", "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${alt}"`, "", `--${alt}`,
    "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap76(b64utf8(emailText(name, token))),
    `--${alt}`, `Content-Type: multipart/related; boundary="${rel}"; type="text/html"`, "", `--${rel}`,
    "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "",
    wrap76(b64utf8(`<!doctype html><html><head><meta charset="utf-8"></head><body>${emailHtml(name, token, "cid:" + cid)}</body></html>`)),
    `--${rel}`, 'Content-Type: image/jpeg; name="invite-card.jpg"', "Content-Transfer-Encoding: base64", `Content-ID: <${cid}>`,
    'Content-Disposition: inline; filename="invite-card.jpg"', "", wrap76(b64(img)), `--${rel}--`, "", `--${alt}--`, ""];
  return lines.join("\r\n");
}
