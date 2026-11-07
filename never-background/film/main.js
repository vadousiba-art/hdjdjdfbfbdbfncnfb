// YORU — "You were never a background character."  (v2, 34.5 s)
// Every frame is a pure function of t, drawn with Canvas 2D. The world is
// black-and-white manga with crimson until the protagonist looks up; then
// colour blooms out from them and stays. Timeline: cues.json (shared with
// the score in audio/synth.py). Stock footage frames: assets/stock/frames
// (see fetch-assets.sh and prep-media.sh).

import { INK, PAPER, CRIMSON, rng, clamp, lerp, ramp, easeOut, easeIn, easeInOut, expoOut, radialLines, motionLines, brushStroke, fracture, polyPath, centroid } from "./manga.js";
import { head, profile, standing, phoneHead, silhouette, torso, tone, hatch, taper, fill, stroke, ink, PAL } from "./art.js";
import { sheet } from "./sheet.js";

const c = document.getElementById("c");
let g = c.getContext("2d");
const W = 1080, H = 1920;
const C = await (await fetch("/film/cues.json", { cache: "no-store" })).json();
const FONT = "Inter, system-ui, sans-serif";
const WARM = "#fff4e6";

function img(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("missing " + src));
    i.src = src;
  });
}
const IMG = {
  wordmark: await img("/assets/brand/wordmark.png"),
  profile: await img("/assets/screens/profile-rei.png"),
  post0: await img("/assets/screens/post-0.png"),
  post1: await img("/assets/screens/post-1.png"),
  post2: await img("/assets/screens/post-2.png"),
};
await document.fonts.load(`800 40px Inter`);
await document.fonts.load(`600 40px Inter`);

const within = (t, [a, b]) => t >= a && t < b;
const at = (x, y, s, fn) => { g.save(); g.translate(x, y); g.scale(s, s); fn(); g.restore(); };
const full = `M0 0 H${W} V${H} H0 Z`;
function hash(n) {
  const x = Math.sin(n * 91.7 + 13.1) * 43758.5453;
  return x - Math.floor(x);
}
function offscreen() {
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  return cv;
}
// Draw `fn` into an offscreen canvas (by pointing `g` at it) and return it.
function render(cv, fn) {
  const main = g;
  g = cv.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.filter = "none";
  g.clearRect(0, 0, W, H);
  try {
    fn();
  } finally {
    g = main;
  }
  return cv;
}
const BUF = [offscreen(), offscreen()];

// ------------------------------------------------------------------ stock footage frames
const MEDIA = {
  bokeh: { dir: "/assets/stock/frames/bokeh", n: 483, ext: "jpg" },
  rain: { dir: "/assets/stock/frames/rain", n: 200, ext: "jpg" },
  ink: { dir: "/assets/stock/frames/ink487", n: 180, ext: "png" },
};
const cache = new Map();
const now = {};
function mediaPlan(t) {
  const f = Math.round(t * C.fps);
  const p = {};
  if (t < C.hook[1] || t >= C.toPhone[0] - 0.1) p.bokeh = (f + 90) % MEDIA.bokeh.n;
  if (t >= C.alone[0] - 0.4 && t < C.close[1]) p.rain = clamp(Math.floor((t - C.alone[0] + 0.4) * C.fps), 0, MEDIA.rain.n - 1);
  const inkIdx = (span) => 14 + Math.round(clamp((t - span[0]) / (span[1] - span[0])) * 52);
  if (within(t, C.ink1)) p.ink = inkIdx(C.ink1);
  if (within(t, C.ink2)) p.ink = inkIdx(C.ink2);
  return p;
}
async function prepare(t) {
  const p = mediaPlan(t);
  for (const k of Object.keys(now)) delete now[k];
  await Promise.all(Object.entries(p).map(async ([name, i]) => {
    const m = MEDIA[name];
    const key = `${name}/${i}`;
    if (!cache.has(key)) {
      cache.set(key, await img(`${m.dir}/${String(i + 1).padStart(4, "0")}.${m.ext}`));
      if (cache.size > 48) cache.delete(cache.keys().next().value);
    }
    now[name] = cache.get(key);
  }));
}
// Draw a footage frame to cover a rect (object-fit: cover).
function footage(name, x, y, w, h, { filter = "none", alpha = 1, zoom = 1 } = {}) {
  const im = now[name];
  if (!im) return;
  const s = Math.max(w / im.width, h / im.height) * zoom;
  const dw = im.width * s, dh = im.height * s;
  g.save();
  g.globalAlpha *= alpha;
  g.filter = filter;
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  g.restore();
}
// Ink flooding the frame: the clip's spreading band, stretched to cover.
function inkFlood(k) {
  const im = now.ink;
  if (!im || k <= 0) return;
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(1.25 + k * 0.4, 3.0 + k * 1.2);
  g.drawImage(im, -W / 2, -H / 2, W, H);
  g.restore();
  if (k > 0.75) { g.fillStyle = `rgba(0,0,0,${(k - 0.75) * 4})`; g.fillRect(0, 0, W, H); }
}

// ------------------------------------------------------------------ light, dust, grain
const grain = document.createElement("canvas");
grain.width = grain.height = 512;
{
  const q = grain.getContext("2d");
  const d = q.createImageData(512, 512);
  const r = rng(99);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 120;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  q.putImageData(d, 0, 0);
}
function finish(t, { vignette = 0.45, grainA = 0.07 } = {}) {
  g.save();
  g.globalAlpha = grainA;
  g.globalCompositeOperation = "overlay";
  const ox = Math.floor(hash(t * 30) * 512), oy = Math.floor(hash(t * 30 + 7) * 512);
  for (let y = -oy; y < H; y += 512) for (let x = -ox; x < W; x += 512) g.drawImage(grain, x, y);
  g.restore();
  if (vignette) {
    const v = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(0,0,0,${vignette})`);
    g.fillStyle = v;
    g.fillRect(0, 0, W, H);
  }
}
// Soft drifting light leaks (screen blend).
function leaks(t, a) {
  if (a <= 0) return;
  g.save();
  g.globalCompositeOperation = "screen";
  const cols = [[255, 150, 70], [255, 90, 120], [255, 210, 120]];
  for (let i = 0; i < 3; i++) {
    const x = W * (0.2 + 0.6 * hash(i * 3.1)) + Math.sin(t * 0.5 + i * 2) * 240;
    const y = H * (0.15 + 0.7 * hash(i * 7.7)) + Math.cos(t * 0.4 + i) * 260;
    const r = 520 + 260 * Math.sin(t * 0.7 + i * 1.7);
    const [cr, cg, cb] = cols[i];
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${cr},${cg},${cb},${0.55 * a})`);
    gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
  }
  g.restore();
}
const DUST = Array.from({ length: 70 }, (_, i) => ({ x: hash(i * 1.3) * W, y: hash(i * 2.9) * H, s: 1.5 + hash(i * 5.1) * 4, v: 8 + hash(i * 7.3) * 26, ph: hash(i) * 6 }));
function dust(t, a, color = "255,255,255") {
  if (a <= 0) return;
  g.save();
  g.globalCompositeOperation = "screen";
  for (const d of DUST) {
    const y = (d.y - t * d.v + H * 4) % H;
    const x = d.x + Math.sin(t * 0.6 + d.ph) * 30;
    const tw = 0.4 + 0.6 * Math.sin(t * 2 + d.ph * 3) ** 2;
    const gr = g.createRadialGradient(x, y, 0, x, y, d.s * 3);
    gr.addColorStop(0, `rgba(${color},${0.7 * a * tw})`);
    gr.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = gr;
    g.fillRect(x - d.s * 3, y - d.s * 3, d.s * 6, d.s * 6);
  }
  g.restore();
}
// A gentle handheld drift for close shots.
function sway(t, amp = 4) {
  g.translate(Math.sin(t * 1.3) * amp + Math.sin(t * 2.9) * amp * 0.4, Math.cos(t * 1.1) * amp * 0.8);
}

// ------------------------------------------------------------------ captions
// lines: [{ text, at }]; each line blurs in and rises on its own beat.
function caption(t, lines, out, { y = 1300, size = 72, gap = 1.22, plate = 0.6, color = "#fff", weight = 800 } = {}) {
  const first = lines[0].at;
  if (t < first || t > out) return;
  const fadeOut = 1 - ramp(t, out - 0.28, out);
  const lh = size * gap;
  const top = y - ((lines.length - 1) * lh) / 2;
  if (plate) {
    const k = ramp(t, first, first + 0.4) * fadeOut;
    const band = g.createLinearGradient(0, top - size * 1.6, 0, top + lines.length * lh + size * 0.6);
    band.addColorStop(0, "rgba(0,0,0,0)");
    band.addColorStop(0.3, `rgba(0,0,0,${plate * k})`);
    band.addColorStop(0.7, `rgba(0,0,0,${plate * k})`);
    band.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = band;
    g.fillRect(0, top - size * 1.6, W, lines.length * lh + size * 2.2);
  }
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `${weight} ${size}px ${FONT}`;
  lines.forEach((l, i) => {
    const k = easeOut(ramp(t, l.at, l.at + 0.42));
    if (k <= 0) return;
    g.globalAlpha = k * fadeOut;
    g.filter = k < 1 ? `blur(${(1 - k) * 8}px)` : "none";
    g.shadowColor = "rgba(0,0,0,0.85)";
    g.shadowBlur = 24;
    g.shadowOffsetY = 4;
    g.fillStyle = l.color || color;
    g.fillText(l.text, W / 2, top + i * lh + (1 - k) * 16);
  });
  g.restore();
}

