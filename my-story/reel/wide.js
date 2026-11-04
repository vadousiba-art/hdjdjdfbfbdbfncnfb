// A landscape talking-head reel (1920x1080), drawn from reel/<project>/edit.json
// (?p=<project>): graded selfie footage with punch-ins on every cut, big
// keywords BEHIND the person (cut out with photos/<project>/masks from
// reel/mask.py), app screens on a phone sliding in at the right, emoji
// bursts, a stamp, a 1-4 progress row, a share card and word-by-word
// captions. Every frame is a function of t.
//
// B-roll item types (plan.json "broll", anchored to a word):
//   big    {text, size?, strike?, sub?}  keyword behind the person, until the next big
//   phone  {img, focus?: [x, y], swap?, top?}  app screenshot on a phone (top: fraction cut off), until the beat ends
//   footage {clip, from}                 another clip full frame, until a "face" item
//   face                                 back to the speaker
//   burst  {emoji, n?}                   emojis flying up for 1.8 s
//   stamp  {text}                        a slammed stamp, until the beat ends
//   dots   {n}                           progress row with n of 4 filled, until the next dots or "dots_end"
//   share                                a "send to a friend" card

const W = 1920, H = 1080;
window.W = W;
window.H = H;
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const PROJ = new URLSearchParams(location.search).get("p") || "yoru1";
const E = await (await fetch(`/reel/${PROJ}/edit.json`)).json();
const EXPO = await (await fetch(`/reel/${PROJ}/exposure.json`)).json();
const BRAND = "#e11d48", HOT = "#ff4d6d";

const load = (src) => new Promise((ok, no) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => no(new Error(src));
  i.src = src;
});
const IMG = {};
for (const b of E.timeline) for (const it of b.broll) if (it.img && !IMG[it.img]) IMG[it.img] = await load(`/photos/${PROJ}/broll/${it.img}.png`);
const WORDMARK = await load("/film/wordmark.png");
await Promise.all(["700", "800", "900"].map((w) => document.fonts.load(`${w} 50px Inter`)));
await document.fonts.load("italic 800 50px Inter");
await document.fonts.load("900 50px YoruKanji", "夜");

const frameUrl = (clip, n) => `/photos/${PROJ}/frames/${clip}/${String(n).padStart(4, "0")}.jpg`;
const maskUrl = (clip, n) => `/photos/${PROJ}/masks/${clip}/${String(n).padStart(4, "0")}.png`;
const FRAMES = {}, HASMASK = {};
const clips = new Set([...E.timeline.map((b) => b.src), ...E.timeline.flatMap((b) => b.broll.filter((x) => x.type === "footage").map((x) => x.clip))]);
for (const clip of clips) {
  let n = 1, step = 256;
  while (step >= 1) {
    if ((await fetch(frameUrl(clip, n + step), { method: "HEAD" })).ok) n += step;
    else step >>= 1;
  }
  FRAMES[clip] = n;
  HASMASK[clip] = (await fetch(maskUrl(clip, 1), { method: "HEAD" })).ok;
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const back = (k) => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const mk = (w = W, h = H) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
// a seeded random, so every render of a frame is the same
const rnd = (seed) => { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); };

// all items with absolute times, and when each one ends
const ITEMS = [];
for (const b of E.timeline) for (const it of b.broll) ITEMS.push({ ...it, beat: b });
for (const it of ITEMS) {
  const later = ITEMS.filter((x) => x.at > it.at || (x.at === it.at && ITEMS.indexOf(x) > ITEMS.indexOf(it)));
  const sameBeat = (x) => x.beat === it.beat;
  if (it.type === "big") it.end = Math.min(it.beat.end, ...later.filter((x) => ["big", "footage", "face", "phone"].includes(x.type) && sameBeat(x)).map((x) => x.at));
  else if (it.type === "phone") it.end = Math.min(it.beat.end, ...later.filter((x) => (x.type === "phone" && !x.swap) || x.type === "footage").filter(sameBeat).map((x) => x.at));
  else if (it.type === "footage") it.end = Math.min(it.beat.end, ...later.filter((x) => x.type === "face" && sameBeat(x)).map((x) => x.at));
  else if (it.type === "burst") it.end = it.at + 1.9;
  else if (it.type === "stamp" || it.type === "share") it.end = it.beat.end;
  else if (it.type === "dots") {
    const nxt = later.find((x) => x.type === "dots");
    it.end = nxt ? nxt.at : it.beat.end;
  } else it.end = it.beat.end;
}
const active = (type, t) => ITEMS.filter((x) => x.type === type && t >= x.at && t < x.end);

