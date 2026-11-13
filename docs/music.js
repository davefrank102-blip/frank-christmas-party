/* =====================================================================
   Christmas music engine — 100% synthesized in the browser (WebAudio),
   no audio files, no licensing. "Jingle Bells" (James Lord Pierpont, 1857,
   public domain) arranged for glockenspiel + celesta lead, sleigh bells on
   the beat, tubular-bell phrase hits, warm bass, offbeat "piano" chords,
   string pad and a hall reverb. Only ever starts from a user tap.
   ===================================================================== */
const BPM = 128, BEAT = 60 / BPM;
const M = (n) => { // "C5" / "F#4" -> frequency
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n); const s = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
  return 440 * 2 ** ((s + 12 * (+m[3] + 1) - 69) / 12); };

// melody: "note:beats" per bar ("-" = rest). Key of C.
const VERSE = [
  "G4:1 E5:1 D5:1 C5:1", "G4:3 G4:.5 G4:.5", "G4:1 E5:1 D5:1 C5:1", "A4:4",
  "A4:1 F5:1 E5:1 D5:1", "B4:4", "G5:1 G5:1 F5:1 D5:1", "E5:4",
  "G4:1 E5:1 D5:1 C5:1", "G4:4", "G4:1 E5:1 D5:1 C5:1", "A4:3 A4:1",
  "A4:1 F5:1 E5:1 D5:1", "G5:1 G5:1 G5:1 G5:1", "A5:1 G5:1 F5:1 D5:1", "C5:2 -:2"];
const CHORUS = [
  "E5:1 E5:1 E5:2", "E5:1 E5:1 E5:2", "E5:1 G5:1 C5:1.5 D5:.5", "E5:4",
  "F5:1 F5:1 F5:1.5 F5:.5", "F5:1 E5:1 E5:1 E5:.5 E5:.5", "E5:1 D5:1 D5:1 E5:1", "D5:2 G5:2",
  "E5:1 E5:1 E5:2", "E5:1 E5:1 E5:2", "E5:1 G5:1 C5:1.5 D5:.5", "E5:4",
  "F5:1 F5:1 F5:1.5 F5:.5", "F5:1 E5:1 E5:1 E5:.5 E5:.5", "G5:1 G5:1 F5:1 D5:1", "C5:4"];
const CH = { C: ["C3", "E4", "G4", "C5"], F: ["F2", "F4", "A4", "C5"], G: ["G2", "D4", "G4", "B4"], G7: ["G2", "F4", "B4", "D5"],
  D7: ["D3", "F#4", "A4", "C5"], Am: ["A2", "E4", "A4", "C5"], Dm: ["D3", "F4", "A4", "D5"] };
const VERSE_CH = ["C", "C", "C", "F", "Dm", "G", "G7", "C", "C", "C", "C", "F", "Dm", "G", "G7", "C"];
const CHORUS_CH = ["C", "C", "C", "C", "F", "C", "D7", "G7", "C", "C", "C", "C", "F", "C", "G7", "C"];
const SONG = [...CHORUS.map((m, i) => [m, CHORUS_CH[i], "chorus"]), ...VERSE.map((m, i) => [m, VERSE_CH[i], "verse"]),
  ...CHORUS.map((m, i) => [m, CHORUS_CH[i], "chorus2"])];
const FIFTH = { C: "G2", F: "C3", G: "D3", G7: "D3", D7: "A2", Am: "E3", Dm: "A2" };

export const MIX = { glock: 1.6, celesta: 3.2, tubular: 1.2, sleigh: .11, bass: .35, stab: 1.6, pad: 1.4, burst: 1.7, master: .85 };
let ac, out, wet, comp, sleighBufs = [], longShake, timer, on = false, bar = 0, barT = 0;