// ------------------------------------------------------------------ small props
function note(x, y, s, color = INK) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(-14, 30, 16, 12, -0.4, 0, Math.PI * 2);
  g.ellipse(34, 20, 16, 12, -0.4, 0, Math.PI * 2);
  g.fill();
  g.fillRect(-2, -34, 6, 64);
  g.fillRect(46, -44, 6, 64);
  g.beginPath();
  g.moveTo(-2, -34);
  g.lineTo(52, -44);
  g.lineTo(52, -30);
  g.lineTo(-2, -20);
  g.fill();
  g.restore();
}
function heart(x, y, s, color = INK, filled = false) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.beginPath();
  g.moveTo(0, 12);
  g.bezierCurveTo(-26, -6, -18, -28, 0, -14);
  g.bezierCurveTo(18, -28, 26, -6, 0, 12);
  if (filled) { g.fillStyle = color; g.fill(); } else { g.strokeStyle = color; g.lineWidth = 4; g.stroke(); }
  g.restore();
}
function rrect(x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function bubble(x, y, w, h, tail, text, { size = 40, fillC = PAPER, inkC = INK, font = 800 } = {}) {
  g.save();
  g.beginPath();
  g.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
  g.moveTo(x + tail[0] * 0.3 - 18, y + h * 0.35);
  g.lineTo(x + tail[0], y + tail[1]);
  g.lineTo(x + tail[0] * 0.3 + 18, y + h * 0.35);
  g.fillStyle = fillC;
  g.fill();
  g.strokeStyle = inkC;
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = fillC;
  g.beginPath();
  g.ellipse(x, y, w / 2 - 3, h / 2 - 3, 0, 0, Math.PI * 2);
  g.fill();
  if (text) {
    g.fillStyle = inkC;
    g.font = `${font} ${size}px ${FONT}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, x, y + 2);
  }
  g.restore();
}
function sfx(text, x, y, size, rot = 0, color = INK) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.font = `italic 900 ${size}px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.strokeStyle = color === INK ? PAPER : INK;
  g.lineWidth = size * 0.16;
  g.strokeText(text, 0, 0);
  g.fillStyle = color;
  g.fillText(text, 0, 0);
  g.restore();
}
function paperNote(kind, s, alpha) {
  g.save();
  g.scale(s, s);
  g.globalAlpha = alpha;
  g.fillStyle = PAPER;
  g.strokeStyle = INK;
  g.lineWidth = 3;
  rrect(-44, -30, 88, 60, 10);
  g.fill();
  g.stroke();
  g.fillStyle = INK;
  if (kind === 0) heart(-18, 2, 0.9, INK, true);
  else if (kind === 1) { rrect(-30, -16, 34, 24, 8); g.fill(); g.beginPath(); g.moveTo(-24, 8); g.lineTo(-30, 18); g.lineTo(-14, 8); g.fill(); }
  else if (kind === 2) { g.beginPath(); g.arc(-16, 0, 14, Math.PI, 0); g.lineTo(-2, 8); g.lineTo(-30, 8); g.closePath(); g.fill(); }
  else { g.font = `900 22px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("+1", -16, 2); }
  g.fillRect(4, -10, 30, 6);
  g.fillRect(4, 4, 20, 6);
  g.restore();
}

// ------------------------------------------------------------------ the generic everywhere-feed (not YORU)
function feedCard(x, y, w, h, seed, kind = "post") {
  const r = rng(seed);
  if (kind === "trend") {
    g.fillStyle = "#151517";
    rrect(x, y, w, h, 18);
    g.fill();
    g.strokeStyle = "#3a3a3e";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = "#e9e7e3";
    g.font = `900 ${h * 0.24}px ${FONT}`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText("#trend", x + 26, y + h * 0.36);
    g.fillStyle = "#5c5b60";
    g.fillRect(x + 26, y + h * 0.62, w * 0.5, 10);
    g.fillRect(x + 26, y + h * 0.75, w * 0.32, 10);
    g.fillStyle = "#e9e7e3";
    g.font = `800 ${h * 0.11}px ${FONT}`;
    g.textAlign = "right";
    g.fillText("9.9M ♥", x + w - 24, y + h * 0.8);
    return;
  }
  g.fillStyle = "#e9e7e3";
  rrect(x, y, w, h, 18);
  g.fill();
  g.fillStyle = "#b9b7b3";
  g.beginPath();
  g.arc(x + 40, y + 40, 20, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#9d9b98";
  g.fillRect(x + 72, y + 28, w * (0.25 + r() * 0.2), 10);
  g.fillRect(x + 72, y + 46, w * 0.18, 8);
  if (kind === "fav") {
    note(x + 52, y + h * 0.56, 0.75, INK);
    g.fillStyle = INK;
    g.font = `800 ${Math.round(w * 0.072)}px ${FONT}`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText("my favorite song.", x + 110, y + h * 0.5);
    g.font = `500 ${Math.round(w * 0.056)}px ${FONT}`;
    g.fillText("it sounds like 3am.", x + 110, y + h * 0.66);
    for (let i = 0; i < 18; i++) {
      const bh = 6 + Math.abs(Math.sin(i * 1.7)) * 26;
      g.fillRect(x + 110 + i * 14, y + h * 0.86 - bh / 2, 8, bh);
    }
    heart(x + w - 40, y + h * 0.84, 0.8, INK, false);
    return;
  }
  g.fillStyle = "#c9c7c3";
  rrect(x + 18, y + 76, w - 36, h - 96, 12);
  g.fill();
  g.fillStyle = "#b0aeaa";
  for (let i = 0; i < 4; i++) g.fillRect(x + 36 + i * (w - 72) / 4, y + 96 + r() * 20, (w - 72) / 5, h - 140 - r() * 30);
}
function phone(x, y, w, h, screen, { bezel = 16, radius = 54, glow = 0.35 } = {}) {
  if (glow) {
    const gr = g.createRadialGradient(x + w / 2, y + h / 2, w * 0.3, x + w / 2, y + h / 2, w * 1.3);
    gr.addColorStop(0, `rgba(255,255,255,${glow * 0.35})`);
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(x - w, y - w * 0.6, w * 3, h + w * 1.2);
  }
  g.fillStyle = "#050506";
  rrect(x, y, w, h, radius);
  g.fill();
  g.strokeStyle = "#3b3b40";
  g.lineWidth = 3;
  g.stroke();
  g.save();
  rrect(x + bezel, y + bezel, w - 2 * bezel, h - 2 * bezel, radius - bezel * 0.6);
  g.clip();
  screen(x + bezel, y + bezel, w - 2 * bezel, h - 2 * bezel);
  g.restore();
}
// The owner's right hand: fingertips over the left edge, palm below, thumb on the screen.
function hand(X, Y, Wp, Hp, thumb = [0, 0], { shade = 0.4 } = {}) {
  const palm = `M${X + Wp * 0.3} ${Y + Hp - 10} C${X + Wp * 0.2} ${Y + Hp + 160} ${X + Wp * 0.1} ${H} ${X + Wp * 0.05} ${H + 80} L${X + Wp + 320} ${H + 80} C${X + Wp + 220} ${Y + Hp + 100} ${X + Wp + 120} ${Y + Hp * 0.8} ${X + Wp + 30} ${Y + Hp * 0.6} Z`;
  g.save();
  g.globalCompositeOperation = "destination-over";
  ink(g, palm, 7);
  g.restore();
  for (let i = 0; i < 3; i++) {
    const fy = Y + Hp * (0.5 + i * 0.13);
    const d = `M${X - 60} ${fy - 34} C${X + 10} ${fy - 40} ${X + 38} ${fy - 30} ${X + 40} ${fy} C${X + 38} ${fy + 30} ${X + 10} ${fy + 40} ${X - 60} ${fy + 34} Z`;
    ink(g, d, 6);
    tone(g, d, shade, { cell: 8, box: [X - 70, fy - 50, 120, 100] });
    stroke(g, `M${X + 4} ${fy - 24} C${X + 12} ${fy - 6} ${X + 12} ${fy + 6} ${X + 4} ${fy + 24}`, INK, 3);
  }
  const bx = X + Wp + 40, by = Y + Hp * 0.86;
  const tx = X + Wp * 0.64 + thumb[0], ty = Y + Hp * 0.6 + thumb[1];
  const ang = Math.atan2(ty - by, tx - bx);
  const len = Math.hypot(tx - bx, ty - by);
  g.save();
  g.translate(bx, by);
  g.rotate(ang);
  const th = `M-40 -70 C${len * 0.4} -66 ${len - 70} -50 ${len - 20} -36 C${len + 20} -24 ${len + 24} 24 ${len - 20} 36 C${len - 80} 48 ${len * 0.4} 66 -40 80 Z`;
  ink(g, th, 7);
  tone(g, th, (x, y) => (y > 20 ? shade + 0.15 : 0), { cell: 8, box: [-60, -80, len + 80, 170] });
  ink(g, `M${len - 78} -26 C${len - 40} -30 ${len - 18} -24 ${len - 12} 0 C${len - 18} 24 ${len - 40} 30 ${len - 78} 26 C${len - 88} 10 ${len - 88} -10 ${len - 78} -26 Z`, 4);
  stroke(g, `M${len * 0.45} -40 C${len * 0.48} -10 ${len * 0.48} 10 ${len * 0.45} 40`, INK, 3);
  g.restore();
}

// ================================================================== ACT 1 — the hook
const CROWD = (() => {
  const out = [];
  const r = rng(12);
  const rows = [
    { y: 600, s: 0.3, xs: [70, 190, 300, 420, 660, 780, 900, 1010] },
    { y: 720, s: 0.44, xs: [40, 200, 350, 730, 880, 1040] },
    { y: 930, s: 0.66, xs: [90, 290, 800, 990] },
  ];
  for (const row of rows) for (const x of row.xs) out.push({ x: x + (r() - 0.5) * 30, y: row.y + (r() - 0.5) * 30, s: row.s * (0.9 + r() * 0.2), seed: Math.floor(r() * 1e6) });
  return out;
})();
const NOTES = (() => {
  const r = rng(31);
  return Array.from({ length: 40 }, () => ({ x: r() * 1180 - 50, y: r() * 2200, v: 40 + r() * 60, sw: r() * 6, ph: r() * 6, rot: (r() - 0.5) * 1.4, d: 0.4 + r() * 0.9, k: Math.floor(r() * 4) }));
})();
const SEAT = { x: 414, y: 760, s: 0.42 };
const EYE = { x: SEAT.x + 234 * SEAT.s, y: SEAT.y + 380 * SEAT.s };

function crowd(t) {
  const k = easeInOut(ramp(t, ...C.crowdPush));
  const z = lerp(1, 3.6, k);
  const fx = lerp(W / 2, EYE.x, k), fy = lerp(980, EYE.y, k);
  g.save();
  g.translate(W / 2, lerp(980, 900, k));
  g.scale(z, z);
  g.translate(-fx, -fy);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1d1d21");
  bg.addColorStop(0.5, "#141416");
  bg.addColorStop(1, "#0b0b0c");
  g.fillStyle = bg;
  g.fillRect(-200, -200, W + 400, H + 400);
  // The window: the city at night, its colours drained to grey
  g.fillStyle = "#26262b";
  g.fillRect(140, 250, 800, 300);
  footage("bokeh", 146, 256, 788, 288, { filter: "grayscale(1) brightness(0.55) contrast(1.1)" });
  g.fillStyle = "#26262b";
  for (let i = 1; i < 4; i++) g.fillRect(140 + i * 200 - 3, 250, 6, 300);
  g.strokeStyle = "#232327";
  g.lineWidth = 3;
  for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(540 + i * 30, 640); g.lineTo(540 + i * 260, 2100); g.stroke(); }
  for (let j = 0; j < 9; j++) { const yy = 640 + Math.pow(j / 8, 1.8) * 1460; g.beginPath(); g.moveTo(-200, yy); g.lineTo(1280, yy); g.stroke(); }
  g.save();
  g.filter = "blur(1.5px)";
  for (const p of CROWD) at(p.x, p.y, p.s, () => phoneHead(g, { seed: p.seed, glow: 0.8 + 0.2 * Math.sin(t * 3 + p.seed) }));
  g.restore();
  g.fillStyle = "#2c2c31";
  g.fillRect(250, 1236, 580, 26);
  const blink = Math.abs(t - C.blinkCrowd) < 0.07;
  at(SEAT.x, SEAT.y, SEAT.s, () => {
    torso(g, { tone: 0.35 });
    ink(g, "M60 1100 C40 1180 60 1260 140 1280 L470 1280 C550 1260 570 1180 550 1100 Z", 6);
    tone(g, "M60 1100 C40 1180 60 1260 140 1280 L470 1280 C550 1260 570 1180 550 1100 Z", 0.55, { cell: 9, box: [40, 1080, 540, 220] });
    g.fillStyle = "#0a0a0a";
    g.fillRect(250, 900, 110, 170);
    g.fillStyle = "rgba(240,240,250,0.9)";
    g.fillRect(260, 910, 90, 150);
    ink(g, "M200 960 C230 930 270 940 280 990 L270 1080 C240 1100 200 1080 196 1040 Z", 5);
    ink(g, "M410 960 C380 930 340 940 330 990 L340 1080 C370 1100 410 1080 414 1040 Z", 5);
    head(g, { headphones: true, eyes: blink ? "closed" : "open", look: [-0.5, 0.15], brows: "worried", mouth: "neutral", glow: "#ffffff" });
  });
  g.save();
  g.filter = "blur(6px)";
  for (const [x, y, s, seed] of [[40, 1360, 1.35, 7], [1040, 1400, 1.4, 9], [250, 1620, 1.2, 11], [860, 1640, 1.25, 13]]) at(x, y, s, () => phoneHead(g, { seed, glow: 0.9 }));
  g.restore();
  for (const n of NOTES) {
    const y = ((n.y + t * n.v) % 2300) - 200;
    const x = n.x + Math.sin(t * 1.1 + n.ph) * 30 * n.sw;
    g.save();
    g.translate(x, y);
    g.rotate(n.rot + Math.sin(t * 1.4 + n.ph) * 0.5);
    paperNote(n.k, n.d * 0.9, 0.5 + n.d * 0.35);
    g.restore();
  }
  g.restore();
  g.strokeStyle = PAPER;
  g.lineWidth = 6;
  g.strokeRect(28, 28, W - 56, H - 56);
}

// The eye. `dive` zooms into the reflection (the phone) for the cut to the scroll.
const REFL = { x: 632, y: 820 };
function eyeCU(t, dive = 0) {
  const k = ramp(t, C.eyeIn[0], C.hook[1]);
  const d = easeIn(dive);
  const z = lerp(1, 1.12, k) * Math.pow(9, d);
  const cx = lerp(540, REFL.x, d), cy = lerp(900, REFL.y, d);
  g.save();
  g.translate(540, 900);
  g.scale(z, z);
  g.translate(-cx, -cy);
  fill(g, full, "#e4e1dc");
  tone(g, full, (x, y) => clamp(0.65 - y / 1100) + clamp((Math.abs(x - 540) - 380) / 600), { cell: 12, box: [0, 0, W, H] });
  taper(g, [[150, 520], [400, 450], [700, 455], [950, 520]], 54, { a: 0.2, b: 0.4 });
  const fringe = "M-20 -20 H1100 V330 Q1080 430 1050 520 Q1020 430 1000 360 Q960 520 900 650 Q890 500 860 400 Q800 520 760 600 Q760 470 720 380 Q660 470 610 540 Q620 430 600 350 Q540 450 470 590 Q480 450 450 360 Q390 470 330 640 Q330 480 300 380 Q240 480 170 690 Q180 520 160 410 Q100 500 60 600 Q60 470 40 380 Q10 420 -20 460 Z";
  tone(g, "M0 0 H1080 V760 H0 Z", (x, y) => clamp(0.55 - (y - 380) / 700), { cell: 10, box: [0, 0, 1080, 800] });
  fill(g, fringe, INK);
  for (const l of [[[120, 180], [260, 120], [400, 110]], [[560, 110], [700, 120], [860, 170]]]) taper(g, l, 18, { color: PAPER, a: 0.45, b: 0.45, steps: 24 });
  const white = "M110 920 C270 650 770 610 980 840 C900 1060 640 1130 470 1120 C300 1110 170 1030 110 920 Z";
  fill(g, white, "#fbfaf7");
  g.save();
  g.clip(new Path2D(white));
  const ix = 560, iy = 890;
  const ig = g.createLinearGradient(0, iy - 250, 0, iy + 250);
  ig.addColorStop(0, "#030303");
  ig.addColorStop(0.55, "#262629");
  ig.addColorStop(1, "#8a898d");
  g.fillStyle = ig;
  g.beginPath();
  g.arc(ix, iy, 250, 0, Math.PI * 2);
  g.fill();
  const r = rng(4);
  g.lineCap = "round";
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2 + r() * 0.02;
    const r0 = 104 + r() * 16, r1 = 170 + r() * 70;
    g.strokeStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.08 + r() * 0.18})`;
    g.lineWidth = 2 + r() * 3;
    g.beginPath();
    g.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0);
    g.lineTo(ix + Math.cos(a) * r1, iy + Math.sin(a) * r1);
    g.stroke();
  }
  g.strokeStyle = "#050505";
  g.lineWidth = 18;
  g.beginPath();
  g.arc(ix, iy, 244, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "#000";
  g.beginPath();
  g.arc(ix, iy, 100 + 6 * Math.sin(t * 1.5), 0, Math.PI * 2);
  g.fill();
  g.save();
  g.translate(REFL.x, REFL.y);
  g.rotate(0.06);
  g.fillStyle = "rgba(255,255,255,0.92)";
  rrect(-60, -96, 120, 192, 16);
  g.fill();
  g.save();
  rrect(-52, -88, 104, 176, 10);
  g.clip();
  const off = (t * 160) % 46;
  g.fillStyle = "rgba(20,20,22,0.55)";
  for (let i = -1; i < 6; i++) g.fillRect(-44, -88 + i * 46 - off + 6, 88, 30);
  g.restore();
  const ck = easeOut(ramp(t, C.crimsonLine, C.crimsonLine + 0.3));
  if (ck > 0) {
    g.strokeStyle = CRIMSON;
    g.lineWidth = 5;
    g.shadowColor = CRIMSON;
    g.shadowBlur = 16;
    g.beginPath();
    g.moveTo(-130, 30);
    g.lineTo(-130 + 270 * ck, 30 - 30 * ck);
    g.stroke();
  }
  g.restore();
  g.fillStyle = "#fff";
  g.beginPath();
  g.ellipse(470, 770, 46, 56, -0.4, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(470, 1010, 16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(10,10,10,0.42)";
  g.fill(new Path2D("M60 560 L1020 560 L1020 860 C780 660 300 680 60 960 Z"));
  g.restore();
  taper(g, [[90, 940], [260, 690], [560, 610], [820, 680], [1000, 830]], 46, { a: 0.12, b: 0.1 });
  for (let i = 0; i < 7; i++) {
    const a = 0.62 + i * 0.06;
    const x = lerp(700, 1010, a - 0.6), y = lerp(650, 840, a - 0.6);
    taper(g, [[x, y], [x + 50 + i * 6, y - 40 - i * 4], [x + 70 + i * 10, y - 90 - i * 6]], 14, { a: 0.05, b: 0.8, steps: 14 });
  }
  taper(g, [[230, 1050], [470, 1130], [760, 1080]], 12, { a: 0.4, b: 0.4 });
  taper(g, [[160, 760], [420, 590], [760, 590]], 8, { a: 0.4, b: 0.5 });
  g.restore();
}

// ================================================================== ACT 2 — the problem
const PH = { x: 250, y: 130, w: 580, h: 1110 };
function scrollOffset(t) {
  const t0 = C.scroll[0];
  let o = Math.max(0, Math.min(t, C.favCard) - t0) * 900;
  if (t > C.favCard) o += easeOut(ramp(t, ...C.favHold)) * 110;
  if (t > C.trendWave[0]) o += Math.pow(t - C.trendWave[0], 1.6) * 2400;
  return o;
}
function feedScreen(x, y, w, h, t) {
  g.fillStyle = "#d8d6d2";
  g.fillRect(x, y, w, h);
  const ch = 250, gap = 16, favIndex = 5;
  const o = scrollOffset(t);
  const base = y - o + (C.favCard - C.scroll[0]) * 900 - favIndex * (ch + gap) + h / 2 - ch / 2;
  for (let i = 0; i < 40; i++) {
    const cy = base + i * (ch + gap);
    if (cy > y + h || cy + ch < y) continue;
    feedCard(x + 16, cy, w - 32, ch, 100 + i, i === favIndex ? "fav" : i > favIndex + 1 ? "trend" : "post");
  }
  if (t > C.trendWave[0]) {
    const k = ramp(t, ...C.trendWave);
    for (let j = 0; j < 9; j++) {
      const kk = clamp(k * 1.6 - j * 0.08);
      if (kk <= 0) continue;
      feedCard(x + 16 + Math.sin(j * 2.1) * 10, y + h + 40 - easeOut(kk) * (h + 260) + j * 120, w - 32, ch, 900, "trend");
    }
  }
}
function scrollScene(t, enter = 1) {
  fill(g, full, "#101012");
  const swipe = (t * 2.2) % 1;
  const hold = t > C.favCard && t < C.trendWave[0];
  const thumb = hold ? [0, 0] : [-20 + 40 * swipe, 120 - 260 * easeInOut(swipe)];
  g.save();
  const s = lerp(0.12, 1, enter);
  g.translate(lerp(REFL.x, PH.x + PH.w / 2, enter), lerp(REFL.y, PH.y + PH.h / 2, enter));
  g.scale(s, s);
  g.translate(-(PH.x + PH.w / 2), -(PH.y + PH.h / 2));
  phone(PH.x, PH.y, PH.w, PH.h, (x, y, w, h) => feedScreen(x, y, w, h, t), { glow: 0.5 });
  if (enter > 0.6) hand(PH.x, PH.y, PH.w, PH.h, thumb);
  g.restore();
  // the music note escapes the buried card, carrying "the things you love" onward
  const nk = ramp(t, ...C.noteRise);
  if (nk > 0 && nk < 1) {
    const x = lerp(PH.x + 120, 300, easeInOut(nk)), y = lerp(PH.y + 560, -60, easeIn(nk));
    g.save();
    g.shadowColor = "rgba(255,255,255,0.9)";
    g.shadowBlur = 30;
    note(x, y, 1.2 + nk * 1.4, PAPER);
    g.restore();
  }
}

const PANELS3 = [
  [[40, 60], [1040, 60], [1040, 600], [40, 680]],
  [[40, 710], [1040, 630], [1040, 1170], [40, 1210]],
  [[40, 1440], [1040, 1420], [1040, 1860], [40, 1860]],
];
function panelIn(t, t0, poly, draw, { dur = 0.26, border = INK } = {}) {
  if (t < t0) return;
  const k = expoOut(ramp(t, t0, t0 + dur));
  const cx = centroid(poly);
  g.save();
  g.translate(cx[0], cx[1]);
  g.scale(lerp(1.12, 1, k), lerp(1.12, 1, k));
  g.translate(-cx[0], -cx[1]);
  g.globalAlpha *= clamp(k * 1.5);
  polyPath(g, poly);
  g.save();
  g.clip();
  draw();
  g.restore();
  polyPath(g, poly);
  g.strokeStyle = border;
  g.lineWidth = 10;
  g.stroke();
  const f = 1 - ramp(t, t0, t0 + 0.14);
  if (f > 0) {
    polyPath(g, poly);
    g.fillStyle = `rgba(255,255,255,${f * 0.9})`;
    g.fill();
  }
  g.restore();
}
function interests(t) {
  fill(g, full, "#0b0b0c");
  panelIn(t, C.interests[0], PANELS3[0], () => {
    fill(g, "M0 0 H1080 V760 H0 Z", PAPER);
    radialLines(g, { cx: 700, cy: 380, n: 90, rIn: [300, 420], width: [2, 10], color: "#cfccc7", seed: 3 });
    at(260, -120 + Math.sin(t * 1.6) * 4, 1.2, () => profile(g, { headphones: true, eyes: "closed" }));
    for (let i = 0; i < 4; i++) {
      const p = (t * 0.6 + i * 0.27) % 1;
      note(760 + i * 60 + Math.sin(p * 6 + i) * 20, 520 - p * 380, 0.9 + i * 0.1, INK);
    }
  });
  panelIn(t, C.interests[1], PANELS3[1], () => {
    fill(g, "M0 600 H1080 V1300 H0 Z", "#e9e6e0");
    hatch(g, "M0 600 H1080 V1300 H0 Z", { gap: 14, angle: 0.4, w: 1.2, color: "#cfcac2", box: [0, 600, 1080, 700] });
    g.save();
    g.translate(300, 760);
    g.rotate(-0.06);
    fill(g, "M0 0 H560 V420 H0 Z", "#fbfaf6");
    stroke(g, "M0 0 H560 V420 H0 Z", INK, 3);
    const k = ramp(t, C.interests[1], C.interests[1] + 0.9);
    g.save();
    g.translate(120, 30);
    g.scale(0.5, 0.5);
    g.beginPath();
    g.rect(0, 0, 640 * Math.max(0.15, k), 760);
    g.clip();
    g.globalAlpha = 0.9;
    head(g, { hair: "buns", eyes: "smile", mouth: "grin", collar: "tee" });
    g.restore();
    g.restore();
    const px = 420 + 320 * Math.max(0.15, k), py = 900 + Math.sin(t * 26) * 8;
    g.save();
    g.translate(px, py);
    g.rotate(-0.7);
    fill(g, "M0 0 L26 -18 L280 -18 L280 18 L26 18 Z", "#f0eee9");
    stroke(g, "M0 0 L26 -18 L280 -18 L280 18 L26 18 Z", INK, 5);
    fill(g, "M0 0 L12 -8 L12 8 Z", INK);
    ink(g, "M120 -40 C170 -90 280 -80 320 -20 C340 40 300 100 220 110 C170 112 120 80 110 30 Z", 6);
    tone(g, "M120 -40 C170 -90 280 -80 320 -20 C340 40 300 100 220 110 C170 112 120 80 110 30 Z", 0.3, { cell: 8, box: [100, -100, 240, 220] });
    stroke(g, "M160 20 C190 30 230 28 260 10", INK, 3);
    g.restore();
  });
  panelIn(t, C.interests[2], PANELS3[2], () => {
    fill(g, "M0 1400 H1080 V1900 H0 Z", PAPER);
    tone(g, "M0 1400 H1080 V1900 H0 Z", (x, y) => clamp((y - 1400) / 700) * 0.35, { cell: 11, box: [0, 1400, 1080, 500] });
    const blink = Math.abs(t - (C.interests[2] + 0.55)) < 0.06;
    at(250, 1330, 0.95, () => head(g, { headphones: true, eyes: blink ? "closed" : "down", look: [0, 1], brows: "up" }));
    g.save();
    g.translate(540, 1850);
    g.rotate(-0.05);
    ink(g, "M-330 -150 L-10 -120 L-10 260 L-330 230 Z", 7);
    ink(g, "M10 -120 L330 -150 L330 230 L10 260 Z", 7);
    for (const [x, y, w, h] of [[-300, -110, 130, 120], [-150, -100, 120, 120], [-300, 30, 260, 150], [40, -110, 120, 130], [180, -120, 120, 130], [40, 40, 260, 150]]) stroke(g, `M${x} ${y} h${w} v${h} h${-w} Z`, INK, 4);
    g.restore();
    for (let i = 0; i < 5; i++) {
      const a = t * 2 + i * 1.3;
      const x = 300 + i * 120, y = 1480 + Math.sin(a) * 20;
      g.fillStyle = INK;
      g.beginPath();
      for (let j = 0; j < 4; j++) {
        const an = (j * Math.PI) / 2;
        g.lineTo(x + Math.cos(an) * 26, y + Math.sin(an) * 26);
        g.lineTo(x + Math.cos(an + Math.PI / 4) * 6, y + Math.sin(an + Math.PI / 4) * 6);
      }
      g.fill();
    }
  });
}

const MSG = "have you ever heard of";
function typedText(t) {
  const [a, b] = C.typeText;
  const [d0, d1] = C.deleteText;
  if (t < a) return "";
  if (t < b) return MSG.slice(0, Math.round(ramp(t, a, b) * MSG.length));
  if (t < d0) return MSG;
  return MSG.slice(0, Math.round((1 - ramp(t, d0, d1)) * MSG.length));
}
function chatScreen(x, y, w, h, t, text) {
  g.fillStyle = "#121214";
  g.fillRect(x, y, w, h);
  g.fillStyle = "#1c1c1f";
  g.fillRect(x, y, w, 120);
  g.fillStyle = "#3a3a3f";
  g.beginPath();
  g.arc(x + 70, y + 62, 30, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x + 120, y + 48, 200, 14);
  g.fillRect(x + 120, y + 72, 120, 10);
  const iy = y + h * 0.56;
  g.fillStyle = "#26262a";
  rrect(x + 30, iy, w - 150, 96, 48);
  g.fill();
  g.fillStyle = text ? "#8d8c92" : "#3a3a3f";
  g.beginPath();
  g.arc(x + w - 70, iy + 48, 40, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(x + w - 88, iy + 30);
  g.lineTo(x + w - 48, iy + 48);
  g.lineTo(x + w - 88, iy + 66);
  g.closePath();
  g.fill();
  g.font = `500 ${Math.round(Math.min(40, w * 0.046))}px ${FONT}`;
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillStyle = text ? "#f2f0ec" : "#6c6b70";
  g.fillText(text || "Message", x + 66, iy + 50);
  const tw = text ? g.measureText(text).width : 0;
  if (Math.floor(t * 3.2) % 2 === 0 || (t > C.typeText[0] && t < C.typeText[1])) {
    g.fillStyle = "#f2f0ec";
    g.fillRect(x + 70 + tw, iy + 26, 4, 50);
  }
  const ky = iy + 130;
  g.fillStyle = "#1a1a1d";
  g.fillRect(x, ky, w, h - (ky - y));
  g.fillStyle = "#2c2c31";
  [10, 9, 7].forEach((n, ri) => {
    const kw = (w - 40) / 10;
    const ox = x + 20 + ((10 - n) * kw) / 2;
    for (let i = 0; i < n; i++) { rrect(ox + i * kw + 5, ky + 24 + ri * 110, kw - 10, 92, 12); g.fill(); }
  });
  rrect(x + w * 0.25, ky + 24 + 3 * 110, w * 0.5, 92, 12);
  g.fill();
}
function typingScene(t) {
  fill(g, full, "#0c0c0d");
  const z = lerp(1, 1.05, ramp(t, ...C.typing));
  g.save();
  g.translate(540, 960);
  g.scale(z, z);
  g.translate(-540, -960);
  phone(90, 120, 900, 1900, (x, y, w, h) => chatScreen(x, y, w, h, t, typedText(t)), { radius: 90, bezel: 22, glow: 0.25 });
  const hes = ramp(t, ...C.hesitate);
  const tap = Math.abs(Math.sin(t * 20)) * (t > C.typeText[0] && t < C.typeText[1] ? 1 : 0);
  g.save();
  g.translate(0, 40 + hes * 160 - tap * 24);
  const by = 1760;
  const th = `M1240 ${by + 300} C1040 ${by + 120} 900 ${by - 40} 820 ${by - 120} C780 ${by - 170} 820 ${by - 230} 880 ${by - 200} C980 ${by - 150} 1120 ${by - 40} 1300 ${by + 60} Z`;
  ink(g, th, 8);
  tone(g, th, (x, y) => (y > by - 120 ? 0.4 : 0), { cell: 9, box: [780, by - 260, 540, 600] });
  ink(g, `M830 ${by - 150} C840 ${by - 196} 880 ${by - 206} 910 ${by - 186} C920 ${by - 160} 900 ${by - 130} 870 ${by - 126} Z`, 5);
  g.restore();
  g.restore();
}
function groupScene(t) {
  const k = ramp(t, ...C.group);
  fill(g, full, PAPER);
  motionLines(g, { angle: 0, n: 70, color: "#bdb9b2", seed: 8, width: [2, 8], len: [300, 1200], offset: t * 2000 });
  const slide = -easeIn(ramp(t, C.group[0] + 0.35, C.group[1])) * 760;
  g.save();
  g.translate(slide, 0);
  at(240, 470, 0.82, () => head(g, { hair: "bob", eyes: "smile", mouth: "grin", earring: true, collar: "tee" }));
  at(700, 420, 0.86, () => head(g, { hair: "curly", tone: 0.38, eyes: "smile", mouth: "grin", collar: "jacket" }));
  at(470, 520, 0.9, () => head(g, { hair: "cap", eyes: "smile", mouth: "open", tone: 0.15, collar: "dark" }));
  sfx("HAHA", 420, 330, 110, -0.12);
  sfx("HA!", 960, 380, 90, 0.15);
  bubble(760, 1150, 440, 180, [-120, -120], "the 3am thing!!", { size: 42 });
  g.restore();
  at(-260, 760, 1.5, () => profile(g, { light: "dark" }));
  fill(g, full, `rgba(0,0,0,${0.12 + k * 0.28})`);
}
function sendScene(t) {
  fill(g, full, "#0d0d0f");
  const tapped = t > C.sendTap;
  phone(PH.x, PH.y, PH.w, PH.h, (x, y, w, h) => {
    if (!tapped) {
      chatScreen(x, y, w, h, t, "this song sounds like 3am.");
      return;
    }
    const k = ramp(t, ...C.sink);
    g.fillStyle = "#d8d6d2";
    g.fillRect(x, y, w, h);
    const o = easeIn(clamp((k - 0.2) / 0.8)) * 1800;
    for (let i = 0; i < 14; i++) feedCard(x + 16, y + 30 + i * 266 - o, w - 32, 250, 300 + i, i % 2 ? "trend" : "post");
    const by = y + h * 0.42 - easeIn(clamp((k - 0.3) / 0.7)) * 900;
    g.save();
    g.globalAlpha = 1 - easeIn(k) * 0.9;
    g.fillStyle = CRIMSON;
    rrect(x + 50, by, w - 100, 120, 40);
    g.fill();
    g.fillStyle = "#fff";
    g.font = `600 30px ${FONT}`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText("this song sounds like 3am.", x + 80, by + 44);
    g.fillText("anyone?", x + 80, by + 82);
    g.restore();
    for (let j = 0; j < 6; j++) {
      const kk = clamp((k - 0.3) * 2 - j * 0.1);
      feedCard(x + 16, y + h + 20 - easeOut(kk) * (h * 0.9) + j * 150, w - 32, 250, 950, "trend");
    }
  }, { glow: 0.35 });
  hand(PH.x, PH.y, PH.w, PH.h, tapped ? [120, -40] : [150, -10 + Math.sin(t * 9) * 4]);
}
// Alone: profile in the dark against a rainy window.
function aloneScene(t) {
  fill(g, full, "#050506");
  footage("rain", 0, 0, W, H, { filter: "grayscale(1) brightness(0.42) contrast(1.15) blur(2px)", zoom: 1.1 });
  const hush = 1 - ramp(t, ...C.hush) * 0.6;
  const gl = g.createRadialGradient(560, 1500, 50, 560, 1500, 900);
  gl.addColorStop(0, `rgba(235,235,240,${0.32 * hush})`);
  gl.addColorStop(1, "rgba(235,235,240,0)");
  g.fillStyle = gl;
  g.fillRect(0, 0, W, H);
  const z = lerp(1, 1.03, ramp(t, ...C.alone));
  g.save();
  sway(t, 3);
  const breathe = 1 + Math.sin(t * 2.1) * 0.004;
  at(-300, -40, 2.5 * z, () => { g.scale(1, breathe); profile(g, { light: "below" }); });
  g.restore();
  dust(t, 0.35);
  fill(g, full, `rgba(0,0,0,${0.22 + (1 - hush) * 0.5})`);
}
function eyesState(t) {
  const [a, b] = C.blink;
  if (t < a) return "open";
  if (t < lerp(a, b, 0.5)) return "down";
  return "closed";
}
function closeScene(t, invert = false) {
  fill(g, full, "#060607");
  footage("rain", 0, 0, W, H, { filter: "grayscale(1) brightness(0.25) blur(6px)", zoom: 1.2 });
  g.save();
  sway(t, 2);
  at(-760, -900, 4.2 + (t - C.close[0]) * 0.08, () => head(g, { headphones: true, eyes: eyesState(t), look: [0, 0.6], light: "below", brows: "worried", mouth: "neutral" }));
  g.restore();
  const v = g.createLinearGradient(0, 0, 0, H);
  v.addColorStop(0, "rgba(0,0,0,0.65)");
  v.addColorStop(0.4, "rgba(0,0,0,0.1)");
  v.addColorStop(1, "rgba(0,0,0,0.75)");
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  if (invert) {
    g.globalCompositeOperation = "difference";
    g.fillStyle = "#fff";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
  }
}

// ================================================================== ACT 3 — the payoff
const wall = offscreen();
render(wall, () => {
  g.fillStyle = "#1a1a1d";
  g.fillRect(0, 0, W, H);
  for (let r = 0; r < 8; r++) for (let col = 0; col < 3; col++) feedCard(20 + col * 350, -40 + r * 250 + (col % 2) * 80, 330, 230, r * 7 + col, (r + col) % 3 === 0 ? "post" : "trend");
});
const WALL_SHARDS = fracture([[0, 0], [W, 0], [W, H], [0, H]], 404, 6).map((p) => ({ p, c: centroid(p), r: hash(p[0][0] * 0.13 + p[0][1] * 0.07) }));
function shatter(t, behind) {
  const k = ramp(t, ...C.shatter);
  behind();
  for (const s of WALL_SHARDS) {
    const dx = s.c[0] - W / 2, dy = s.c[1] - H * 0.48;
    const d = Math.hypot(dx, dy) || 1;
    const kk = clamp(k * 1.3 - s.r * 0.15);
    if (kk >= 1) continue;
    const e = 1 - Math.pow(1 - kk, 2.2);
    const tx = (dx / d) * e * 1700, ty = (dy / d) * e * 1700 + kk * kk * 400;
    const rot = (s.r - 0.5) * 3 * e;
    const sc = 1 + e * 0.6;
    g.save();
    polyPath(g, s.p, tx, ty, rot, sc, s.c);
    g.save();
    g.clip();
    g.translate(s.c[0] + tx, s.c[1] + ty);
    g.rotate(rot);
    g.scale(sc, sc);
    g.translate(-s.c[0], -s.c[1]);
    g.drawImage(wall, 0, 0);
    g.restore();
    polyPath(g, s.p, tx, ty, rot, sc, s.c);
    g.strokeStyle = PAPER;
    g.lineWidth = 4;
    g.stroke();
    g.restore();
  }
  const sk = 1 - ramp(t, C.shatter[0] + 0.1, C.shatter[0] + 0.5);
  if (sk > 0) {
    g.save();
    g.globalAlpha = sk;
    brushStroke(g, { pts: [[-60, 1420], [400, 1060], [700, 820], [1140, 460]], width: 90, seed: 7, color: CRIMSON, progress: 1 });
    g.restore();
  }
}
const PEOPLE = [
  { hair: "bob", eyes: "smile", mouth: "grin", earring: true, collar: "tee", prop: "guitar", pal: PAL.bob },
  { hair: "curly", tone: 0.38, mouth: "smile", headset: true, collar: "jacket", prop: "controller", pal: PAL.curly },
  { hair: "cap", tone: 0.16, mouth: "open", eyes: "wide", collar: "dark", prop: "board", pal: PAL.cap },
  { hair: "long", glasses: true, mouth: "soft", collar: "tee", prop: "book", pal: PAL.long },
  { hair: "buns", eyes: "smile", mouth: "grin", blush: true, tone: 0.1, collar: "hoodie", prop: "camera", pal: PAL.buns },
  { hair: "undercut", shave: true, tone: 0.46, mouth: "smile", earring: true, collar: "jacket", prop: "brush", pal: PAL.undercut },
];
const mono = (p) => ({ ...p, pal: undefined });
const GRID = [
  [[30, 150], [530, 150], [530, 690], [30, 730]],
  [[550, 150], [1050, 150], [1050, 650], [550, 690]],
  [[30, 750], [530, 710], [530, 1230], [30, 1250]],
  [[550, 710], [1050, 670], [1050, 1210], [550, 1230]],
  [[30, 1270], [530, 1250], [530, 1780], [30, 1780]],
  [[550, 1250], [1050, 1230], [1050, 1780], [550, 1780]],
];
function prop(kind, x, y, s, color = INK) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = 6;
  if (kind === "guitar") {
    g.rotate(-0.6);
    g.fillRect(-8, -150, 16, 170);
    rrect(-22, -200, 44, 60, 10); g.fill();
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-28, -190 + i * 18, 6, 0, 7); g.arc(28, -190 + i * 18, 6, 0, 7); g.fill(); }
    g.beginPath(); g.ellipse(0, 70, 70, 62, 0, 0, 7); g.ellipse(0, -4, 52, 44, 0, 0, 7); g.fill();
    g.fillStyle = PAPER; g.beginPath(); g.arc(0, 40, 18, 0, 7); g.fill();
  } else if (kind === "controller") {
    rrect(-90, -40, 180, 80, 40); g.fill();
    g.fillStyle = PAPER;
    g.fillRect(-60, -6, 36, 12); g.fillRect(-48, -18, 12, 36);
    for (const [a, b] of [[44, -10], [62, 8], [26, 8], [44, 26]]) { g.beginPath(); g.arc(a, b - 8, 7, 0, 7); g.fill(); }
  } else if (kind === "board") {
    g.rotate(-0.4);
    rrect(-140, -26, 280, 52, 26); g.fill();
    g.fillStyle = PAPER; g.fillRect(-100, -4, 200, 8);
    g.fillStyle = color;
    for (const a of [-90, 90]) { g.beginPath(); g.arc(a, 40, 16, 0, 7); g.fill(); }
  } else if (kind === "book") {
    ink(g, "M-100 -70 L0 -50 L100 -70 L100 70 L0 90 L-100 70 Z", 6);
    stroke(g, "M0 -50 L0 90", INK, 5);
    for (let i = 0; i < 3; i++) stroke(g, `M-80 ${-30 + i * 26} L-20 ${-20 + i * 26} M20 ${-20 + i * 26} L80 ${-30 + i * 26}`, INK, 3);
  } else if (kind === "camera") {
    rrect(-90, -55, 180, 110, 18); g.fill();
    g.fillRect(-40, -78, 60, 28);
    g.fillStyle = PAPER; g.beginPath(); g.arc(0, 0, 38, 0, 7); g.fill();
    g.fillStyle = color; g.beginPath(); g.arc(0, 0, 24, 0, 7); g.fill();
    g.fillStyle = PAPER; g.beginPath(); g.arc(8, -8, 7, 0, 7); g.fill();
  } else if (kind === "brush") {
    g.rotate(0.7);
    g.fillRect(-8, -40, 16, 180);
    g.beginPath(); g.moveTo(-14, -40); g.quadraticCurveTo(-18, -110, 0, -150); g.quadraticCurveTo(18, -110, 14, -40); g.fill();
    g.lineWidth = 10; g.beginPath(); g.moveTo(-160, 120); g.quadraticCurveTo(-60, 40, 40, 110); g.stroke();
  }
  g.restore();
}
function peopleGrid(t) {
  fill(g, full, "#0b0b0c");
  GRID.forEach((poly, i) => {
    const a = C.silhouettes + i * 0.06;
    if (t < a) return;
    const kin = expoOut(ramp(t, a, a + 0.22));
    const cx = centroid(poly);
    g.save();
    g.translate(cx[0], cx[1]);
    g.scale(lerp(0.85, 1, kin), lerp(0.85, 1, kin));
    g.translate(-cx[0], -cx[1]);
    polyPath(g, poly);
    g.save();
    g.clip();
    const rv = easeOut(ramp(t, C.individuals[i], C.individuals[i] + 0.3));
    const xs = Math.min(...poly.map((p) => p[0])), ys = Math.min(...poly.map((p) => p[1]));
    fill(g, `M${xs} ${ys} h520 v560 h-520 Z`, "#4a494e");
    at(xs + 40, ys + 70, 0.72, () => silhouette(g, { seed: i, color: "#6e6d72" }));
    if (rv > 0) {
      g.save();
      g.beginPath();
      const p = rv * 1300;
      g.moveTo(xs - 200, ys + 700);
      g.lineTo(xs - 200 + p, ys + 700 - p * 1.1);
      g.lineTo(xs - 200 + p + 200, ys + 700 - p * 1.1 + 400);
      g.lineTo(xs - 200, ys + 900);
      g.closePath();
      g.rect(xs - 1, ys - 1, rv >= 1 ? 600 : 0, rv >= 1 ? 700 : 0);
      g.clip();
      fill(g, `M${xs} ${ys} h520 v560 h-520 Z`, PAPER);
      radialLines(g, { cx: xs + 260, cy: ys + 260, n: 60, rIn: [200, 300], width: [2, 9], color: "#d6d2cb", seed: 20 + i });
      at(xs + 50, ys + 60 + Math.sin(t * 2 + i) * 3, 0.7, () => head(g, mono(PEOPLE[i])));
      prop(PEOPLE[i].prop, xs + 440, ys + 470, 0.55);
      g.restore();
    }
    g.restore();
    polyPath(g, poly);
    g.strokeStyle = PAPER;
    g.lineWidth = 8;
    g.stroke();
    g.restore();
  });
}

// Looking up: colour blooms out from their face.
function lookUpScene(t, colour) {
  const [a, b] = C.lookUp;
  if (colour) {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#ffcf9a");
    bg.addColorStop(0.45, "#ff8f7a");
    bg.addColorStop(1, "#6a3f8f");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    radialLines(g, { cx: 540, cy: 860, n: 140, rIn: [420, 560], width: [2, 14], color: "rgba(255,255,255,0.75)", seed: 61 });
  } else {
    fill(g, full, PAPER);
    radialLines(g, { cx: 540, cy: 860, n: 140, rIn: [420, 560], width: [2, 14], color: INK, seed: 61, alpha: 0.85 });
    tone(g, full, (x, y) => clamp(Math.hypot(x - 540, y - 860) / 1300 - 0.15) * 0.8, { cell: 12, box: [0, 0, W, H] });
  }
  const glow = easeOut(ramp(t, a + 0.3, a + 1.0));
  const lg = g.createRadialGradient(540, 760, 60, 540, 760, 760);
  lg.addColorStop(0, `rgba(255,${colour ? 246 : 255},${colour ? 230 : 255},${0.95 * glow})`);
  lg.addColorStop(0.55, `rgba(255,${colour ? 236 : 255},${colour ? 210 : 255},${0.45 * glow})`);
  lg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = lg;
  g.fillRect(0, 0, W, H);
  const z = lerp(1.0, 1.1, easeOut(ramp(t, a, b)));
  const eyes = t < C.eyesUp ? "down" : t < C.eyesOpen ? "up" : Math.abs(t - (C.smile + 0.55)) < 0.06 ? "closed" : "open";
  const look = t < C.eyesUp ? [0, 1] : t < C.eyesOpen ? [0.1, -1] : [0, -0.1];
  g.save();
  sway(t, 2.5);
  g.translate(540, 900);
  g.scale(z, z);
  g.translate(-540, -900);
  at(60, 420, 1.6, () => head(g, { pal: colour ? PAL.hero : undefined, headphones: true, eyes, look, brows: t < C.eyesOpen ? "up" : "calm", mouth: t < C.smile ? "neutral" : "soft", rim: easeOut(ramp(t, a + 0.4, a + 0.9)) }));
  g.restore();
}
function colourBloom(t, draw, k, cx, cy) {
  if (k <= 0) { draw(false); return; }
  if (k >= 1) { draw(true); return; }
  draw(false);
  const cv = render(BUF[0], () => draw(true));
  const q = cv.getContext("2d");
  q.save();
  q.globalCompositeOperation = "destination-in";
  const R = lerp(160, 2600, easeOut(k));
  const m = q.createRadialGradient(cx, cy, Math.max(0, R - 700), cx, cy, R);
  m.addColorStop(0, "rgba(0,0,0,1)");
  m.addColorStop(1, "rgba(0,0,0,0)");
  q.fillStyle = m;
  q.fillRect(0, 0, W, H);
  q.restore();
  g.drawImage(cv, 0, 0);
  // a bright ring of light at the colour's edge
  g.save();
  g.globalCompositeOperation = "screen";
  const ring = g.createRadialGradient(cx, cy, Math.max(0, R - 120), cx, cy, R + 40);
  ring.addColorStop(0, "rgba(255,200,150,0)");
  ring.addColorStop(0.7, `rgba(255,200,150,${0.75 * (1 - k)})`);
  ring.addColorStop(1, "rgba(255,190,140,0)");
  g.fillStyle = ring;
  g.fillRect(0, 0, W, H);
  g.restore();
}

function shareScene(t) {
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#2a1b3d");
  bg.addColorStop(1, "#120b1c");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const main = [[30, 120], [1050, 120], [1050, 760], [30, 860]];
  panelIn(t, C.share[0], main, () => {
    const gr = g.createLinearGradient(0, 0, 0, 900);
    gr.addColorStop(0, "#ffe2c2");
    gr.addColorStop(1, "#ffb59a");
    g.fillStyle = gr;
    g.fillRect(0, 0, 1080, 900);
    radialLines(g, { cx: 380, cy: 520, n: 100, rIn: [320, 420], width: [2, 10], color: "rgba(255,255,255,0.8)", seed: 71 });
    at(60, 160 + Math.sin(t * 2) * 3, 1.0, () => head(g, { pal: PAL.hero, headphones: true, eyes: "smile", mouth: "grin", brows: "up", rim: 0.9 }));
    bubble(810, 330, 440, 280, [-190, 130], "", {});
    note(740, 290, 1.0);
    note(860, 270, 0.75, CRIMSON);
    g.fillStyle = INK;
    g.font = `800 36px ${FONT}`;
    g.textAlign = "center";
    g.fillText("you have to", 810, 382);
    g.fillText("hear this", 810, 424);
  }, { dur: 0.35 });
  const reps = [
    { poly: [[30, 890], [520, 860], [520, 1230], [30, 1250]], p: PEOPLE[0], text: "♪♪!!", at: C.replies[0], bg: "#c9f0e6" },
    { poly: [[560, 860], [1050, 800], [1050, 1220], [560, 1230]], p: PEOPLE[3], text: "send it!", at: C.replies[1], bg: "#e3dbff" },
    { poly: [[30, 1470], [1050, 1440], [1050, 1830], [30, 1840]], p: PEOPLE[1], text: "SAME!!", at: C.replies[2], bg: "#ffe7b0" },
  ];
  for (const r of reps) {
    panelIn(t, r.at, r.poly, () => {
      const xs = Math.min(...r.poly.map((p) => p[0])), ys = Math.min(...r.poly.map((p) => p[1]));
      fill(g, `M${xs} ${ys} h1100 v500 h-1100 Z`, r.bg);
      at(xs + 20, ys - 10 + Math.sin(t * 2.4 + xs) * 3, 0.62, () => head(g, r.p));
      bubble(xs + 330 + (r.poly[1][0] - r.poly[0][0] > 600 ? 260 : 0), ys + 150, 260, 140, [-120, 40], r.text, { size: 42 });
    });
  }
  leaks(t, 0.35);
}

const UIPH = { x: 266, y: 110, w: 548 };
UIPH.h = Math.round(((UIPH.w - 28) * 2338) / 1080) + 28;
function uiBackground() {
  fill(g, full, "#0b0910");
  footage("bokeh", 0, 0, W, H, { filter: "blur(8px) saturate(1.3) brightness(0.75)", zoom: 1.15 });
  fill(g, full, "rgba(8,6,14,0.35)");
  radialLines(g, { cx: 540, cy: 700, n: 80, rIn: [560, 700], width: [2, 7], color: CRIMSON, seed: 81, alpha: 0.35 });
}
function uiScreens(t, x, y, w, h) {
  const [s0, s1, s2, s3] = C.uiShots;
  const draw = (im, a = 1, dx = 0) => { g.globalAlpha = a; g.drawImage(im, x + dx, y, w, h); g.globalAlpha = 1; };
  if (t < s1) draw(IMG.profile);
  else if (t < s2) { const k = easeInOut(ramp(t, s1, s1 + 0.25)); draw(IMG.profile, 1, -w * k); draw(IMG.post0, 1, w * (1 - k)); }
  else if (t < s3) { draw(IMG.post0); draw(IMG.post1, easeOut(ramp(t, s2, s2 + 0.2))); }
  else { draw(IMG.post1); draw(IMG.post2, easeOut(ramp(t, s3, s3 + 0.2))); }
  const sy = h / 2338;
  const mark = (y0, y1, ta) => {
    const k = easeOut(ramp(t, ta, ta + 0.3)) * (1 - ramp(t, ta + 0.6, ta + 0.85));
    if (k <= 0) return;
    g.strokeStyle = CRIMSON;
    g.lineWidth = 4;
    g.globalAlpha = k;
    const xa = x + 14, xb = x + w - 14, ya = y + y0 * sy, yb = y + y1 * sy, L = 26;
    g.beginPath();
    g.moveTo(xa, ya + L); g.lineTo(xa, ya); g.lineTo(xa + L, ya);
    g.moveTo(xb - L, ya); g.lineTo(xb, ya); g.lineTo(xb, ya + L);
    g.moveTo(xa, yb - L); g.lineTo(xa, yb); g.lineTo(xa + L, yb);
    g.moveTo(xb - L, yb); g.lineTo(xb, yb); g.lineTo(xb, yb - L);
    g.stroke();
    g.globalAlpha = 1;
  };
  mark(1170, 1420, s2);
  mark(1460, 1720, s3);
  if (t < s1) mark(780, 880, s0 + 0.35);
}
function uiScene(t) {
  uiBackground();
  const out = easeIn(ramp(t, C.ui[1] - 0.45, C.ui[1]));
  g.save();
  g.translate(540, 700);
  g.scale(1 + out * 2.2, 1 + out * 2.2);
  g.translate(-540, -700);
  phone(UIPH.x, UIPH.y, UIPH.w, UIPH.h, (x, y, w, h) => uiScreens(t, x, y, w, h), { radius: 50, bezel: 14, glow: 0.25 });
  g.restore();
  g.save();
  g.globalAlpha = 1 - out;
  g.fillStyle = "#b9b7c2";
  g.font = `700 24px ${FONT}`;
  g.textAlign = "center";
  g.letterSpacing = "4px";
  g.fillText("REAL YORU SCREENS · DEMO ACCOUNTS", 540, UIPH.y + UIPH.h + 40);
  g.restore();
  if (out > 0) fill(g, full, `rgba(0,0,0,${out})`);
}
// The share page shrinks into the phone screen, then becomes the real app.
const sharePage = offscreen();
function toPhone(t) {
  const k = easeInOut(ramp(t, ...C.toPhone));
  uiBackground();
  render(sharePage, () => shareScene(t));
  const sx = UIPH.x + 14, sy = UIPH.y + 14, sw = UIPH.w - 28, sh = UIPH.h - 28;
  const x = lerp(0, sx, k), y = lerp(0, sy, k), w = lerp(W, sw, k), h = lerp(H, sh, k);
  g.save();
  g.globalAlpha = clamp(k * 3);
  phone(UIPH.x, UIPH.y, UIPH.w, UIPH.h, (px, py, pw, phh) => uiScreens(C.ui[0], px, py, pw, phh), { radius: 50, bezel: 14, glow: 0.25 });
  g.restore();
  g.save();
  g.globalAlpha = 1 - easeIn(ramp(t, C.toPhone[0] + 0.25, C.toPhone[1]));
  rrect(x, y, w, h, lerp(0, 40, k));
  g.clip();
  g.drawImage(sharePage, x, y, w, h);
  g.restore();
}

function wordmark(cx, cy, w, alpha = 1) {
  const im = IMG.wordmark;
  const h = (w * im.height) / im.width;
  g.save();
  g.globalAlpha = alpha;
  g.drawImage(im, cx - w / 2, cy - h / 2, w, h);
  g.restore();
}
function logoScene(t) {
  fill(g, full, "#000");
  const [a, b] = C.logoLines;
  const k = easeIn(ramp(t, a, b));
  const fade = 1 - ramp(t, b, b + 0.5);
  if (fade > 0) {
    g.save();
    g.globalAlpha = fade;
    radialLines(g, { cx: 540, cy: 900, n: 120, rIn: [lerp(1100, 160, k), lerp(1300, 260, k)], width: [2, 16], color: CRIMSON, seed: 91 });
    g.restore();
  }
  const li = expoOut(ramp(t, C.logoIn, C.logoIn + 0.7));
  if (li > 0) {
    g.save();
    g.globalCompositeOperation = "screen";
    const fl = g.createLinearGradient(0, 900, W, 900);
    fl.addColorStop(0, "rgba(229,16,47,0)");
    fl.addColorStop(0.5, `rgba(255,90,110,${0.55 * (1 - ramp(t, C.logoIn + 0.2, C.logoIn + 1.2))})`);
    fl.addColorStop(1, "rgba(229,16,47,0)");
    g.fillStyle = fl;
    g.fillRect(0, 890, W, 20);
    g.restore();
    wordmark(540, 900, lerp(860, 720, li), clamp(li * 1.4));
    const lw = easeOut(ramp(t, C.logoIn + 0.2, C.logoIn + 0.8)) * 520;
    g.fillStyle = CRIMSON;
    g.fillRect(540 - lw / 2, 1010, lw, 5);
  }
  const f = 1 - ramp(t, C.logoIn, C.logoIn + 0.16);
  if (f > 0 && t >= C.logoIn) { g.fillStyle = `rgba(255,255,255,${f * 0.85})`; g.fillRect(0, 0, W, H); }
  const out = easeIn(ramp(t, C.final[0] - 0.25, C.final[0] + 0.1));
  if (out > 0) fill(g, full, `rgba(0,0,0,${out})`);
}

// ================================================================== ACT 4 — the invitation
const CENTER = [[170, 130], [910, 160], [900, 1660], [180, 1640]];
const GLIMPSE = [
  { poly: [[20, 60], [360, 40], [350, 420], [30, 440]], p: 0 },
  { poly: [[730, 80], [1060, 60], [1060, 450], [740, 430]], p: 4 },
  { poly: [[10, 700], [250, 690], [250, 1060], [20, 1070]], p: 1 },
  { poly: [[840, 720], [1070, 700], [1070, 1080], [850, 1090]], p: 5 },
  { poly: [[30, 1420], [360, 1400], [360, 1820], [40, 1840]], p: 2 },
  { poly: [[720, 1400], [1060, 1420], [1050, 1850], [730, 1830]], p: 3 },
];
const GLIMPSE_BG = ["#c9f0e6", "#ffd9e6", "#ffe7b0", "#c8f0ec", "#ffd8c2", "#e3dbff"];
function finalScene(t) {
  const [a] = C.final;
  fill(g, full, "#0a0812");
  footage("bokeh", 0, 0, W, H, { filter: "blur(4px) saturate(1.35) brightness(0.8)", zoom: 1.05 });
  fill(g, full, "rgba(10,6,20,0.25)");
  const zk = easeInOut(ramp(t, a, a + 2.4));
  const z = lerp(1.9, 1.0, zk);
  g.save();
  g.translate(540, lerp(700, 760, zk));
  g.scale(z, z);
  g.translate(-540, -lerp(560, 760, zk));
  GLIMPSE.forEach((gp, i) => {
    const k = easeOut(ramp(t, a + 0.25 + i * 0.14, a + 0.65 + i * 0.14));
    if (k <= 0) return;
    g.save();
    g.globalAlpha = k;
    polyPath(g, gp.poly);
    g.save();
    g.clip();
    const xs = Math.min(...gp.poly.map((p) => p[0])), ys = Math.min(...gp.poly.map((p) => p[1]));
    fill(g, `M${xs} ${ys} h400 v460 h-400 Z`, GLIMPSE_BG[i]);
    at(xs - 20, ys + 10 + Math.sin(t * 2 + i) * 3, 0.6, () => head(g, PEOPLE[gp.p]));
    g.restore();
    polyPath(g, gp.poly);
    g.strokeStyle = WARM;
    g.lineWidth = 6;
    g.stroke();
    g.restore();
  });
  polyPath(g, CENTER);
  g.save();
  g.clip();
  const sky = g.createLinearGradient(0, 130, 0, 1660);
  sky.addColorStop(0, "#ffd7a8");
  sky.addColorStop(0.5, "#ff9e8a");
  sky.addColorStop(1, "#7a4c9e");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  radialLines(g, { cx: 540, cy: 560, n: 150, rIn: [380, 520], width: [2, 14], color: "rgba(255,255,255,0.7)", seed: 33 });
  tone(g, full, (x, y) => clamp((y - 1000) / 900) * 0.45, { cell: 12, color: "#5b3a7e", box: [0, 0, W, H] });
  at(372, 520, 0.55, () => standing(g, { pal: PAL.hero, headphones: true, eyes: "open", mouth: "soft", brows: "calm", rim: 1 }));
  dust(t, 0.6, "255,236,210");
  g.restore();
  polyPath(g, CENTER);
  g.strokeStyle = WARM;
  g.lineWidth = 10;
  g.stroke();
  const fr = easeInOut(ramp(t, ...C.frameDraw));
  if (fr > 0) {
    g.strokeStyle = CRIMSON;
    g.lineWidth = 6;
    g.shadowColor = CRIMSON;
    g.shadowBlur = 18;
    const pts = [[150, 110], [930, 140], [920, 1680], [160, 1660], [150, 110]];
    let len = 0;
    const seg = [];
    for (let i = 0; i < 4; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); len += l; }
    let rem = fr * len;
    g.beginPath();
    g.moveTo(...pts[0]);
    for (let i = 0; i < 4 && rem > 0; i++) {
      const u = Math.min(1, rem / seg[i]);
      g.lineTo(lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u));
      rem -= seg[i];
    }
    g.stroke();
    g.shadowBlur = 0;
  }
  g.restore();
  leaks(t, 0.45);
}
function questionScene(t) {
  fill(g, full, "#050505");
  const out = 1 - ramp(t, C.question[1] - 0.2, C.question[1]);
  const lines = ["What do you wish", "more people", "understood", "about you?"];
  g.save();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `800 100px ${FONT}`;
  lines.forEach((l, i) => {
    const k = easeOut(ramp(t, C.questionIn + i * 0.12, C.questionIn + 0.5 + i * 0.12));
    g.globalAlpha = k * out;
    g.filter = k < 1 ? `blur(${(1 - k) * 10}px)` : "none";
    g.fillStyle = "#f4f1ec";
    g.fillText(l, 540, 770 + i * 124 + (1 - k) * 24);
  });
  g.filter = "none";
  const lk = easeOut(ramp(t, C.questionIn + 0.5, C.questionIn + 1.0)) * out;
  g.globalAlpha = 1;
  g.fillStyle = CRIMSON;
  g.fillRect(540 - 90 * lk, 670, 180 * lk, 5);
  g.restore();
}
function endScene(t) {
  fill(g, full, "#000");
  footage("bokeh", 0, 0, W, H, { filter: "blur(14px) saturate(1.4) brightness(0.5)", alpha: easeOut(ramp(t, C.end[0], C.end[0] + 1.2)) * 0.55, zoom: 1.2 });
  fill(g, full, "rgba(0,0,0,0.35)");
  const k = expoOut(ramp(t, C.end[0] + 0.05, C.end[0] + 0.7));
  wordmark(540, 860, lerp(700, 660, k), k);
  const lw = easeOut(ramp(t, C.end[0] + 0.35, C.end[0] + 0.9)) * 380;
  g.fillStyle = CRIMSON;
  g.fillRect(540 - lw / 2, 970, lw, 5);
  const tk = easeOut(ramp(t, C.tagline, C.tagline + 0.6));
  g.save();
  g.globalAlpha = tk;
  g.filter = tk < 1 ? `blur(${(1 - tk) * 6}px)` : "none";
  g.fillStyle = "#f4f1ec";
  g.font = `800 50px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.letterSpacing = "8px";
  g.fillText("YOUR PEOPLE. YOUR STORY.", 540, 1060 + (1 - tk) * 14);
  g.restore();
  leaks(t, 0.18);
}

// ================================================================== frame
function slideIn(t, span, draw) {
  const k = easeOut(ramp(t, ...span));
  g.save();
  g.translate(0, (1 - k) * H);
  draw();
  g.restore();
}
function fadeIn(t, span, draw) {
  const k = easeInOut(ramp(t, ...span));
  if (k <= 0) return;
  g.save();
  g.globalAlpha = k;
  draw();
  g.restore();
}

async function renderFrame(t) {
  await prepare(t);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.filter = "none";
  g.letterSpacing = "0px";
  g.globalCompositeOperation = "source-over";
  let vig = 0.45;
  const enter = easeOut(ramp(t, C.eyeToScreen[0] + 0.2, C.eyeToScreen[1] + 0.15));

  // ---- ACT 1: the crowd, the eye, and a dive into the phone it reflects
  if (t < C.eyeIn[1]) crowd(t);
  if (t >= C.eyeIn[0] && t < C.hook[1]) fadeIn(t, C.eyeIn, () => eyeCU(t, ramp(t, ...C.eyeToScreen)));
  if (within(t, C.eyeToScreen)) fadeIn(t, [C.eyeToScreen[0] + 0.25, C.eyeToScreen[1]], () => scrollScene(t, enter));
  // ---- ACT 2
  if (t >= C.hook[1] && t < C.interests[0]) scrollScene(t, enter);
  if (within(t, [C.interests[0], C.typing[0] + 0.35])) interests(t);
  if (within(t, C.typing)) slideIn(t, C.slideUp, () => typingScene(t));
  if (within(t, C.group)) {
    groupScene(t);
    if (t < C.slideDown[1]) { g.save(); g.translate(0, easeIn(ramp(t, ...C.slideDown)) * H); typingScene(t); g.restore(); }
  }
  if (within(t, C.send)) slideIn(t, C.slideUp2, () => sendScene(t));
  if (within(t, C.ink1)) inkFlood(easeInOut(ramp(t, ...C.ink1)));
  if (within(t, C.alone)) { fadeIn(t, [C.alone[0], C.alone[0] + 0.3], () => aloneScene(t)); vig = 0.6; }
  if (within(t, [C.close[0], C.impact])) { fadeIn(t, [C.close[0], C.close[0] + 0.3], () => closeScene(t)); vig = 0.6; }
  // ---- ACT 3
  if (within(t, [C.impact, C.impact + 1 / 30])) { fill(g, full, "#fff"); vig = 0; }
  else if (within(t, [C.impact + 1 / 30, C.impact + 2 / 30])) { closeScene(t, true); vig = 0; }
  else if (within(t, [C.impact + 2 / 30, C.shatter[0] + 0.05])) {
    fill(g, full, CRIMSON);
    brushStroke(g, { pts: [[-60, 1420], [400, 1060], [700, 820], [1140, 460]], width: 90, seed: 7, color: INK, progress: 1 });
    vig = 0;
  } else if (within(t, [C.shatter[0] + 0.05, C.lookUp[0]])) shatter(t, () => peopleGrid(t));
  if (within(t, [C.lookUp[0], C.share[0] + 0.05])) {
    colourBloom(t, (col) => lookUpScene(t, col), ramp(t, ...C.bloom), 540, 900);
    leaks(t, ramp(t, C.bloom[0], C.bloom[1]) * 0.5);
    dust(t, ramp(t, C.bloom[0], C.bloom[1]) * 0.7, "255,236,210");
    if (t < C.gridOut[1]) {
      // the panels rush past the camera, revealing them
      const k = easeIn(ramp(t, ...C.gridOut));
      g.save();
      g.globalAlpha = 1 - k;
      g.translate(540, 960);
      g.scale(1 + k * 2.5, 1 + k * 2.5);
      g.translate(-540, -960);
      peopleGrid(t);
      g.restore();
    }
  }
  if (within(t, [C.share[0], C.toPhone[0]])) fadeIn(t, [C.share[0], C.share[0] + 0.06], () => shareScene(t));
  if (within(t, C.toPhone)) toPhone(t);
  if (within(t, [C.toPhone[1], C.ui[1]])) uiScene(t);
  if (within(t, C.logo)) logoScene(t);
  // ---- ACT 4
  if (within(t, C.final)) fadeIn(t, [C.final[0] + 0.05, C.final[0] + 0.4], () => finalScene(t));
  if (within(t, C.ink2)) inkFlood(easeInOut(ramp(t, ...C.ink2)));
  if (within(t, C.question)) { fadeIn(t, [C.question[0], C.question[0] + 0.15], () => questionScene(t)); vig = 0.2; }
  if (t >= C.end[0]) { fadeIn(t, [C.end[0], C.end[0] + 0.3], () => endScene(t)); vig = 0.25; }

  // ---- captions
  caption(t, [{ text: "Have you ever felt…", at: C.line1 }], C.hook[1] - 0.6, { y: 1290, size: 76 });
  caption(t, [{ text: "…invisible", at: C.line2[0] }, { text: "in a world where", at: C.line2[1] }, { text: "everyone is connected?", at: C.line2[2] }], C.hook[1] - 0.6, { y: 1490, size: 68, plate: 0.5 });
  caption(t, [{ text: "You have things you love.", at: C.loved[0] }], C.loved[1], { y: 1330 });
  caption(t, [{ text: "Things you wish", at: C.understood[0] }, { text: "someone understood.", at: C.understood[0] + 0.16 }], C.understood[1], { y: 520 });
  caption(t, [{ text: "But sometimes…", at: C.sometimes[0] }], C.sometimes[1], { y: 1330 });
  caption(t, [{ text: "…it feels like", at: C.nobody[0] }, { text: "nobody is listening.", at: C.nobody[0] + 0.2 }], C.nobody[1], { y: 1330 });
  caption(t, [{ text: "You were never boring.", at: C.boring[0] }], C.boring[1], { y: t < C.toPhone[0] ? 1345 : 1490, size: 74 });
  caption(t, [{ text: "You were looking", at: C.yourPeople[0] }, { text: "for your people.", at: C.yourPeople[0] + 0.18 }], C.yourPeople[1], { y: 1490, size: 74 });
  caption(t, [{ text: "Someone out there", at: C.someone[0] }, { text: "loves the things you love.", at: C.someone[0] + 0.2 }], C.someone[1], { y: 1330, size: 64 });
  finish(t, { vignette: vig });
}

async function renderCover() {
  await renderFrame(20.35);
  g.save();
  const band = g.createLinearGradient(0, 1180, 0, 1760);
  band.addColorStop(0, "rgba(5,5,6,0)");
  band.addColorStop(0.2, "rgba(5,5,6,0.92)");
  band.addColorStop(1, "rgba(5,5,6,0.96)");
  g.fillStyle = band;
  g.fillRect(0, 1180, W, 740);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#fff";
  g.font = `900 92px ${FONT}`;
  g.fillText("YOU WERE NEVER A", 540, 1390);
  g.fillText("BACKGROUND", 540, 1500);
  g.fillStyle = CRIMSON;
  g.fillText("CHARACTER.", 540, 1610);
  g.restore();
}

window.renderFrame = renderFrame;
window.renderCover = renderCover;
window.renderSheet = () => sheet(g);
window.ready = true;