// ------------------------------------------------------------------ footage
const PIC = mk(), PG = PIC.getContext("2d");
const CUT = mk(), CG = CUT.getContext("2d");
function beatAt(t) {
  let b = E.timeline[0];
  for (const x of E.timeline) if (t >= x.start) b = x;
  return b;
}
async function picture(b, t) {
  // returns {clip, n, z} for the speaker or the active footage
  const fo = active("footage", t)[0];
  if (fo) {
    const n = clamp(Math.round((fo.from + (t - fo.at)) * 30) + 1, 1, FRAMES[fo.clip]);
    return { clip: fo.clip, n, z: 1.04 + 0.04 * clamp((t - fo.at) / 3), fx: 0.5, fy: 0.5, mask: false };
  }
  let p = b.pieces[0];
  for (const q of b.pieces) if (t >= q.at) p = q;
  const n = clamp(Math.round((p.in + (t - p.at)) * 30) + 1, 1, FRAMES[b.src]);
  const k = clamp((t - p.at) / Math.max(0.5, p.out - p.in));
  // every other piece and every phone screen punches in a little
  const phoneIn = active("phone", t).length ? 0.04 : 0;
  return { clip: b.src, n, z: (p.punch ? 1.1 : 1.02) + 0.03 * k + phoneIn, fx: 0.42, fy: 0.42, mask: HASMASK[b.src] };
}
function cover(g, img, z, fx, fy, w = W, h = H) {
  const s = Math.max(w / img.width, h / img.height) * z;
  const dw = img.width * s, dh = img.height * s;
  g.drawImage(img, (w - dw) * fx, (h - dh) * fy, dw, dh);
}

