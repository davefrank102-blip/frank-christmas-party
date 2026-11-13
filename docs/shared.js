import { PARTY, FIREBASE, hasAddress } from "./config.js?v=20261112204044";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

export const app = initializeApp(FIREBASE);
export const db = getFirestore(app);

export function withTimeout(p, ms = 10000) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

export function countdownParts(now = Date.now()) {
  const s = new Date(PARTY.start).getTime(), e = new Date(PARTY.end).getTime();
  if (now >= e) return { phase: "over" };
  if (now >= s) return { phase: "live" };
  let d = Math.floor((s - now) / 1000);
  const days = Math.floor(d / 86400); d %= 86400;
  const hours = Math.floor(d / 3600); d %= 3600;
  return { phase: "soon", days, hours, mins: Math.floor(d / 60), secs: d % 60 };
}

export function mountCountdown(el) {
  const pad = (n) => String(n).padStart(2, "0");
  const tick = () => {
    const c = countdownParts();
    if (c.phase === "live") { el.innerHTML = `<div class="cd-msg">🎉 It's party time! 🎉</div>`; return; }
    if (c.phase === "over") { el.innerHTML = `<div class="cd-msg">Thanks for celebrating with us! 🎄</div>`; return; }
    el.innerHTML = [["days", c.days], ["hours", c.hours], ["mins", c.mins], ["secs", c.secs]]
      .map(([l, v]) => `<div class="cd-box"><span class="cd-num">${l === "days" ? v : pad(v)}</span><span class="cd-lbl">${l}</span></div>`).join("");
  };
  tick(); return setInterval(tick, 1000);
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const icsDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export function calendarLinks() {
  const loc = hasAddress() ? PARTY.address : PARTY.areaText;
  const g = new URL("https://calendar.google.com/calendar/render");
  g.searchParams.set("action", "TEMPLATE");
  g.searchParams.set("text", PARTY.title);
  g.searchParams.set("dates", `${icsDate(PARTY.start)}/${icsDate(PARTY.end)}`);
  g.searchParams.set("details", PARTY.details);
  g.searchParams.set("location", loc);
  g.searchParams.set("ctz", "America/New_York");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Frank Family//Christmas Party//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:frank-xmas-2026@frankfamily`, `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(PARTY.start)}`, `DTEND:${icsDate(PARTY.end)}`,
    `SUMMARY:${PARTY.title}`, `DESCRIPTION:${PARTY.details.replace(/[,;]/g, (m) => "\\" + m)}`,
    `LOCATION:${loc.replace(/[,;]/g, (m) => "\\" + m)}`,
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Frank Family Christmas Eve Party tomorrow!", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  return { google: g.toString(), icsUrl: URL.createObjectURL(new Blob([ics], { type: "text/calendar" })) };
}

export { PARTY, hasAddress };