function setup(ctx) {
  ac = ctx || new (window.AudioContext || window.webkitAudioContext)();
  comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = .005; comp.release.value = .25;
  const lim = ac.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .1;
  out = ac.createGain(); out.gain.value = 0; out.connect(comp).connect(lim).connect(ac.destination);
  // hall reverb from a generated stereo impulse
  const len = ac.sampleRate * 2.6, ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) { lp += ((Math.random() * 2 - 1) - lp) * .35; d[i] = lp * Math.pow(1 - i / len, 3.2); } }
  const cv = ac.createConvolver(); cv.buffer = ir; wet = ac.createGain(); wet.gain.value = .55; wet.connect(cv).connect(out);
  // sleigh bells: clusters of tiny metallic jingles, rendered once to buffers
  const jingleBuf = (dur, n, spread, env) => { const b = ac.createBuffer(2, ac.sampleRate * dur, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c);
      for (let k = 0; k < n; k++) { const t0 = env ? Math.random() * spread : Math.pow(Math.random(), 1.8) * spread;
        const s0 = Math.floor(t0 * ac.sampleRate), a = (.5 + Math.random() * .5) * (env ? env(t0) : 1);
        for (let p = 0; p < 3; p++) { const f = 3800 + Math.random() * 6200, tau = .02 + Math.random() * .05, sr = ac.sampleRate;
          // damped sinusoid via a 2-pole resonator (no sin/exp per sample -> fast enough to run inside the tap on a phone)
          const w = 6.2832 * f / sr, r = Math.exp(-1 / (tau * sr)), c1 = 2 * r * Math.cos(w), c2 = -r * r, n = Math.min(d.length - s0, Math.ceil(tau * 4.5 * sr));
          let y1 = a * .18 * Math.sin(w), y2 = 0; for (let i = 0; i < n; i++) { d[s0 + i] += y1; const y = c1 * y1 + c2 * y2; y2 = y1; y1 = y; } } } }
    return b; };
  sleighBufs = [0, 1, 2].map(() => jingleBuf(.32, 26, .045));
  longShake = jingleBuf(1.8, 260, 1.4, (t) => (.55 + .45 * Math.sin(t * 6.2832 * 7)) * Math.min(1, t * 6) * (1 - t / 1.4));
}

const pan = (node, p) => { if (!ac.createStereoPanner) return node; const s = ac.createStereoPanner(); s.pan.value = p; node.connect(s); return s; };
const route = (node, dry, send) => { const g = ac.createGain(), w = ac.createGain(); g.gain.value = dry; w.gain.value = send; node.connect(g).connect(out); node.connect(w).connect(wet); };
function partial(f, t, g, dec, dst, type = "sine") {
  const o = ac.createOscillator(), v = ac.createGain(); o.type = type; o.frequency.value = f;
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + .003); v.gain.setTargetAtTime(0, t + .003, dec / 4);
  o.connect(v).connect(dst); o.start(t); o.stop(t + dec * 1.6 + .05); }
function bus(dry, send, p = 0) { const g = ac.createGain(); route(pan(g, p), dry, send); return g; }

const glock = (f, t, vel = 1) => { vel *= MIX.glock; const b = bus(.5 * vel, .35 * vel, .18);
  [[1, 1, 1.4], [2.76, .32, .45], [5.4, .11, .22], [8.93, .04, .1]].forEach(([r, g, d]) => partial(f * r, t, g * .12, d, b)); };
const celesta = (f, t, d, vel = 1) => { vel *= MIX.celesta; const b = bus(.6 * vel, .3 * vel, -.15);
  partial(f, t, .11, Math.max(.6, d * 1.3), b); partial(f * 2, t, .035, .4, b); partial(f * 4.01, t, .012, .15, b); };
function tubular(f, t, vel = 1, len = 4) { vel *= MIX.tubular; const b = bus(.45 * vel, .6 * vel, 0);
  [[.5, .35, 1], [1, 1, .8], [1.19, .35, .6], [1.5, .3, .55], [2, .55, .45], [2.52, .2, .3], [3.01, .18, .25], [4.17, .08, .15], [5.43, .05, .1]]
    .forEach(([r, g, d]) => partial(f * r, t, g * .09, len * d, b)); }
function sleigh(t, vel, p = 0) { vel *= MIX.sleigh; const s = ac.createBufferSource(); s.buffer = sleighBufs[Math.floor(Math.random() * 3)];
  s.playbackRate.value = .94 + Math.random() * .12; const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2600;
  const g = ac.createGain(); g.gain.value = vel; s.connect(hp).connect(g); route(pan(g, p), .9, .25); s.start(t); }
function bass(f, t, d) { const o = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), v = ac.createGain();
  o.type = "triangle"; o2.type = "sine"; o.frequency.value = f; o2.frequency.value = f; lp.type = "lowpass"; lp.frequency.value = 700;
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(.24, t + .008); v.gain.setTargetAtTime(.12, t + .02, .12); v.gain.setTargetAtTime(0, t + d * .85, .05);
  o.connect(lp); o2.connect(lp); lp.connect(v); route(v, .9 * MIX.bass, .08 * MIX.bass); [o, o2].forEach((x) => { x.start(t); x.stop(t + d + .3); }); }