// ------------------------------------------------------------------ big keywords (behind)
function bigText(g, it, t) {
  // the keyword sits in the open part of the room, right of the face, and tucks in behind the head
  const k = clamp((t - it.at) / 0.22), out = clamp((it.end - t) / 0.12);
  const pop = lerp(1.35, 1, easeOut(k));
  const kanji = /[\u4e00-\u9fff]/.test(it.text);
  const family = kanji ? "YoruKanji" : "Inter, 'Noto Color Emoji'";
  const maxW = it.maxW || 700;
  let size = it.size || 330;
  g.font = `900 ${size}px ${family}`;
  // one line if it fits, otherwise the two most even lines
  let lines = [it.text];
  const words = it.text.split(" ");
  if (g.measureText(it.text).width > maxW && words.length > 1) {
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" "), bb = words.slice(i).join(" ");
      const w = Math.max(g.measureText(a).width, g.measureText(bb).width);
      if (!best || w < best.w) best = { w, l: [a, bb] };
    }
    lines = best.l;
  }
  const widest = Math.max(...lines.map((l) => g.measureText(l).width));
  if (widest > maxW) { size *= maxW / widest; g.font = `900 ${size}px ${family}`; }
  const lh = size * 0.92;
  const cx = it.x ?? 1530, cy = (it.y ?? (kanji ? 500 : 420)) - ((lines.length - 1) * lh) / 2;
  g.save();
  g.globalAlpha = Math.min(k * 2, 1) * out;
  g.translate(cx, cy);
  g.scale(pop, pop);
  g.textAlign = "center";
  g.textBaseline = "middle";
  const emoji = /\p{Extended_Pictographic}/u.test(it.text);
  if ((E.style || {}).big === "soft" && !emoji) {
    // night: pale moonlight, a soft glow, and the word sharpens out of a blur
    const kb = easeOut(clamp((t - it.at) / 0.45));
    g.filter = `blur(${(1 - kb) * 16}px)`;
    const gs = g.createLinearGradient(0, -size / 2, 0, size / 2 + (lines.length - 1) * lh);
    gs.addColorStop(0, "#ffffff");
    gs.addColorStop(1, "#b8c6ff");
    g.lineJoin = "round";
    g.lineWidth = Math.max(6, size * 0.03);
    g.strokeStyle = "rgba(4,8,24,0.55)";
    lines.forEach((l, i) => g.strokeText(l, 0, i * lh));
    g.shadowColor = "rgba(150,170,255,0.5)";
    g.shadowBlur = 45;
    g.fillStyle = gs;
    lines.forEach((l, i) => g.fillText(l, 0, i * lh));
    g.filter = "none";
    g.restore();
    return;
  }
  if (!emoji) {
    // a short extrusion for depth
    for (let d = 12; d > 0; d -= 2) {
      g.fillStyle = `rgba(90,6,24,${0.85 - d * 0.04})`;
      lines.forEach((l, i) => g.fillText(l, d * 0.9, i * lh + d * 1.1));
    }
  }
  const grad = g.createLinearGradient(0, -size / 2, 0, size / 2 + (lines.length - 1) * lh);
  if (kanji || /^\d$/.test(it.text)) {
    grad.addColorStop(0, "#ff6b86");
    grad.addColorStop(1, BRAND);
  } else {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#ffd6de");
  }
  if (!emoji && !kanji) {
    g.lineJoin = "round";
    g.lineWidth = Math.max(8, size * 0.045);
    g.strokeStyle = "rgba(38,4,14,0.92)";
    lines.forEach((l, i) => g.strokeText(l, 0, i * lh));
  }
  g.shadowColor = kanji ? "rgba(225,29,72,0.8)" : "rgba(0,0,0,0.35)";
  g.shadowBlur = kanji ? 60 : 20;
  g.fillStyle = grad;
  lines.forEach((l, i) => g.fillText(l, 0, i * lh));
  g.shadowBlur = 0;
  if (it.strike) {
    const ks = easeOut(clamp((t - it.at - 0.35) / 0.25));
    const tw = g.measureText(it.text).width;
    g.strokeStyle = BRAND;
    g.lineWidth = size * 0.12;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-tw / 2 - 20, size * 0.05);
    g.lineTo(-tw / 2 - 20 + (tw + 40) * ks, size * 0.05 - 30 * ks);
    g.stroke();
  }
  if (it.sub) {
    g.font = "900 70px Inter";
    g.fillStyle = "#fff";
    g.shadowColor = "rgba(0,0,0,0.5)";
    g.shadowBlur = 18;
    g.lineWidth = 12;
    g.strokeStyle = "rgba(38,4,14,0.9)";
    g.strokeText(it.sub, 0, size * 0.6);
    g.fillText(it.sub, 0, size * 0.6);
  }
  g.restore();
}

// ------------------------------------------------------------------ phone with an app screen (front)
const PH = { h: 900, w: Math.round(900 / 2.1667) };
function phone(g, items, t) {
  const first = items[0], cur = items[items.length - 1];
  const k = easeOut(clamp((t - first.at) / 0.38)), out = easeInOut(clamp((t - (first.end - 0.25)) / 0.25));
  const cx = lerp(W + PH.w, 1555, k) + 500 * out, cy = 545 + 8 * Math.sin(t * 1.3);
  const rot = lerp(0.12, -0.035, k);
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.shadowColor = "rgba(0,0,0,0.55)";
  g.shadowBlur = 60;
  g.shadowOffsetY = 24;
  g.fillStyle = "#0b0b0f";
  g.beginPath();
  g.roundRect(-PH.w / 2, -PH.h / 2, PH.w, PH.h, 58);
  g.fill();
  g.shadowColor = "transparent";
  const sw = PH.w - 22, sh = PH.h - 22;
  g.save();
  g.beginPath();
  g.roundRect(-sw / 2, -sh / 2, sw, sh, 48);
  g.clip();
  const draw = (it, a) => {
    const img = IMG[it.img];
    const kz = easeInOut(clamp((t - it.at - 0.4) / 2.2));
    const [fx, fy] = it.focus || [0.5, 0.4];
    const top = (it.top || 0) * img.height;  // skip a strip at the top of the screenshot
    // fill the screen (after the strip is cut), then zoom slowly toward the focus point
    const s = Math.max(sw / img.width, sh / (img.height - top)) * (1 + 0.32 * kz);
    const dw = img.width * s, dh = img.height * s;
    const x = -sw / 2 - (dw - sw) * fx;
    const y0 = -sh / 2 - top * s, yMin = -sh / 2 - (dh - sh);
    const y = Math.max(yMin, y0 - (dh - top * s - sh) * fy * kz);
    g.globalAlpha = a;
    g.drawImage(img, x, y, dw, dh);
    g.globalAlpha = 1;
  };
  if (items.length > 1 && cur.swap) {
    const prev = items[items.length - 2];
    draw({ ...cur, at: prev.at }, 1);
    const ks = clamp((t - cur.at) / 0.12);
    if (ks < 1) draw(prev, 1 - ks);
    // the switch flips: a ring around it
    const kr = clamp((t - cur.at) / 0.6);
    if (kr < 1) {
      g.strokeStyle = `rgba(255,77,109,${1 - kr})`;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(sw * 0.36, -sh * 0.17, 30 + 60 * kr, 0, Math.PI * 2);
      g.stroke();
    }
  } else draw(cur, 1);
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.14)";
  g.lineWidth = 3;
  g.beginPath();
  g.roundRect(-PH.w / 2 + 1.5, -PH.h / 2 + 1.5, PH.w - 3, PH.h - 3, 57);
  g.stroke();
  g.restore();
}

