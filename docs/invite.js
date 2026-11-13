import { db, withTimeout, mountCountdown, calendarLinks, esc, PARTY, hasAddress } from "./shared.js?v=20261113141651";
import { DANCES } from "./dances.js?v=20261113141651";
import { music } from "./music.js?v=20261113141651";
import { doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const BUILD = "20261113141651"; // set by tools/bump_version.py (cache-busting for JSON + images)
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.hash.slice(1) || location.search.slice(1));
const token = (params.get("t") || params.get("g") || "").trim();
const forceIntro = params.has("intro");
const preview = params.has("preview"); // host preview from the dashboard: never marks the invite as opened
let invite = null;

/* ---------------- lights + snow ---------------- */
(() => {
  const L = $(".lights"); const n = Math.ceil(innerWidth / 44);
  L.innerHTML = "<i></i>".repeat(n);
})();
(() => {
  const c = $("#snow"), x = c.getContext("2d"); let W, H, flakes = [];
  const size = () => { W = c.width = innerWidth * devicePixelRatio; H = c.height = innerHeight * devicePixelRatio;
    const n = Math.min(220, Math.round(innerWidth * innerHeight / 6000));
    flakes = Array.from({ length: n }, () => mk(true)); };
  const mk = (any) => ({ x: Math.random() * W, y: any ? Math.random() * H : -10, r: (Math.random() * 2.6 + .8) * devicePixelRatio,
    v: (Math.random() * .7 + .35) * devicePixelRatio, w: Math.random() * Math.PI * 2, o: Math.random() * .5 + .5 });
  const step = () => { x.clearRect(0, 0, W, H);
    for (const f of flakes) { f.y += f.v; f.w += .01; f.x += Math.sin(f.w) * .4 * devicePixelRatio;
      if (f.y > H + 10) Object.assign(f, mk(false));
      x.globalAlpha = f.o; x.beginPath(); x.arc(f.x, f.y, f.r, 0, 7); x.fillStyle = "#fff"; x.fill(); }
    requestAnimationFrame(step); };
  addEventListener("resize", size); size(); step();
})();

/* ---------------- music (see music.js — synthesized, starts only after a tap) ---------------- */
const mBtn = $("#musicBtn"); mBtn.hidden = true; // no music button (and no sound) until the present is opened
const paintMusic = (on) => { mBtn.setAttribute("aria-pressed", on); mBtn.innerHTML = `${on ? "🔊" : "🔇"} <span>Music</span>`;
  mBtn.title = on ? "Mute the music" : "Play Jingle Bells"; };
mBtn.addEventListener("click", () => { paintMusic(music.toggle()); });