function stab(notes, t) { const b = bus(.55 * MIX.stab, .25 * MIX.stab, .05), lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200; lp.connect(b);
  notes.forEach((n) => { const o = ac.createOscillator(), v = ac.createGain(); o.type = "triangle"; o.frequency.value = M(n);
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(.045, t + .006); v.gain.setTargetAtTime(0, t + .01, .09);
    o.connect(v).connect(lp); o.start(t); o.stop(t + .6); }); }
function pad(notes, t, d) { const lp = ac.createBiquadFilter(), v = ac.createGain(); lp.type = "lowpass"; lp.frequency.value = 950; lp.Q.value = .4;
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(.05, t + .5); v.gain.setValueAtTime(.05, t + d - .3); v.gain.linearRampToValueAtTime(0, t + d + .5);
  lp.connect(v); route(v, .5 * MIX.pad, .9 * MIX.pad);
  notes.forEach((n) => [-7, 7].forEach((det) => { const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = M(n); o.detune.value = det;
    const g = ac.createGain(); g.gain.value = .12; o.connect(g).connect(lp); o.start(t); o.stop(t + d + .6); })); }

function playBar(k, t) {
  const [mel, chord, part] = SONG[k % SONG.length], c = CH[chord], phrase = k % 4 === 0;
  // melody
  let b = 0; for (const tok of mel.split(" ")) { const [n, d] = tok.split(":"); const dur = +d * BEAT;
    if (n !== "-") { const f = M(n), acc = b === 0 ? 1 : .82; celesta(f, t + b * BEAT, dur, acc); if (part !== "verse" || b === 0) glock(f * 2, t + b * BEAT, part === "chorus2" ? .95 : .7); }
    b += +d; }
  // bass oom-pah + offbeat chord stabs
  for (let q = 0; q < 4; q++) { const tq = t + q * BEAT;
    bass(M(q % 2 ? FIFTH[chord] : c[0]), tq, BEAT * .9);
    if (q % 2) stab(c.slice(1), tq); else if (part !== "verse") stab(c.slice(1), tq + BEAT * .5); }
  pad(c.slice(1).map((n) => n.replace(/\d$/, (o) => o - 1)), t, 4 * BEAT);
  // sleigh bells: 8ths, accents on 2 & 4, busier in the chorus
  for (let e = 0; e < 8; e++) { const accent = e === 2 || e === 6, down = e % 2 === 0;
    if (part === "verse" && !down && !accent && Math.random() < .5) continue;
    sleigh(t + e * BEAT / 2 + (down ? 0 : .012), accent ? .95 : down ? .55 : .38, e % 2 ? .3 : -.3); }
  // tubular bell on each phrase downbeat
  if (phrase) tubular(M(c[0].replace(/\d$/, "4")), t, .6, 3.5);
}

function sched() { while (barT < ac.currentTime + .35) {
    playBar(bar, barT); barT += 4 * BEAT; bar++;
    if (bar % SONG.length === 0) barT += 2 * BEAT; } }

/* ---------------- party burst (all synthesized) ---------------- */
let noiseBuf;
const noise = () => { if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); let b0 = 0, b1 = 0, b2 = 0; // pinkish noise
  for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = .997 * b0 + .03 * w; b1 = .985 * b1 + .03 * w; b2 = .95 * b2 + .06 * w; d[i] = (b0 + b1 + b2 + w * .2) * .6; } }
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = Math.random(); return s; };
function env(g, t, pts) { g.gain.setValueAtTime(0, t); for (const [dt, v] of pts) g.gain.linearRampToValueAtTime(v, t + dt); }
/** confetti popper: sharp crack + low thump + paper "fsshh" */
function popper(t, p = 0, vel = 1) { vel *= MIX.burst;
  const n = noise(), bp = ac.createBiquadFilter(), g = ac.createGain(); bp.type = "bandpass"; bp.frequency.value = 1800 + Math.random() * 1200; bp.Q.value = .7;
  env(g, t, [[.002, .9 * vel], [.06, .05 * vel], [.12, 0]]); n.connect(bp).connect(g); route(pan(g, p), 1, .3); n.start(t); n.stop(t + .2);
  const o = ac.createOscillator(), og = ac.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(45, t + .12);
  env(og, t, [[.003, .7 * vel], [.15, 0]]); o.connect(og); route(pan(og, p), 1, .1); o.start(t); o.stop(t + .2);
  const n2 = noise(), hp = ac.createBiquadFilter(), g2 = ac.createGain(); hp.type = "highpass"; hp.frequency.value = 5000;
  env(g2, t + .02, [[.05, .12 * vel], [.9, 0]]); n2.connect(hp).connect(g2); route(pan(g2, -p), .8, .5); n2.start(t); n2.stop(t + 1.1); }