// ------------------------------------------------------------------ bursts, stamp, dots, share
function burst(g, it, t, idx) {
  const n = it.n || 12, k = (t - it.at) / 1.9;
  const phoneOn = active("phone", it.at + 0.01).length;
  for (let i = 0; i < n; i++) {
    const r1 = rnd(idx * 97 + i), r2 = rnd(idx * 131 + i * 7), r3 = rnd(idx * 53 + i * 3);
    const delay = r3 * 0.35, kk = clamp((k * 1.9 - delay) / 1.4);
    if (kk <= 0 || kk >= 1) continue;
    const x0 = phoneOn ? 1555 + (r1 - 0.5) * 380 : 260 + r1 * 1400;
    const x = x0 + Math.sin(kk * 6 + r2 * 6) * 40;
    const y = 1120 - easeOut(kk) * (620 + r2 * 360);
    const s = (70 + r2 * 70) * (kk < 0.15 ? back(kk / 0.15) : 1);
    g.save();
    g.globalAlpha = kk > 0.75 ? (1 - kk) / 0.25 : 1;
    g.translate(x, y);
    g.rotate((r1 - 0.5) * 0.8 * kk);
    g.font = `${s}px 'Noto Color Emoji'`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(it.emoji, 0, 0);
    g.restore();
  }
}
function stamp(g, it, t) {
  const k = clamp((t - it.at) / 0.16);
  const s = lerp(2.2, 1, easeOut(k)), shake = k >= 1 ? Math.max(0, 1 - (t - it.at - 0.16) / 0.25) * 10 * Math.sin(t * 90) : 0;
  g.save();
  g.globalAlpha = Math.min(1, k * 3) * clamp((it.end - t) / 0.12);
  g.translate(W / 2 + shake, 700);
  g.rotate(-0.06);
  g.scale(s, s);
  g.font = "900 78px Inter";
  const tw = g.measureText(it.text).width + 70;
  g.fillStyle = "rgba(225,29,72,0.92)";
  g.strokeStyle = "#fff";
  g.lineWidth = 8;
  g.beginPath();
  g.roundRect(-tw / 2, -62, tw, 124, 16);
  g.fill();
  g.stroke();
  g.fillStyle = "#fff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(it.text, 0, 4);
  g.restore();
}
function dots(g, t) {
  const all = ITEMS.filter((x) => x.type === "dots");
  if (!all.length || t < all[0].at || t >= all[all.length - 1].end) return;
  const cur = all.filter((x) => x.at <= t).pop();
  const a = clamp((t - all[0].at) / 0.2) * clamp((all[all.length - 1].end - t) / 0.2);
  g.save();
  g.globalAlpha = a;
  const pw = 120, gap = 18, x0 = W / 2 - (4 * pw + 3 * gap) / 2, y = 64;
  for (let i = 0; i < 4; i++) {
    const on = i < cur.n, fresh = i === cur.n - 1 ? easeOut(clamp((t - cur.at) / 0.25)) : 1;
    g.fillStyle = on ? BRAND : "rgba(0,0,0,0.45)";
    g.strokeStyle = on ? "#fff" : "rgba(255,255,255,0.55)";
    g.lineWidth = 3;
    g.save();
    g.translate(x0 + i * (pw + gap) + pw / 2, y + 28);
    const sc = on ? lerp(1.3, 1, fresh) : 1;
    g.scale(sc, sc);
    g.beginPath();
    g.roundRect(-pw / 2, -28, pw, 56, 28);
    g.fill();
    g.stroke();
    g.fillStyle = "#fff";
    g.font = "900 32px Inter";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(i + 1), 0, 2);
    g.restore();
  }
  g.restore();
}
function share(g, it, t) {
  const k = easeOut(clamp((t - it.at - 0.1) / 0.4));
  const x = lerp(W + 40, W - 560, k), y = 640;
  g.save();
  g.globalAlpha = clamp((it.end - t) / 0.15);
  g.shadowColor = "rgba(0,0,0,0.45)";
  g.shadowBlur = 40;
  g.fillStyle = "rgba(18,18,24,0.94)";
  g.beginPath();
  g.roundRect(x, y, 500, 210, 30);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "#fff";
  g.font = "800 34px Inter";
  g.textBaseline = "middle";
  g.fillText("Send to", x + 34, y + 50);
  // the friend
  g.fillStyle = "#2b2b36";
  g.beginPath();
  g.arc(x + 74, y + 138, 40, 0, Math.PI * 2);
  g.fill();
  g.font = "52px 'Noto Color Emoji'";
  g.textAlign = "center";
  g.fillText("🤡", x + 74, y + 141);
  g.textAlign = "left";
  g.fillStyle = "#fff";
  g.font = "700 32px Inter";
  g.fillText("your friend", x + 132, y + 124);
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.font = "600 25px Inter";
  g.fillText("clowns every post", x + 132, y + 160);
  // the send button gets tapped
  const tap = clamp((t - it.at - 1.4) / 0.2), sent = t - it.at > 1.6;
  g.fillStyle = sent ? "#3a3a46" : BRAND;
  g.beginPath();
  g.roundRect(x + 360, y + 112, 112, 54, 27);
  g.fill();
  g.fillStyle = "#fff";
  g.font = "800 26px Inter";
  g.textAlign = "center";
  g.save();
  g.translate(x + 416, y + 139);
  g.scale(1 - 0.12 * Math.sin(tap * Math.PI), 1 - 0.12 * Math.sin(tap * Math.PI));
  g.fillText(sent ? "Sent ✓" : "Send", 0, 2);
  g.restore();
  g.restore();
}