/* ---------------- confetti / sparkle burst ---------------- */
function burst(host, n = 140, originY = .52) {
  const colors = ["#ff4d4d", "#ffd23f", "#3ddc84", "#4dabff", "#ffffff", "#ff8fd1"];
  for (let i = 0; i < n; i++) {
    const p = document.createElement("span"); p.className = "p";
    const star = Math.random() < .3; p.style.background = colors[i % colors.length];
    if (star) { p.style.width = p.style.height = "8px"; p.style.borderRadius = "50%"; p.style.boxShadow = `0 0 10px ${p.style.background}`; }
    p.style.top = originY * 100 + "%"; host.appendChild(p);
    const a = Math.random() * Math.PI * 2, sp = 180 + Math.random() * 380;
    const dx = Math.cos(a) * sp, dy = Math.sin(a) * sp - 220;
    p.animate([{ transform: "translate(-50%,-50%) rotate(0)", opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 720}deg)`, opacity: 1, offset: .55 },
      { transform: `translate(calc(-50% + ${dx * 1.2}px), calc(-50% + ${dy + 420}px)) rotate(${Math.random() * 1080}deg)`, opacity: 0 }],
      { duration: 1800 + Math.random() * 1200, easing: "cubic-bezier(.15,.7,.4,1)" }).onfinish = () => p.remove();
  }
}

/* ---------------- intro ---------------- */
function openGift() {
  const g = $("#gift"); if (g.classList.contains("open")) return;
  g.classList.add("open"); burst($("#burst")); mBtn.hidden = false;
  // sound is ON by default: the tap on the present is the user gesture that unlocks audio -> party burst, then the music
  try { paintMusic(music.start(true)); } catch (e) { console.warn("audio", e); }
  setTimeout(() => { $("#invite").hidden = false; $("#intro")?.classList.add("gone"); revealObserver(); window.scrollTo(0, 0); }, 900);
  setTimeout(() => { $("#intro")?.remove(); }, 2000);
}
$("#gift").addEventListener("click", openGift);
if (PARTY.introPhoto) { const i = $("#intro"); i.classList.add("has-photo"); i.style.backgroundImage = `radial-gradient(600px 500px at 50% 45%, rgba(11,26,51,.35), rgba(5,11,23,.88)), url("${PARTY.introPhoto}")`; }

/* ---------------- static content ---------------- */
$("#partyTitle").textContent = PARTY.title;
$("#partyWhen").textContent = PARTY.timeText;
$("#partyWhere").innerHTML = hasAddress()
  ? `📍 <a href="https://maps.google.com/?q=${encodeURIComponent(PARTY.address)}" target="_blank" rel="noopener">${esc(PARTY.address)}</a>`
  : `📍 ${esc(PARTY.areaText)} · <span class="addr-tbd">exact address coming soon</span>`;
$("#rsvpBy").textContent = PARTY.rsvpBy;
$("#footHosts").innerHTML = `${esc(PARTY.hosts)} · <a href="#" id="replay" style="color:inherit">🎁 replay intro</a>`;
$("#replay").addEventListener("click", (e) => { e.preventDefault(); location.hash = (token ? "t=" + token + "&" : "") + "intro"; location.reload(); });
mountCountdown($("#countdown"));
const cal = calendarLinks(); $("#gcal").href = cal.google; $("#ics").href = cal.icsUrl;

/* "scroll for more" cue: stays on screen while there's more below; hides within 40px of the bottom, comes back on scroll up */
function showScrollCue() {
  const c = $("#scrollCue"); if (!c || c.dataset.on) return; c.dataset.on = "1"; c.hidden = false;
  let raf = 0;
  const update = () => { raf = 0;
    const max = document.documentElement.scrollHeight - innerHeight, y = scrollY || document.documentElement.scrollTop;
    c.classList.toggle("gone", max - y <= 40);
    c.classList.toggle("compact", y > 40); };
  const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
  addEventListener("scroll", queue, { passive: true }); addEventListener("resize", queue);
  if (window.ResizeObserver) new ResizeObserver(queue).observe(document.body);
  update();
  c.onclick = () => {
    const y = scrollY, h = innerHeight;
    const next = [...document.querySelectorAll("#invite > section, #invite > footer")]
      .map((el) => el.getBoundingClientRect().top + y - 12).find((top) => top > y + 60 && top < y + h * 1.1);
    window.scrollTo({ top: next ?? y + Math.round(h * 0.85), behavior: "smooth" });
  };
}
function revealObserver() { showScrollCue();
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
}

/* ---------------- slideshow ---------------- */
(async () => {
  let photos = [];
  try { photos = await (await fetch(`images/photos/photos.json?v=${BUILD}`, { cache: "no-cache" })).json(); } catch {}
  if (!photos.length) { $("#photos").remove(); return; }
  const slides = $("#slides"), dots = $("#slDots"); let i = 0, t;
  photos.forEach((p, k) => {
    slides.insertAdjacentHTML("beforeend", `<div class="slide"><img src="images/photos/${encodeURI(p.file)}?v=${BUILD}" alt="${esc(p.caption || "")}" loading="${k ? "lazy" : "eager"}"></div>`);
    const d = document.createElement("button"); d.setAttribute("aria-label", `Photo ${k + 1}`); d.onclick = () => go(k, true); dots.appendChild(d);
  });
  const go = (k, user) => { i = (k + photos.length) % photos.length;
    slides.querySelectorAll(".slide").forEach((s, j) => s.classList.toggle("on", j === i));
    dots.querySelectorAll("button").forEach((s, j) => s.classList.toggle("on", j === i));
    $("#slCap").textContent = photos[i].caption || ""; if (user) { clearInterval(t); t = setInterval(() => go(i + 1), 5000); } };
  $(".sl-prev").onclick = () => go(i - 1, true); $(".sl-next").onclick = () => go(i + 1, true);
  let sx = null; const ss = $("#slideshow");
  ss.addEventListener("touchstart", (e) => sx = e.touches[0].clientX, { passive: true });
  ss.addEventListener("touchend", (e) => { if (sx == null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1), true); sx = null; });
  ss.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") go(i - 1, true); if (e.key === "ArrowRight") go(i + 1, true); });
  go(0); t = setInterval(() => go(i + 1), 5000);
})();

/* ---------------- elf dance ---------------- */
document.body.insertAdjacentHTML("beforeend", `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<pattern id="stripeR" width="16" height="12" patternUnits="userSpaceOnUse"><rect width="16" height="6" fill="#d7263d"/><rect y="6" width="16" height="6" fill="#fff"/></pattern>
<pattern id="stripeG" width="16" height="12" patternUnits="userSpaceOnUse"><rect width="16" height="6" fill="#1f7a3a"/><rect y="6" width="16" height="6" fill="#fff"/></pattern>
</defs></svg>`);
const tunics = [["#1f9a4a", "#d7263d", "stripeR"], ["#d7263d", "#1f9a4a", "stripeG"], ["#1f9a4a", "#ffd23f", "stripeR"], ["#c21f3a", "#ffffff", "stripeG"]];
function armsSVG(k) {
  const [tun, col] = tunics[k % tunics.length];
  return `<svg class="elf-arms" viewBox="0 0 110 150" aria-hidden="true">
  <g class="arm arm-l"><rect x="12" y="12" width="18" height="30" rx="9" fill="${tun}"/><g class="fore"><rect x="12" y="32" width="18" height="30" rx="9" fill="${tun}"/><rect x="12" y="50" width="18" height="7" fill="${col}"/><circle cx="21" cy="66" r="8.5" style="fill:var(--skin,#f1c27d)"/></g></g>
  <g class="arm arm-r"><rect x="80" y="12" width="18" height="30" rx="9" fill="${tun}"/><g class="fore"><rect x="80" y="32" width="18" height="30" rx="9" fill="${tun}"/><rect x="80" y="50" width="18" height="7" fill="${col}"/><circle cx="89" cy="66" r="8.5" style="fill:var(--skin,#f1c27d)"/></g></g>
</svg>`;
}
function elfSVG(k) {
  const [tun, col, stripe] = tunics[k % tunics.length];
  return `<svg class="elf-body" viewBox="0 0 110 150" aria-hidden="true">
  <rect class="neck" x="44" y="-10" width="22" height="24" rx="8" style="fill:var(--skin,#f1c27d)"/><rect x="44" y="-2" width="22" height="8" fill="rgba(90,40,30,.18)"/>
  <g class="leg leg-l"><rect x="37" y="86" width="15" height="44" rx="5" fill="url(#${stripe})"/><path d="M34 126 h20 v10 q0 6 -8 6 h-14 q-12 0 -14 -10 q6 4 12 0 z" fill="${tun}"/></g>
  <g class="leg leg-r"><rect x="58" y="86" width="15" height="44" rx="5" fill="url(#${stripe})"/><path d="M56 126 h20 v10 q0 6 8 6 h0 q12 0 14 -10 q-6 4 -12 0 l-2 10 h-28 z" fill="${tun}"/></g>
  <path d="M30 8 h50 l12 84 l-9 -7 l-7 8 l-7 -8 l-7 8 l-7 -8 l-7 8 l-7 -8 l-7 8 l-7 -8 l-9 7 z" fill="${tun}"/>
  <rect x="25" y="58" width="60" height="10" fill="#2a1a12"/><rect x="48" y="56" width="14" height="14" rx="2" fill="none" stroke="#ffd23f" stroke-width="3"/>
  <circle cx="55" cy="30" r="3" fill="#ffd23f"/><circle cx="55" cy="44" r="3" fill="#ffd23f"/>
  <path d="M26 6 l8 14 l7 -12 l7 12 l7 -12 l7 12 l7 -12 l7 12 l8 -14 z" fill="${col}"/>
</svg>`;
}
const hatSVG = (k) => { const [tun, col] = tunics[k % tunics.length]; const hat = k % 2 ? "#1f9a4a" : "#d7263d";
  return `<svg class="elf-hat" viewBox="0 0 106 72" aria-hidden="true"><path d="M14 54 Q34 8 84 6 Q70 22 92 52 z" fill="${hat}"/><circle cx="86" cy="7" r="8" fill="#fff"/><rect x="8" y="48" width="90" height="16" rx="8" fill="#fff"/><circle cx="20" cy="56" r="2" fill="#ffd23f"/><circle cx="53" cy="56" r="2" fill="${tun}"/><circle cx="86" cy="56" r="2" fill="#ffd23f"/></svg>`; };
const earsSVG = `<svg class="elf-ears" viewBox="0 0 106 30" aria-hidden="true">
<path d="M20 12 Q6 8 0 0 Q4 16 14 27 Q20 24 20 12 z" style="fill:var(--skin,#f1c27d)"/><path d="M17 14 Q9 11 6 7 Q9 17 14 23 z" fill="rgba(160,70,60,.28)"/>
<path d="M86 12 Q100 8 106 0 Q102 16 92 27 Q86 24 86 12 z" style="fill:var(--skin,#f1c27d)"/><path d="M89 14 Q97 11 100 7 Q97 17 92 23 z" fill="rgba(160,70,60,.28)"/></svg>`;
const MOVES = ["m-bounce", "m-twist", "m-kick", "m-wave"];
/* tap an elf -> a random pop-culture dance (never the same one twice in a row for that elf) + a name bubble */
function startDance(el, d) {
  el.dataset.last = d.id; clearTimeout(el._dt);
  el.classList.add("dancing", "d-" + d.id);
  const tag = document.createElement("span"); tag.className = "dance-tag"; tag.textContent = d.label; tag.style.setProperty("--ms", d.ms + "ms"); el.appendChild(tag);
  placeTag(tag, el);
  el._dt = setTimeout(() => { el.classList.remove("dancing", "d-" + d.id); tag.remove(); }, d.ms + 60);
}
/* keep dance-name labels from overlapping each other (all 5 can show at once) and inside the stage.
   Uses layout boxes (offset*), which ignore the pop-in scale animation. */
function placeTag(tag, el) {
  const row = el.parentElement, stage = row.closest(".stage"), W = tag.offsetWidth, H = tag.offsetHeight, gap = 3;
  const sx = row.offsetLeft, pad = 4, stageW = stage.clientWidth;
  let x = el.offsetLeft + el.offsetWidth / 2 - W / 2, dx = 0;                     // row coords, before clamping
  if (sx + x < pad) dx = pad - (sx + x); if (sx + x + W > stageW - pad) dx = stageW - pad - (sx + x + W);
  x += dx; const y0 = el.offsetTop - 14;
  const others = [...row.querySelectorAll(".dance-tag")].filter((t) => t !== tag && t._box).map((t) => t._box);
  const hit = (b) => others.some((o) => b.x < o.x + o.w + gap && o.x < b.x + b.w + gap && b.y < o.y + o.h + gap && o.y < b.y + b.h + gap);
  let dy = 0;
  for (const k of [0, 1, -1, 2, -2, 3]) { const b = { x, y: y0 + k * (H + gap), w: W, h: H }; if (!hit(b)) { dy = k * (H + gap); break; } }
  tag._box = { x, y: y0 + dy, w: W, h: H };
  tag.style.top = (-14 + dy) + "px"; tag.style.marginLeft = dx + "px";
}
function resetDance(el) { clearTimeout(el._dt); DANCES.forEach((x) => el.classList.remove("d-" + x.id)); el.classList.remove("dancing"); el.querySelectorAll(".dance-tag").forEach((t) => t.remove()); }
/* tap an elf -> a random pop-culture dance (never the same one twice in a row for that elf) + a name bubble */
function dance(el) {
  const pick = DANCES.filter((d) => d.id !== el.dataset.last); const d = pick[Math.floor(Math.random() * pick.length)];
  resetDance(el); void el.offsetWidth; startDance(el, d);
}
/* "New moves": every elf does a different signature dance at the same moment (no duplicates, no repeat of its last one) */
function groupDance(els) {
  let plan = null;
  for (let tries = 0; tries < 50 && !plan; tries++) {
    const pool = [...DANCES].sort(() => Math.random() - .5), used = new Set(), p = [];
    for (const el of els) { const d = pool.find((x) => !used.has(x.id) && x.id !== el.dataset.last); if (!d) break; used.add(d.id); p.push(d); }
    if (p.length === els.length) plan = p;
  }
  if (!plan) plan = els.map((_, i) => DANCES[i % DANCES.length]);
  els.forEach(resetDance); void els[0]?.offsetWidth;          // one reflow, then start everyone in the same frame
  els.forEach((el, i) => startDance(el, plan[i]));
}
(async () => {
  let faces = [];
  try { faces = await (await fetch(`images/faces/faces.json?v=${BUILD}`, { cache: "no-cache" })).json(); } catch {}
  if (!faces.length) faces = [{ file: "", name: "Elf" }];
  const row = $("#elfRow");
  faces.slice(0, 12).forEach((f, k) => {
    const b = document.createElement("button"); b.className = "elf" + (f.cutout ? " elf-cut" : ""); if (f.skin) b.style.setProperty("--skin", f.skin); b.setAttribute("aria-label", `${f.name} the elf — tap for a dance`);
    b.innerHTML = `<div class="elf-in">${elfSVG(k)}<div class="elf-head">${earsSVG}<img src="images/faces/${encodeURI(f.file)}?v=${BUILD}" alt="">${hatSVG(k)}</div>${armsSVG(k)}</div><span class="elf-name">${esc(f.name)}</span>`;
    b.addEventListener("click", () => dance(b));
    row.appendChild(b);
  });
  const shuffle = () => row.querySelectorAll(".elf").forEach((el, k) => {
    MOVES.forEach((m) => el.classList.remove(m)); el.classList.add(MOVES[Math.floor(Math.random() * MOVES.length)]);
    el.querySelectorAll(".elf-in,.elf-head,.arm,.leg,.fore").forEach((p) => p.style.animationDelay = `${-(k * 0.13)}s`); });
  shuffle(); $("#newMoves").onclick = () => { shuffle(); groupDance([...row.querySelectorAll(".elf")]); };
  $("#discoBtn").onclick = (e) => { const on = $("#stage").classList.toggle("disco-on"); e.currentTarget.textContent = on ? "🌙 Normal lights" : "🪩 Disco mode";
    music.setTrack(on ? "disco" : "xmas"); };
})();

/* ---------------- RSVP ---------------- */
const state = { status: null, adults: 2, kids: 0 };
const fmtStatus = { yes: "Yes 🎄", no: "Can't make it", maybe: "Maybe 🤔" };
function paint() {
  document.querySelectorAll(".ch").forEach((b) => b.setAttribute("aria-checked", b.dataset.v === state.status));
  $("#adults").textContent = state.adults; $("#kids").textContent = state.kids;
  $("#counts").classList.toggle("off", state.status === "no");
  $("#saveBtn").disabled = !state.status || (state.status !== "no" && state.adults + state.kids === 0);
  $("#saveBtn").textContent = invite && invite.status && invite.status !== "none" ? "Update my RSVP" : "Send my RSVP";
}
document.querySelectorAll(".ch").forEach((b) => b.addEventListener("click", () => { state.status = b.dataset.v; paint(); }));
document.querySelectorAll(".stepper button").forEach((b) => b.addEventListener("click", () => {
  const k = b.dataset.s; state[k] = Math.max(0, Math.min(30, state[k] + +b.dataset.d)); paint(); }));
function showCurrent() {
  const el = $("#rsvpCurrent");
  if (!invite || !invite.status || invite.status === "none") { el.hidden = true; return; }
  const when = invite.updatedAt?.toDate ? invite.updatedAt.toDate().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
  const who = invite.status === "no" ? "" : ` · ${invite.adults} adult${invite.adults === 1 ? "" : "s"}, ${invite.kids} kid${invite.kids === 1 ? "" : "s"}`;
  el.innerHTML = `Your current answer: <b>${fmtStatus[invite.status]}</b>${who}${when ? `<br><small>saved ${esc(when)} — you can change it anytime below</small>` : ""}`;
  el.hidden = false;
}
function msg(kind, html) { const m = $("#saveMsg"); m.className = "save-msg " + kind; m.innerHTML = html; m.hidden = false; }
async function save() {
  const btn = $("#saveBtn"); btn.disabled = true; msg("busy", "⏳ Saving your RSVP…");
  const data = { status: state.status, adults: state.status === "no" ? 0 : state.adults, kids: state.status === "no" ? 0 : state.kids,
    note: $("#note").value.trim().slice(0, 500), updatedAt: serverTimestamp() };
  try {
    await withTimeout(updateDoc(doc(db, "invites", token), data), 10000);
    invite = { ...invite, ...data, updatedAt: { toDate: () => new Date() } }; showCurrent();
    const thanks = { yes: "Yay! You're on the list — see you Christmas Eve! 🎅", maybe: "Got it — we hope you can make it! Update anytime with this same link.", no: "Thanks for letting us know — we'll miss you! 💚" };
    msg("ok", `✅ Saved! ${thanks[data.status]}`);
    if (data.status === "yes") { const r = $("#rsvp").getBoundingClientRect(); const h = document.createElement("div"); h.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:50"; document.body.appendChild(h); burst(h, 120, .5); setTimeout(() => h.remove(), 3500); }
  } catch (e) {
    console.error(e);
    msg("err", `<span>❌ Your RSVP did <b>not</b> save${e.message === "timeout" ? " (no connection)" : ""}. Please check your internet and try again.</span><button type="button" id="retry">Retry</button>`);
    $("#retry").onclick = save;
  } finally { paint(); }
}
$("#saveBtn").addEventListener("click", save);

async function loadInvite() {
  if (!token) { $("#rsvpWrap").hidden = true; $("#noToken").hidden = false; return; }
  try {
    const snap = await withTimeout(getDoc(doc(db, "invites", token)), 12000);
    if (!snap.exists()) throw new Error("notfound");
    invite = snap.data();
    $("#greet").textContent = `Merry Christmas, ${invite.name}!`;
    $("#introHello").textContent = `Ho ho ho, ${invite.name}!`;
    $("#giftTag").textContent = `To: ${invite.name}`;
    if (invite.status && invite.status !== "none") { state.status = invite.status; state.adults = invite.adults; state.kids = invite.kids; $("#note").value = invite.note || ""; }
    showCurrent(); paint();
    if (!invite.openedAt && !preview) updateDoc(doc(db, "invites", token), { openedAt: serverTimestamp() }).catch(() => {});
  } catch (e) {
    $("#rsvpWrap").hidden = true; const n = $("#noToken"); n.hidden = false;
    n.textContent = e.message === "notfound" ? "Hmm, we couldn't find this invitation link. Please check the link from your message, or contact the Franks."
      : "We couldn't load your RSVP right now (connection problem). Please refresh the page to try again.";
  }
}
await loadInvite();
// Every visit starts at the present (sound ON by default): tapping it is the gesture browsers require before audio can play,
// so it always gives the party burst + music. (Older builds skipped the present for returning guests, which left the music off.)