/** party blowout horn: buzzy reed rising in pitch, with flutter */
function horn(t, f0, dur, p = 0, vel = 1) { vel *= MIX.burst;
  const o = ac.createOscillator(), o2 = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain();
  o.type = "sawtooth"; o2.type = "square"; o2.detune.value = 12;
  [o, o2].forEach((x) => { x.frequency.setValueAtTime(f0 * .78, t); x.frequency.linearRampToValueAtTime(f0, t + .12); x.frequency.setValueAtTime(f0, t + dur - .15); x.frequency.linearRampToValueAtTime(f0 * .92, t + dur); });
  lfo.frequency.value = 22 + Math.random() * 8; lg.gain.value = f0 * .025; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
  const f1 = ac.createBiquadFilter(), f2 = ac.createBiquadFilter(), g = ac.createGain(); f1.type = "bandpass"; f1.frequency.value = 1100; f1.Q.value = 1.2;
  f2.type = "peaking"; f2.frequency.value = 2600; f2.gain.value = 8; env(g, t, [[.03, .16 * vel], [dur - .05, .13 * vel], [dur, 0]]);
  o.connect(f1); o2.connect(f1); f1.connect(f2).connect(g); route(pan(g, p), 1, .35); [o, o2, lfo].forEach((x) => { x.start(t); x.stop(t + dur + .05); }); }
/** crowd: roar (formant-filtered noise swells) + applause (hundreds of claps) + "woo!" voices */
function crowd(t, len = 3.2, vel = 1) { vel *= MIX.burst;
  [[650, 5, .5], [1100, 6, .4], [2400, 7, .22], [350, 4, .35]].forEach(([f, q, gn], k) => {
    const n = noise(), bp = ac.createBiquadFilter(), g = ac.createGain(), am = ac.createOscillator(), ag = ac.createGain();
    bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q / 3;
    env(g, t, [[.25, gn * vel], [len * .45, gn * vel * .8], [len, 0]]);
    am.frequency.value = 3 + k * 1.7; ag.gain.value = gn * vel * .25; am.connect(ag).connect(g.gain);
    n.connect(bp).connect(g); route(pan(g, (k % 2 ? .4 : -.4)), .8, .6); n.start(t); n.stop(t + len + .1); am.start(t); am.stop(t + len + .1); });
  for (let i = 0; i < 170; i++) { const tc = t + .15 + Math.pow(Math.random(), 1.4) * (len - .5); // claps thin out over time
    const n = noise(), bp = ac.createBiquadFilter(), g = ac.createGain(); bp.type = "bandpass"; bp.frequency.value = 900 + Math.random() * 1600; bp.Q.value = 1.5;
    env(g, tc, [[.001, (.18 + Math.random() * .2) * vel], [.025, 0]]); n.connect(bp).connect(g); route(pan(g, Math.random() * 1.6 - .8), .8, .4); n.start(tc); n.stop(tc + .04); }
  for (let i = 0; i < 7; i++) { const tw = t + .1 + Math.random() * 1.3, f = (i % 3 ? 240 : 420) * (1 + Math.random() * .25), d = .5 + Math.random() * .5;
    const o = ac.createOscillator(), vib = ac.createOscillator(), vg = ac.createGain(); o.type = "sawtooth";
    o.frequency.setValueAtTime(f, tw); o.frequency.exponentialRampToValueAtTime(f * 1.9, tw + d * .45); o.frequency.exponentialRampToValueAtTime(f * 1.3, tw + d);
    vib.frequency.value = 5.5; vg.gain.value = f * .03; vib.connect(vg).connect(o.frequency);
    const fa = ac.createBiquadFilter(), fb = ac.createBiquadFilter(), g = ac.createGain(), mix = ac.createGain(); // "oo" -> "ah"-ish formants
    fa.type = "bandpass"; fa.frequency.setValueAtTime(400, tw); fa.frequency.linearRampToValueAtTime(800, tw + d * .5); fa.Q.value = 4;
    fb.type = "bandpass"; fb.frequency.setValueAtTime(900, tw); fb.frequency.linearRampToValueAtTime(1250, tw + d * .5); fb.Q.value = 5;
    env(g, tw, [[.06, .09 * vel], [d * .7, .07 * vel], [d, 0]]); o.connect(fa).connect(mix); o.connect(fb).connect(mix); mix.connect(g);
    route(pan(g, Math.random() * 1.4 - .7), .9, .5); [o, vib].forEach((x) => { x.start(tw); x.stop(tw + d + .05); }); } }