// ------------------------------------------------------------------ captions (front)
function tokens(text) {
  const out = [];
  let it = false;
  for (const raw of text.split(" ")) {
    const open = raw.startsWith("*"), close = raw.replace(/[.,!?:]+$/, "").endsWith("*");
    if (open) it = true;
    out.push({ w: raw.replace(/\*/g, ""), it });
    if (close) it = false;
  }
  return out;
}
const STYLE = E.style || {};
const CAP = STYLE.captions || "stroke";
// when each caption token is spoken: the word times from edl.py, spread over the tokens when the counts differ
function tokenTimes(c, n) {
  const ws = c.words || [c.s];
  if (ws.length === n) return ws;
  return Array.from({ length: n }, (_, i) => ws[0] + ((c.e - ws[0]) * i) / n);
}
function captionBox(g, text, a, pop) {
  // the series look: black words on white boxes, accent in italic
  const toks = tokens(text);
  const size = 64, y = 905, pad = 18;
  const font = (it) => `${it ? "italic 800" : "700"} ${size}px Inter`;
  g.font = font(false);
  const space = g.measureText(" ").width;
  const ws = toks.map((tk) => { g.font = font(tk.it); return { ...tk, width: g.measureText(tk.w).width }; });
  const total = ws.reduce((s, w) => s + w.width, 0) + space * (ws.length - 1);
  g.save();
  g.globalAlpha = a;
  g.translate(W / 2, y);
  g.scale(pop, pop);
  g.fillStyle = "#fff";
  g.beginPath();
  g.roundRect(-total / 2 - pad, -size * 0.68, total + pad * 2, size * 1.36, 10);
  g.fill();
  let x = -total / 2;
  g.textBaseline = "middle";
  for (const w of ws) {
    g.font = font(w.it);
    g.fillStyle = w.it ? BRAND : "#111";
    g.fillText(w.w, x, 2);
    x += w.width + space;
  }
  g.restore();
}
function captionKaraoke(g, c, t, a) {
  // the whole phrase, each word lighting up as it's said
  const toks = tokens(c.text.toUpperCase());
  const times = tokenTimes(c, toks.length);
  const size = 76, y = 905;
  g.font = `900 ${size}px Inter`;
  const space = g.measureText(" ").width * 1.7;
  const ws = toks.map((tk) => ({ ...tk, width: g.measureText(tk.w).width }));
  const total = ws.reduce((s, w) => s + w.width, 0) + space * (ws.length - 1);
  g.save();
  g.globalAlpha = a;
  g.translate(W / 2, y);
  let x = -total / 2;
  g.textBaseline = "middle";
  g.lineJoin = "round";
  ws.forEach((w, i) => {
    const said = t >= times[i] - 0.02, now = said && (i === ws.length - 1 || t < times[i + 1]);
    const k = clamp((t - times[i]) / 0.12);
    g.save();
    g.translate(x + w.width / 2, 0);
    const sc = now ? 1 + 0.1 * (1 - easeOut(k)) + 0.03 : 1;
    g.scale(sc, sc);
    g.font = `900 ${size}px Inter`;
    g.lineWidth = 14;
    g.strokeStyle = "rgba(0,0,0,0.9)";
    g.strokeText(w.w, -w.width / 2, 0);
    g.fillStyle = now ? "#ffd60a" : said ? "#fff" : "rgba(255,255,255,0.55)";
    g.fillText(w.w, -w.width / 2, 0);
    g.restore();
    x += w.width + space;
  });
  g.restore();
}
function captionWord(g, c, t, a) {
  // one big word at a time, in the middle-low of the frame
  const toks = tokens(c.text.toUpperCase());
  const times = tokenTimes(c, toks.length);
  let i = 0;
  for (let j = 0; j < toks.length; j++) if (t >= times[j] - 0.02) i = j;
  const w = toks[i], k = clamp((t - times[i]) / 0.13);
  const size = w.it ? 132 : 112;
  g.save();
  g.globalAlpha = a;
  g.translate(W / 2, 880);
  const sc = 0.7 + 0.3 * back(k);
  g.scale(sc, sc);
  g.rotate(w.it ? -0.04 : 0);
  g.font = `900 ${size}px Inter, 'Noto Color Emoji'`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = 18;
  g.strokeStyle = "rgba(0,0,0,0.92)";
  g.strokeText(w.w, 0, 0);
  g.fillStyle = w.it ? "#ffd60a" : "#fff";
  g.fillText(w.w, 0, 0);
  g.restore();
}
// typewriter captions (night): small monospace, left-aligned, typing as the words are said
function captionType(g, c, t, a) {
  const big = c.text.startsWith("^");
  const toks = tokens(big ? c.text.slice(1).toUpperCase() : c.text);
  const times = tokenTimes(c, toks.length);
  const size = big ? 78 : 48, font = `${big ? 700 : 400} ${size}px 'DejaVu Sans Mono', monospace`;
  g.save();
  g.globalAlpha = a;
  g.font = font;
  g.textBaseline = "middle";
  const space = g.measureText(" ").width;
  const total = toks.reduce((s, tk) => s + g.measureText(tk.w).width, 0) + space * (toks.length - 1);
  let x = big ? W / 2 - total / 2 : 150;
  const y = big ? 860 : 900;
  let lastX = x, typing = false;
  toks.forEach((tk, i) => {
    const t0 = times[i], t1 = Math.min(times[i + 1] ?? c.e, t0 + tk.w.length * 0.055);
    const n = Math.floor(clamp((t - t0) / Math.max(0.05, t1 - t0)) * tk.w.length + (t >= t0 ? 0.999 : 0));
    const shown = tk.w.slice(0, Math.min(tk.w.length, n));
    if (shown) {
      g.shadowColor = "rgba(0,0,0,0.8)";
      g.shadowBlur = 12;
      g.fillStyle = tk.it ? "#ff8fa3" : "#f2f4ff";
      g.fillText(shown, x, y);
      lastX = x + g.measureText(shown).width;
      if (n < tk.w.length) typing = true;
    }
    x += g.measureText(tk.w).width + space;
  });
  // a block cursor, blinking when it rests
  if (typing || Math.floor(t * 2.2) % 2 === 0) {
    g.shadowBlur = 0;
    g.fillStyle = "rgba(242,244,255,0.85)";
    g.fillRect(lastX + 6, y - size * 0.45, size * 0.5, size * 0.9);
  }
  g.restore();
}
const NIGHT = (E.style || {}).night;
const GRAIN = NIGHT ? Array.from({ length: 6 }, (_, i) => {
  const c = mk(480, 270), g = c.getContext("2d"), d = g.createImageData(480, 270);
  for (let p = 0; p < d.data.length; p += 4) {
    const v = 128 + (rnd(i * 1e5 + p) - 0.5) * 255;
    d.data[p] = d.data[p + 1] = d.data[p + 2] = v;
    d.data[p + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}) : [];
function kanjiMark(g, x, y, size, a) {
  g.save();
  g.globalAlpha = a;
  g.font = `900 ${size}px YoruKanji`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(225,29,72,0.7)";
  g.shadowBlur = size * 0.4;
  g.fillStyle = BRAND;
  g.fillText("夜", x, y);
  g.restore();
}
function endCard(g, t) {
  const k = t - E.speech_end;
  const a = easeOut(clamp((k - 0.5) / 0.6));
  if (a <= 0) return;
  kanjiMark(g, W / 2, H * 0.42, 260, a);
  g.save();
  g.globalAlpha = a * 0.9;
  const ww = 260, wh = (ww * WORDMARK.height) / WORDMARK.width;
  g.drawImage(WORDMARK, W / 2 - ww / 2, H * 0.62, ww, wh);
  g.font = "400 30px 'DejaVu Sans Mono', monospace";
  g.textAlign = "center";
  g.fillStyle = "rgba(242,244,255,0.6)";
  g.fillText("3am thoughts", W / 2, H * 0.62 + wh + 50);
  g.restore();
}
function caption(g, text, a, pop) {
  const toks = tokens(text.toUpperCase());
  const size = 78, y = 905;
  const font = (it) => `${it ? "italic 900" : "800"} ${size}px Inter`;
  g.font = font(false);
  const space = g.measureText(" ").width;
  let total = 0;
  const ws = toks.map((tk) => {
    g.font = font(tk.it);
    const w = g.measureText(tk.w).width;
    return { ...tk, width: w };
  });
  total = ws.reduce((s, w) => s + w.width, 0) + space * (ws.length - 1);
  g.save();
  g.globalAlpha = a;
  g.translate(W / 2, y);
  g.scale(pop, pop);
  let x = -total / 2;
  g.textBaseline = "middle";
  g.lineJoin = "round";
  for (const w of ws) {
    g.font = font(w.it);
    g.lineWidth = 14;
    g.strokeStyle = "rgba(0,0,0,0.85)";
    g.strokeText(w.w, x, 0);
    g.fillStyle = w.it ? HOT : "#fff";
    g.fillText(w.w, x, 0);
    x += w.width + space;
  }
  g.restore();
}

const VIGNETTE = (() => {
  const c = mk(), g = c.getContext("2d");
  const v = g.createRadialGradient(W * 0.45, H * 0.45, H * 0.35, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  const lo = g.createLinearGradient(0, H * 0.7, 0, H);
  lo.addColorStop(0, "rgba(0,0,0,0)");
  lo.addColorStop(1, "rgba(0,0,0,0.35)");
  g.fillStyle = lo;
  g.fillRect(0, 0, W, H);
  return c;
})();

// ------------------------------------------------------------------ the frame
window.renderFrame = async (t) => {
  const tt = Math.min(t, E.speech_end - 0.001);
  const b = beatAt(tt);
  if (b.kind === "insert" && NIGHT) {
    // a breath: black, a small 夜, the room's silence
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    kanjiMark(ctx, W - 120, H - 110, 54, 0.55 * clamp((t - b.start) / 0.3) * clamp((b.end - t) / 0.3));
    return;
  }
  const pic = await picture(b, tt);
  const img = await load(frameUrl(pic.clip, pic.n));
  const gain = pic.mask || pic.clip === b.src ? EXPO[pic.clip]?.[pic.n - 1] ?? 1 : 1;

  PG.setTransform(1, 0, 0, 1, 0, 0);
  PG.filter = `brightness(${gain})`;
  cover(PG, img, pic.z, pic.fx, pic.fy);
  PG.filter = "none";

  // keywords go between the room and the person
  const bigs = active("big", tt);
  if (bigs.length) {
    for (const it of bigs) bigText(PG, it, tt);
    if (pic.mask) {
      const m = await load(maskUrl(pic.clip, pic.n));
      CG.globalCompositeOperation = "source-over";
      CG.clearRect(0, 0, W, H);
      CG.filter = `brightness(${gain})`;
      cover(CG, img, pic.z, pic.fx, pic.fy);
      CG.filter = "none";
      CG.globalCompositeOperation = "destination-in";
      cover(CG, m, pic.z, pic.fx, pic.fy);
      CG.globalCompositeOperation = "source-over";
      PG.drawImage(CUT, 0, 0);
    }
  }

  // a small punch on every change of picture or keyword
  const changes = [b.start, ...ITEMS.filter((x) => x.beat === b && ["big", "phone", "footage", "face"].includes(x.type)).map((x) => x.at)].filter((x) => x <= tt);
  const since = tt - Math.max(...changes);
  const z = NIGHT ? 1 + 0.035 * clamp((tt - b.start) / Math.max(1, b.end - b.start)) : 1 + 0.03 * (1 - easeOut(clamp(since / 0.22)));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(PIC, 0, 0);
  ctx.restore();
  ctx.drawImage(VIGNETTE, 0, 0);

  const phones = ITEMS.filter((x) => x.type === "phone" && x.beat === b && tt >= x.at && tt < x.end + 0.0);
  if (phones.length) phone(ctx, phones, tt);
  for (const it of active("stamp", tt)) stamp(ctx, it, tt);
  for (const it of active("share", tt)) share(ctx, it, tt);
  ITEMS.forEach((it, i) => { if (it.type === "burst" && tt >= it.at && tt < it.end) burst(ctx, it, tt, i); });
  dots(ctx, tt);

  if (NIGHT) {
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = "overlay";
    ctx.drawImage(GRAIN[Math.floor(t * 24) % GRAIN.length], 0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    kanjiMark(ctx, W - 120, H - 110, 54, 0.55);
  } else {
    // the brand, small, top left
    ctx.globalAlpha = 0.85;
    const ww = 150, wh = (ww * WORDMARK.height) / WORDMARK.width;
    ctx.drawImage(WORDMARK, 56, 50, ww, wh);
    ctx.globalAlpha = 1;
  }

  E.captions.forEach((c, i) => {
    const next = E.captions[i + 1];
    const end = next && next.s - c.e < 0.15 ? next.s - 0.02 : c.e + 0.08;
    if (t < c.s - 0.02 || t > end) return;
    const a = clamp((t - c.s + 0.02) / 0.06) * (end === c.e + 0.08 ? clamp((end - t) / 0.08) : 1);
    const pop = 0.86 + 0.14 * back(clamp((t - c.s) / 0.16));
    if (CAP === "type") captionType(ctx, c, t, clamp((end - t) / 0.12));
    else if (CAP === "box") captionBox(ctx, c.text, a, pop);
    else if (CAP === "karaoke") captionKaraoke(ctx, c, t, a);
    else if (CAP === "word") captionWord(ctx, c, t, a);
    else caption(ctx, c.text, a, pop);
  });
  if (NIGHT) {
    // fade in from black (the loop), and out to the end card
    if (t < 0.35) {
      ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (t > E.speech_end) {
      ctx.fillStyle = `rgba(0,0,0,${easeOut(clamp((t - E.speech_end) / 0.6))})`;
      ctx.fillRect(0, 0, W, H);
      endCard(ctx, t);
    }
  }
};
window.duration = E.duration;
window.ready = true;