/** the "open the present" moment: poppers + horns + cheering crowd + sleigh-bell shake + church-bell chord + glock sparkle */
function revealHit(t) {
  popper(t, -.3, 1); popper(t + .07, .35, .9); popper(t + .19, 0, .8); popper(t + .5, -.5, .6);
  horn(t + .05, 520, .85, -.45, 1); horn(t + .12, 660, .75, .45, .9); horn(t + .9, 440, .55, -.2, .8); horn(t + 1.05, 590, .7, .3, .85);
  crowd(t + .08, 3.4, 1);
  const s = ac.createBufferSource(); s.buffer = longShake; const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2600;
  const g = ac.createGain(); g.gain.value = .5 * MIX.sleigh / .22; s.connect(hp).connect(g); route(g, .9, .35); s.start(t + .1);
  tubular(M("C4"), t + .25, 1.1, 6); tubular(M("G4"), t + .27, .6, 5); tubular(M("C5"), t + .29, .5, 4.5);
  ["C6", "E6", "G6", "C7", "E7", "G7", "C8"].forEach((n, i) => glock(M(n), t + .3 + i * .055, .9 - i * .06));
}
const INTRO_LEN = 2.6; // music downbeat lands as the cheering fades

/** play one silent sample — the classic iOS WebAudio unlock (must be inside a user gesture) */
let silentEl;
/** iOS mutes WebAudio when the ring/silent switch is on. A looping silent HTML <audio> element (started inside the tap)
    plus navigator.audioSession = "playback" (iOS 17+) moves the page to the media channel so the music is heard. */
function mediaChannel() {
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
  try { if (!silentEl) { const n = 4410, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
      silentEl = new Audio(URL.createObjectURL(new Blob([b], { type: "audio/wav" }))); silentEl.loop = true; silentEl.setAttribute("playsinline", ""); silentEl.volume = 0.01; }
    const p = silentEl.play(); if (p) p.catch(() => {}); } catch {} }
function unlock() { mediaChannel(); try { const b = ac.createBuffer(1, 1, 22050), s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(0); } catch {} }
/** iOS can put the context into "interrupted" (calls, Siri, app switch) or "suspended": resume on the next tap / return to the page */
function watchState() {
  const kick = () => { if (on && ac && ac.state !== "running") { unlock(); ac.resume().catch(() => {}); } };
  ac.onstatechange = () => { if (on && ac.state !== "running") document.addEventListener("touchend", kick, { once: true }); };
  ["touchend", "click"].forEach((e) => document.addEventListener(e, kick, { passive: true }));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) kick(); });
}
function fade(to, sec) { const now = ac.currentTime; out.gain.cancelScheduledValues(now); out.gain.setValueAtTime(out.gain.value, now); out.gain.linearRampToValueAtTime(to, now + sec); }

export const music = {
  get on() { return on; },
  /** start (from a tap). withHit = play the reveal bell first */
  start(withHit = false) {
    // iOS Safari: everything here runs synchronously inside the tap handler — create, unlock, resume, no awaits.
    if (!ac) { setup(); watchState(); }
    unlock(); if (ac.state !== "running") ac.resume().catch(() => {});
    if (on) return true; on = true; fade(MIX.master, .15);
    const t = ac.currentTime + .06; if (withHit) revealHit(t);
    bar = 0; barT = t + (withHit ? INTRO_LEN : 0); clearInterval(timer); timer = setInterval(sched, 120); sched(); return true; },
  stop() { if (!ac || !on) return false; on = false; clearInterval(timer); fade(0, .35);
    setTimeout(() => { if (!on) { ac.suspend(); silentEl && silentEl.pause(); } }, 450); return false; },
  toggle() { return on ? this.stop() : this.start(); },
  /** test helper: render `sec` seconds offline (reveal hit + song); returns {peak, rms, wav: Float32Array[]} */
  async render(sec = 24) {
    const live = [ac, out, wet, comp, sleighBufs, longShake];
    setup(new OfflineAudioContext(2, 44100 * sec, 44100)); out.gain.value = MIX.master;
    revealHit(0); let k = 0, t = INTRO_LEN; while (t < sec) { playBar(k++, t); t += 4 * BEAT; }
    const buf = await ac.startRendering(); [ac, out, wet, comp, sleighBufs, longShake] = live;
    const L = buf.getChannelData(0), R = buf.getChannelData(1); let peak = 0, sum = 0;
    for (let i = 0; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); sum += L[i] * L[i]; }
    return { peak, rms: Math.sqrt(sum / L.length), L, R };
  },
};
