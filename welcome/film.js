// YORU 夜 — "Enter the Night". Deterministic canvas film.
//
// index.html?o=land|port&cut=full|short
// window.renderFrame(t) draws time t (seconds). Everything is either drawn here
// (ink, halftone, speed lines, the traced official wordmark, type) or is a real
// screenshot of the app (assets/screens). Timeline: /cues.json (shared with the
// app's captions and with audio/synth.py).

import * as M from "./manga.js";

const q = new URLSearchParams(location.search);
const PORT = q.get("o") === "port";
const CUT = q.get("cut") === "short" ? "short" : "full";
const W = PORT ? 1080 : 1920;
const H = PORT ? 1920 : 1080;
const FULL = CUT === "full";

const canvas = document.getElementById("c");
canvas.width = W;
canvas.height = H;
const g = canvas.getContext("2d");

const { clamp, ramp, lerp, easeOut, easeIn, easeInOut, expoOut } = M;
const INK = "#050505";
const PAPER = "#f4f2ee";
const RED = "#e5102f";
const DISPLAY = '"Inter Display", "Inter", sans-serif';
const JP = '"IPAPGothic", "IPAGothic", sans-serif';
const back = (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);

// ------------------------------------------------------------------ assets
const cues = await (await fetch("/cues.json")).json();
const CUE = cues.cuts[CUT];
const DUR = CUE.duration;
const SCREENS = [
  "p-home", "p-home-tall", "p-discover", "p-chat", "p-collections", "p-creators", "p-settings-look", "p-settings-themes",
  "p-ghost-off", "p-ghost-on", "p-lang-ja-home", "p-lang-ar-home", "p-lang-ja-settings",
  "p-profile-aurora", "p-profile-ink", "p-profile-sakura_night", "p-profile-crimson_moon", "p-profile-manga_panel",
  "p-hue-351", "p-hue-200", "p-hue-140", "p-hue-280", "p-hue-45",
  "d-home", "d-discover", "d-profile-crimson_moon", "d-collections", "d-chat",
];
const IMG = {};
const load = (key, src) =>
  new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res((IMG[key] = im));
    im.onerror = () => rej(new Error("missing " + src));
    im.src = src;
  });
await Promise.all([
  ...SCREENS.map((s) => load(s, `assets/screens/${s}.png`)),
  ...["moon", "city", "enso"].map((s) => load("art-" + s, `assets/art/${s}.png`)),
  ...["rei", "kuro", "mio", "gremlin"].map((s) => load("av-" + s, `assets/avatars/${s}.png`)),
]);
await Promise.all([
  document.fonts.load(`900 100px ${DISPLAY}`),
  document.fonts.load(`800 100px ${DISPLAY}`),
  document.fonts.load(`500 40px "Inter"`),
  document.fonts.load(`700 40px ${JP}`, "夜日本語"),
]);

// Official wordmark, traced to vector outlines (assets/trace_wordmark.py).
const WM = await (await fetch("assets/wordmark.json")).json();
const WM_LAYERS = WM.layers.map((L) => {
  const p = new Path2D();
  let len = 0;
  for (const pts of L.paths) {
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      p.lineTo(pts[i][0], pts[i][1]);
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    p.closePath();
  }
  return { ...L, path: p, len };
});
const WM_ALL = new Path2D();
for (const L of WM_LAYERS) WM_ALL.addPath(L.path);
// The crescent alone (largest red shape) for the opening glint.
const CRESCENT = (() => {
  const red = WM.layers.find((l) => l.name === "red");
  const biggest = red.paths.reduce((a, b) => (b.length > a.length ? b : a));
  const p = new Path2D();
  p.moveTo(biggest[0][0], biggest[0][1]);
  for (const q2 of biggest.slice(1)) p.lineTo(q2[0], q2[1]);
  p.closePath();
  let cx = 0, cy = 0;
  for (const [x, y] of biggest) { cx += x; cy += y; }
  return { path: p, cx: cx / biggest.length, cy: cy / biggest.length };
})();

// ------------------------------------------------------------------ pre-rendered layers
function offscreen(w, h, fn) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  fn(c.getContext("2d"), w, h);
  return c;
}
const GRAIN = [0, 1, 2, 3].map((k) =>
  offscreen(Math.ceil(W / 2), Math.ceil(H / 2), (c, w, h) => {
    const d = c.createImageData(w, h);
    const r = M.rng(100 + k);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = (r() * 255) | 0;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    c.putImageData(d, 0, 0);
  }),
);
const VIGNETTE = offscreen(W, H, (c) => {
  const gr = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(0,0,0,0.78)");
  c.fillStyle = gr;
  c.fillRect(0, 0, W, H);
});
const S = Math.max(W, H);
const RADIAL_W = offscreen(S, S, (c) => M.radialLines(c, { cx: S / 2, cy: S / 2, n: 150, rIn: [S * 0.16, S * 0.3], width: [2, 16], len: S, color: "#ffffff", seed: 3 }));
const RADIAL_R = offscreen(S, S, (c) => M.radialLines(c, { cx: S / 2, cy: S / 2, n: 90, rIn: [S * 0.2, S * 0.34], width: [2, 12], len: S, color: RED, seed: 9 }));
const RADIAL_K = offscreen(S, S, (c) => M.radialLines(c, { cx: S / 2, cy: S / 2, n: 170, rIn: [S * 0.14, S * 0.28], width: [2, 18], len: S, color: "#000", seed: 5 }));
const HALFTONE = offscreen(W, H, (c) => M.halftone(c, { w: W, h: H, cell: 18, color: "#1c1c1c", f: (x, y) => 0.75 * clamp(1 - Math.hypot(x - W * 0.85, y - H * 0.15) / (S * 0.9)) }));
const HALFTONE_RED = offscreen(W, H, (c) => M.halftone(c, { w: W, h: H, cell: 22, color: "#3a0610", f: (x, y) => 0.9 * clamp(1 - Math.hypot(x - W * 0.5, y - H * 1.05) / (S * 0.75)) }));
const SPEED = offscreen(W, H, (c) => M.motionLines(c, { angle: 0, n: 70, color: "#ffffff", seed: 14, width: [1, 5], area: [0, 0, W, H], len: [W * 0.2, W * 0.8], alpha: 1 }));
const SLASH = offscreen(1600, 700, (c) => M.brushStroke(c, { pts: [[60, 520], [700, 330], [1540, 180]], width: 150, seed: 21, color: RED, bristles: 170, dry: 0.5 }));
const SLASH_W = offscreen(1600, 700, (c) => M.brushStroke(c, { pts: [[60, 470], [760, 360], [1540, 260]], width: 120, seed: 27, color: PAPER, bristles: 150, dry: 0.6 }));
const SPLASH = offscreen(1400, 1400, (c) => M.inkSplash(c, { cx: 700, cy: 700, R: 330, seed: 33, color: "#000", spikes: 26, drops: 60, spatter: 220 }));
const SPLASH_R = offscreen(1400, 1400, (c) => M.inkSplash(c, { cx: 700, cy: 700, R: 300, seed: 35, color: RED, spikes: 22, drops: 40, spatter: 160 }));
const BURST = offscreen(1400, 1400, (c) => M.starburst(c, { cx: 700, cy: 700, rin: 380, rout: 690, n: 30, seed: 41, color: PAPER }));
// Opening panels: original monochrome artwork.
const PANEL_ART = {
  city: IMG["art-city"],
  moon: IMG["art-moon"],
  enso: IMG["art-enso"],
  phone: offscreen(1080, 1350, (c, w, h) => {
    c.fillStyle = "#070707";
    c.fillRect(0, 0, w, h);
    M.radialLines(c, { cx: 540, cy: 640, n: 120, rIn: [260, 420], width: [1, 9], color: "#2b2b2b", seed: 61, len: 1800 });
    c.fillStyle = "#121212";
    c.strokeStyle = PAPER;
    c.lineWidth = 8;
    M.polyPath(c, [[390, 260], [700, 260], [700, 1000], [390, 1000]]);
    c.fill();
    c.stroke();
    const gr = c.createLinearGradient(0, 300, 0, 960);
    gr.addColorStop(0, "rgba(229,16,47,0.9)");
    gr.addColorStop(1, "rgba(229,16,47,0.1)");
    c.fillStyle = gr;
    c.fillRect(412, 290, 266, 690);
    M.brushStroke(c, { pts: [[150, 1180], [540, 1120], [960, 1200]], width: 70, seed: 64, color: PAPER, bristles: 120 });
  }),
  ink: offscreen(1080, 1350, (c, w, h) => {
    c.fillStyle = PAPER;
    c.fillRect(0, 0, w, h);
    M.halftone(c, { w, h, cell: 16, f: (x, y) => 0.7 * clamp(y / h) });
    M.inkSplash(c, { cx: 560, cy: 560, R: 260, seed: 71, spikes: 24, drops: 50, spatter: 180 });
    M.brushStroke(c, { pts: [[80, 1150], [600, 980], [1000, 1060]], width: 90, seed: 73, color: RED, bristles: 140 });
  }),
};

// ------------------------------------------------------------------ drawing helpers
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}
function cover(c, im, x, y, w, h, { sx = 0, sy = 0, sw = im.width, sh = im.height } = {}) {
  const k = Math.max(w / sw, h / sh);
  const dw = sw * k, dh = sh * k;
  c.drawImage(im, sx, sy, sw, sh, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
function withAlpha(a, fn) {
  if (a <= 0.001) return;
  g.save();
  g.globalAlpha *= a;
  fn();
  g.restore();
}

// A phone showing a real screen. src: screen key, scroll: source px offset.
const PHONE_ASPECT = 1080 / 2338;
function phone(cx, cy, h, screen, o = {}) {
  const w = h * PHONE_ASPECT;
  const r = w * 0.11;
  const im = IMG[screen];
  g.save();
  g.translate(cx, cy);
  if (o.rot) g.rotate(o.rot);
  if (o.s) g.scale(o.s, o.s);
  if (o.skew) g.transform(1, o.skew, 0, 1, 0, 0);
  const bez = h * 0.014;
  g.shadowColor = "rgba(0,0,0,0.85)";
  g.shadowBlur = h * 0.06;
  g.shadowOffsetY = h * 0.025;
  rr(g, -w / 2 - bez, -h / 2 - bez, w + 2 * bez, h + 2 * bez, r + bez);
  g.fillStyle = "#0c0c0c";
  g.fill();
  g.shadowColor = "transparent";
  g.lineWidth = Math.max(1.5, h * 0.0016);
  g.strokeStyle = o.rim ?? "rgba(229,16,47,0.6)";
  g.stroke();
  rr(g, -w / 2, -h / 2, w, h, r);
  g.save();
  g.clip();
  g.fillStyle = "#000";
  g.fillRect(-w / 2, -h / 2, w, h);
  const srcH = im.width / PHONE_ASPECT;
  const drawScreen = (key, scroll, a = 1) => {
    const img = IMG[key];
    withAlpha(a, () => g.drawImage(img, 0, scroll ?? 0, img.width, img.width / PHONE_ASPECT, -w / 2, -h / 2, w, h));
  };
  drawScreen(screen, clamp(o.scroll ?? 0, 0, im.height - srcH));
  if (screen === "p-home-tall") {
    // The app's fixed header and bottom bar stay put while the feed scrolls.
    const home = IMG["p-home"], k = w / home.width;
    g.drawImage(home, 0, 0, home.width, 203, -w / 2, -h / 2, w, 203 * k);
    g.drawImage(home, 0, 2155, home.width, 183, -w / 2, h / 2 - 183 * k, w, 183 * k);
  }
  if (o.next) {
    // Panel-slash transition: the next screen is revealed through a diagonal cut.
    const k = o.mix ?? 0;
    if (k > 0) {
      const x0 = lerp(-w * 1.6, w * 0.6, easeInOut(k));
      g.save();
      g.beginPath();
      g.moveTo(x0, -h / 2 - 10);
      g.lineTo(x0 + w * 1.2, -h / 2 - 10);
      g.lineTo(x0 + w * 0.7, h / 2 + 10);
      g.lineTo(x0 - w * 0.5, h / 2 + 10);
      g.closePath();
      g.clip();
      drawScreen(o.next, o.nextScroll ?? 0);
      g.restore();
      if (k < 1) {
        g.strokeStyle = PAPER;
        g.lineWidth = w * 0.02;
        g.beginPath();
        g.moveTo(x0 + w * 1.2, -h / 2 - 10);
        g.lineTo(x0 + w * 0.7, h / 2 + 10);
        g.stroke();
        g.strokeStyle = RED;
        g.lineWidth = w * 0.008;
        g.stroke();
      }
    }
  }
  if (o.reveal != null) {
    // Hide the screen below a line (used to let chat messages "arrive").
    const y = lerp(-h / 2, h / 2, o.reveal);
    g.fillStyle = "#000";
    g.fillRect(-w / 2, y, w, h);
  }
  if (o.flash) withAlpha(o.flash, () => { g.fillStyle = "#fff"; g.fillRect(-w / 2, -h / 2, w, h); });
  // Glass highlight.
  const gl = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  gl.addColorStop(0, "rgba(255,255,255,0.07)");
  gl.addColorStop(0.45, "rgba(255,255,255,0)");
  g.fillStyle = gl;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.restore();
  if (o.trace != null) {
    // A crimson line traces around the device.
    const per = 2 * (w + h);
    g.setLineDash([per * o.trace, per]);
    g.strokeStyle = RED;
    g.lineWidth = h * 0.006;
    g.shadowColor = RED;
    g.shadowBlur = h * 0.02;
    rr(g, -w / 2 - bez * 2.4, -h / 2 - bez * 2.4, w + bez * 4.8, h + bez * 4.8, r + bez * 2.4);
    g.stroke();
    g.setLineDash([]);
    g.shadowBlur = 0;
  }
  g.restore();
  return { w, h };
}

// A cropped card from a screen (for close-ups).
function card(cx, cy, w, screen, crop, o = {}) {
  const im = IMG[screen];
  const [sx, sy, sw, sh] = crop;
  const h = (w * sh) / sw;
  g.save();
  g.translate(cx, cy);
  if (o.rot) g.rotate(o.rot);
  if (o.s) g.scale(o.s, o.s);
  if (o.persp) g.transform(1, o.persp, 0, 1, 0, 0);
  g.shadowColor = "rgba(0,0,0,0.8)";
  g.shadowBlur = w * 0.08;
  g.shadowOffsetY = w * 0.03;
  rr(g, -w / 2, -h / 2, w, h, w * 0.03);
  g.fillStyle = "#000";
  g.fill();
  g.shadowColor = "transparent";
  g.save();
  g.clip();
  g.drawImage(im, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  g.restore();
  g.lineWidth = Math.max(2, w * 0.006);
  g.strokeStyle = o.border ?? PAPER;
  g.stroke();
  g.restore();
  return h;
}

// Desktop browser window with a real desktop screenshot.
function browser(cx, cy, w, screen, o = {}) {
  const im = IMG[screen];
  const h = (w * im.height) / im.width;
  const bar = w * 0.03;
  g.save();
  g.translate(cx, cy);
  if (o.rot) g.rotate(o.rot);
  g.shadowColor = "rgba(0,0,0,0.85)";
  g.shadowBlur = w * 0.05;
  rr(g, -w / 2, -h / 2 - bar, w, h + bar, w * 0.012);
  g.fillStyle = "#151515";
  g.fill();
  g.shadowColor = "transparent";
  g.strokeStyle = "rgba(255,255,255,0.12)";
  g.lineWidth = 2;
  g.stroke();
  for (let i = 0; i < 3; i++) {
    g.fillStyle = ["#3a3a3a", "#3a3a3a", RED][i];
    g.beginPath();
    g.arc(-w / 2 + bar * (0.7 + i * 0.7), -h / 2 - bar / 2, bar * 0.18, 0, Math.PI * 2);
    g.fill();
  }
  g.drawImage(im, -w / 2, -h / 2, w, h);
  g.restore();
}

// The official wordmark. width in px, centred at cx, cy.
function wordmark(cx, cy, width, o = {}) {
  const k = width / WM.w;
  g.save();
  g.translate(cx, cy);
  if (o.persp) g.transform(o.scaleX ?? 1, o.persp, 0, 1, 0, 0);
  else if (o.scaleX) g.scale(o.scaleX, 1);
  g.scale(k, k);
  g.translate(-WM.w / 2, -WM.h / 2);
  const depth = o.depth ?? 0;
  if (depth > 0) {
    // Stacked extrusion: dimensional depth from the back forward.
    for (let i = Math.round(depth); i >= 1; i--) {
      const f = i / depth;
      g.save();
      g.translate(i * 0.55, i * 0.42);
      g.fillStyle = `rgb(${Math.round(lerp(70, 6, f))},${Math.round(lerp(8, 2, f))},${Math.round(lerp(14, 4, f))})`;
      g.fill(WM_ALL, "evenodd");
      g.restore();
    }
  }
  const fill = o.fill ?? 1;
  const stroke = o.stroke ?? 0;
  if (stroke > 0 && fill < 1) {
    g.lineWidth = 1.4;
    g.lineJoin = "round";
    for (const L of WM_LAYERS) {
      g.setLineDash([L.len * stroke, L.len]);
      g.strokeStyle = L.color;
      g.stroke(L.path);
    }
    g.setLineDash([]);
  }
  if (fill > 0) {
    withAlpha(fill, () => {
      for (const L of WM_LAYERS) {
        g.fillStyle = L.color;
        g.fill(L.path, "evenodd");
      }
    });
  }
  if (o.sweep != null && o.sweep > -0.2 && o.sweep < 1.2) {
    // Crimson light passing through the letters.
    g.save();
    g.clip(WM_ALL, "evenodd");
    g.globalCompositeOperation = "lighter";
    const x = lerp(-200, WM.w + 200, o.sweep);
    const gr = g.createLinearGradient(x - 120, 0, x + 120, WM.h);
    gr.addColorStop(0, "rgba(229,16,47,0)");
    gr.addColorStop(0.45, "rgba(255,60,80,0.85)");
    gr.addColorStop(0.5, "rgba(255,255,255,0.95)");
    gr.addColorStop(0.55, "rgba(255,60,80,0.85)");
    gr.addColorStop(1, "rgba(229,16,47,0)");
    g.fillStyle = gr;
    g.fillRect(-50, -50, WM.w + 100, WM.h + 100);
    g.restore();
  }
  g.restore();
}

function centered(t, x, y, size, o = {}) {
  g.save();
  g.font = `${o.weight ?? 900} ${size}px ${o.font ?? DISPLAY}`;
  g.letterSpacing = o.track ?? `${-size * 0.02}px`;
  g.textAlign = o.align ?? "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = o.color ?? PAPER;
  g.fillText(t, x, y);
  const m = g.measureText(t).width;
  g.restore();
  return m;
}

// ------------------------------------------------------------------ captions as burned-in type
const L = PORT
  ? { titleX: 80, titleY: 215, titleSize: 96, align: "left", stackSize: 118, tagSize: 40, devX: W / 2, devY: H * 0.625, devH: 1190, labelX: 80, labelY: 505 }
  : { titleX: 150, titleY: 430, titleSize: 112, align: "left", stackSize: 150, tagSize: 44, devX: W * 0.69, devY: H * 0.52, devH: 860, labelX: 150, labelY: 300 };

function titleLines(lines, lt, dur, o = {}) {
  const size = o.size ?? L.titleSize;
  const lh = size * 0.98;
  const x = o.x ?? L.titleX;
  const y0 = o.y ?? L.titleY;
  const out = ramp(lt, dur - 0.28, dur);
  lines.forEach((line, i) => {
    const k = expoOut(ramp(lt, i * 0.09, i * 0.09 + 0.5));
    const y = y0 + i * lh;
    g.save();
    g.beginPath();
    g.rect(x - 20, y - size * 0.95, W, size * 1.18);
    g.clip();
    const dy = (1 - k) * size * 1.1;
    const dx = -out * (W * 0.6) * (1 + i * 0.15);
    const last = i === lines.length - 1;
    centered(line, x + dx, y + dy, size, { align: o.align ?? L.align, color: last && o.redLast ? RED : PAPER });
    g.restore();
  });
  // Crimson underline bar.
  const bar = easeOut(ramp(lt, 0.25, 0.7)) * (1 - out);
  if (bar > 0) {
    g.fillStyle = RED;
    const bw = size * 2.2 * bar;
    const by = y0 + (lines.length - 1) * lh + size * 0.32;
    if ((o.align ?? L.align) === "center") g.fillRect(x - bw / 2, by, bw, size * 0.09);
    else g.fillRect(x, by, bw, size * 0.09);
  }
}

function drawCaption(c, t) {
  const lt = t - c.start;
  const dur = c.end - c.start;
  if (lt < 0 || lt > dur) return;
  const endMode = (FULL && t > 72.4) || (!FULL && t > 22.2);
  switch (c.style) {
    case "stack": {
      if (endMode) {
        const a = ramp(lt, 0, 0.5) * (1 - ramp(lt, dur - 0.3, dur));
        withAlpha(a, () => centered(c.lines.join(" "), W / 2, H * (PORT ? 0.6 : 0.68), PORT ? 52 : 58, { weight: 800, track: `${PORT ? 8 : 12}px` }));
        return;
      }
      const size = L.stackSize;
      const k1 = expoOut(ramp(lt, 0, 0.35));
      const k2 = expoOut(ramp(lt, 0.5, 0.85));
      const a = 1 - ramp(lt, dur - 0.25, dur);
      withAlpha(a, () => {
        g.save();
        g.translate(W / 2, H / 2 - size * 0.15);
        g.scale(lerp(1.35, 1, k1), lerp(1.35, 1, k1));
        withAlpha(k1, () => centered(c.lines[0], 0, 0, size));
        g.restore();
        g.save();
        g.translate(W / 2, H / 2 + size * 0.95);
        g.scale(lerp(1.5, 1, k2), lerp(1.5, 1, k2));
        withAlpha(k2, () => {
          const m = centered(c.lines[1], 0, 0, size, { color: PAPER });
          g.fillStyle = RED;
          g.fillRect(m / 2 - size * 0.23, -size * 0.18, size * 0.17, size * 0.17);
        });
        g.restore();
      });
      return;
    }
    case "tag": {
      const a = ramp(lt, 0, 0.6) * (1 - ramp(lt, dur - 0.35, dur));
      const y = c.key === "intro.proFree" ? H * (PORT ? 0.88 : 0.86) : H * (PORT ? 0.6 : 0.69);
      withAlpha(a, () => centered(c.lines[0], W / 2, y + (1 - easeOut(ramp(lt, 0, 0.6))) * 20, L.tagSize, { weight: 500, font: '"Inter"', track: "1px", color: "#d9d4cf" }));
      return;
    }
    case "title":
      return titleLines(c.lines, lt, dur, { redLast: false });
    case "build": {
      const size = L.titleSize * 0.92;
      c.lines.forEach((line, i) => {
        const k = expoOut(ramp(t, c.beats[i], c.beats[i] + 0.45));
        if (k <= 0) return;
        const out = ramp(lt, dur - 0.3, dur);
        const y = L.titleY + i * size * 1.02;
        g.save();
        g.beginPath();
        g.rect(L.titleX - 20, y - size, W, size * 1.2);
        g.clip();
        centered(line, L.titleX - out * W * 0.7, y + (1 - k) * size, size, { align: L.align, color: i === c.lines.length - 1 ? RED : PAPER });
        g.restore();
      });
      return;
    }
    case "pro": {
      const a = ramp(lt, 0, 0.6) * (1 - ramp(lt, dur - 0.4, dur));
      withAlpha(a, () => {
        const y = PORT ? 250 : 300;
        const x = PORT ? W / 2 : L.titleX;
        const align = PORT ? "center" : "left";
        g.save();
        g.font = `800 ${PORT ? 30 : 30}px ${DISPLAY}`;
        g.letterSpacing = "10px";
        const label = c.lines[0];
        const lw = g.measureText(label).width + 44;
        const bx = align === "center" ? x - lw / 2 : x;
        g.strokeStyle = RED;
        g.lineWidth = 3;
        g.strokeRect(bx, y - 44, lw, 62);
        g.fillStyle = RED;
        g.textAlign = "left";
        g.fillText(label, bx + 22, y);
        g.restore();
        const size = PORT ? 132 : 150;
        const sweep = ramp(lt, 0.5, 2.4);
        g.save();
        g.font = `900 ${size}px ${DISPLAY}`;
        g.letterSpacing = `${-size * 0.02}px`;
        g.textAlign = align;
        const gr = g.createLinearGradient(x - 200 + sweep * 900, 0, x + 200 + sweep * 900, 0);
        gr.addColorStop(0, PAPER);
        gr.addColorStop(0.5, "#ffd6dc");
        gr.addColorStop(1, PAPER);
        g.fillStyle = gr;
        g.fillText(c.lines[1], x, y + size * 1.15);
        g.restore();
      });
      return;
    }
    case "end": {
      const a = ramp(lt, 0, 0.7);
      withAlpha(a, () => {
        centered(c.lines[0], W / 2, H * (PORT ? 0.6 : 0.68), PORT ? 34 : 46, { weight: 800, track: `${PORT ? 3 : 8}px` });
      });
      // "ENTER YORU" end card.
      const b = ramp(lt, 0.9, 1.6);
      withAlpha(b, () => {
        const bw = PORT ? 520 : 460, bh = PORT ? 110 : 96;
        const bx = W / 2 - bw / 2, by = H * (PORT ? 0.72 : 0.78);
        rr(g, bx, by, bw, bh, bh / 2);
        g.fillStyle = RED;
        g.fill();
        centered("ENTER YORU  →", W / 2, by + bh * 0.64, PORT ? 40 : 36, { weight: 800, track: "4px" });
      });
      return;
    }
  }
}

function drawLabel(lb, t) {
  const lt = t - lb.start;
  const dur = lb.end - lb.start;
  if (lt < 0 || lt > dur) return;
  const a = ramp(lt, 0, 0.25) * (1 - ramp(lt, dur - 0.2, dur));
  withAlpha(a, () => {
    g.save();
    const pro = lb.text === "IN DEVELOPMENT";
    const x = pro ? (PORT ? W / 2 : L.titleX) : L.labelX;
    const y = pro ? (PORT ? 520 : 700) : L.labelY;
    g.font = `700 ${PORT ? 26 : 24}px "Inter"`;
    g.letterSpacing = "6px";
    g.textAlign = pro && PORT ? "center" : "left";
    g.fillStyle = "#b8b2ad";
    const w = g.measureText(lb.text).width;
    const sx = pro && PORT ? x - w / 2 - 26 : x;
    g.fillStyle = RED;
    g.fillRect(sx, y - 16, 12, 12);
    g.fillStyle = "#cfc9c4";
    g.fillText(lb.text, pro && PORT ? x + 13 : x + 26, y - 4);
    g.restore();
  });
}

// ------------------------------------------------------------------ scenes
// Each scene draws for local time lt in [0, dur].

function bgDark(alpha = 1) {
  g.fillStyle = INK;
  g.fillRect(0, 0, W, H);
  withAlpha(alpha, () => g.drawImage(HALFTONE, 0, 0));
}

// Scene 1 — the internet after dark.
function sceneIntro(lt, dur, o) {
  const beats = o.beats; // panel slam times (local)
  const line = o.line; // [start, end]
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  // Crimson hairline.
  const hl = easeInOut(ramp(lt, line[0], line[1]));
  const hlFade = 1 - ramp(lt, beats[0], beats[0] + 0.3);
  if (hl > 0 && hlFade > 0) {
    withAlpha(hlFade, () => {
      g.save();
      g.shadowColor = RED;
      g.shadowBlur = 24;
      g.fillStyle = RED;
      g.fillRect(W / 2 - (W / 2) * hl, H / 2 - 1.5, W * hl, 3);
      g.restore();
    });
  }
  // Panels: a manga page that assembles beat by beat while the camera drifts in.
  const layout = PORT
    ? [
        { art: "city", poly: [[40, 60], [1040, 60], [1040, 700], [40, 780]] },
        { art: "moon", poly: [[40, 820], [520, 760], [520, 1300], [40, 1300]] },
        { art: "phone", poly: [[560, 740], [1040, 720], [1040, 1300], [560, 1300]] },
        { art: "ink", poly: [[40, 1340], [1040, 1340], [1040, 1860], [40, 1860]] },
        { art: "enso", poly: [[620, 1380], [1000, 1380], [1000, 1820], [620, 1820]] },
      ]
    : [
        { art: "city", poly: [[40, 40], [760, 40], [700, 1040], [40, 1040]] },
        { art: "moon", poly: [[800, 40], [1400, 40], [1400, 520], [760, 560]] },
        { art: "phone", poly: [[1440, 40], [1880, 40], [1880, 1040], [1440, 1040]] },
        { art: "ink", poly: [[756, 600], [1400, 560], [1400, 1040], [740, 1040]] },
        { art: "enso", poly: [[1020, 640], [1360, 640], [1360, 1000], [1020, 1000]] },
      ];
  const cam = 1 + 0.12 * easeIn(ramp(lt, beats[0], dur));
  const dim = ramp(lt, o.dimAt, o.dimAt + 0.5);
  g.save();
  g.translate(W / 2, H / 2);
  g.scale(cam, cam);
  g.translate(-W / 2, -H / 2);
  layout.forEach((p, i) => {
    const tb = beats[i];
    if (tb == null || lt < tb) return;
    const k = expoOut(ramp(lt, tb, tb + 0.35));
    const par = 1 + i * 0.015 * ramp(lt, tb, dur);
    const c = M.centroid(p.poly);
    g.save();
    g.translate(c[0], c[1]);
    g.scale(lerp(1.25, 1, k) * par, lerp(1.25, 1, k) * par);
    g.translate(-c[0], -c[1]);
    M.polyPath(g, p.poly);
    g.save();
    g.clip();
    const xs = p.poly.map((q2) => q2[0]), ys = p.poly.map((q2) => q2[1]);
    const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
    cover(g, PANEL_ART[p.art], bx, by, bw, bh);
    if (lt - tb < 0.08) withAlpha(1 - (lt - tb) / 0.08, () => { g.fillStyle = "#fff"; g.fillRect(bx, by, bw, bh); });
    g.restore();
    M.polyPath(g, p.poly);
    g.lineWidth = 10;
    g.strokeStyle = PAPER;
    g.stroke();
    g.restore();
  });
  g.restore();
  // Speed lines across the cut.
  const sp = beats.find((b) => lt >= b && lt < b + 0.18);
  if (sp != null) withAlpha(0.35, () => g.drawImage(RADIAL_W, (W - S) / 2, (H - S) / 2));
  if (dim > 0) withAlpha(dim * 0.82, () => { g.fillStyle = "#000"; g.fillRect(0, 0, W, H); });
  // The logo begins: the crescent glints out of the dark.
  if (o.glint) {
    const k = ramp(lt, o.glint[0], o.glint[1]);
    if (k > 0) {
      const sc = (PORT ? 3.2 : 3.6) * lerp(0.85, 1, easeOut(k));
      withAlpha(easeIn(k), () => {
        g.save();
        g.translate(W / 2, H / 2);
        g.scale(sc, sc);
        g.translate(-CRESCENT.cx, -CRESCENT.cy);
        g.shadowColor = RED;
        g.shadowBlur = 40;
        g.fillStyle = RED;
        g.fill(CRESCENT.path);
        g.restore();
      });
    }
  }
}

// Scene 2 — the wordmark reveal. hit = local time of the impact.
function sceneLogo(lt, dur, o) {
  const hit = o.hit;
  bgDark(0.6);
  const ww = PORT ? 780 : 1200;
  const cy = H * (PORT ? 0.45 : 0.46);
  // Before the hit: brush slash + ink outline drawing.
  if (lt < hit) {
    const k = ramp(lt, 0, hit);
    withAlpha(0.95, () => {
      g.save();
      g.translate(W / 2, cy);
      g.rotate(-0.12);
      const sw = (PORT ? 1500 : 2000) * easeOut(k);
      g.beginPath();
      g.rect(-1000, -400, sw, 800);
      g.clip();
      g.drawImage(SLASH, -(PORT ? 800 : 1000), -350, PORT ? 1600 : 2000, PORT ? 700 : 875);
      g.restore();
    });
    wordmark(W / 2, cy, ww, { stroke: easeInOut(k), fill: 0 });
    return;
  }
  const lh = lt - hit;
  // Impact: burst, radial lines, ink splash behind.
  const burst = 1 - ramp(lh, 0, 0.9);
  if (burst > 0) {
    withAlpha(burst, () => {
      g.save();
      g.translate(W / 2, cy);
      g.rotate(lh * 0.2);
      g.drawImage(RADIAL_R, -S / 2, -S / 2);
      g.restore();
      const bs = (PORT ? 1.4 : 1.7) * lerp(0.7, 1.2, easeOut(ramp(lh, 0, 0.6)));
      g.save();
      g.translate(W / 2, cy);
      g.scale(bs, bs);
      g.drawImage(SPLASH_R, -700, -700);
      g.restore();
    });
  }
  withAlpha(0.55 * ramp(lh, 0.2, 1.2), () => {
    g.save();
    g.translate(W / 2, cy);
    g.scale(PORT ? 1.1 : 1.4, PORT ? 1.1 : 1.4);
    g.drawImage(SPLASH, -700, -700);
    g.restore();
  });
  // Dimensional turn: perspective skew and extrusion settle over three seconds.
  const turn = easeInOut(ramp(lh, 0, 3));
  const punch = 1 + 0.18 * (1 - expoOut(ramp(lh, 0, 0.5)));
  const settle = o.settle != null ? expoOut(ramp(lh, o.settle, o.settle + 0.6)) : 1;
  g.save();
  g.translate(W / 2, cy);
  g.scale(punch, punch);
  g.translate(-W / 2, -cy);
  wordmark(W / 2, cy, ww, {
    depth: lerp(26, 7, turn) * lerp(1, 0.4, settle),
    persp: lerp(-0.16, 0, turn),
    scaleX: lerp(0.78, 1, turn),
    sweep: o.sweep ? ramp(lh, o.sweep[0], o.sweep[1]) : null,
  });
  g.restore();
  // Whip out at the end.
  if (o.whip) {
    const w = ramp(lt, o.whip, dur);
    if (w > 0) {
      withAlpha(w, () => g.drawImage(SPEED, 0, 0));
      withAlpha(easeIn(w), () => { g.fillStyle = INK; g.fillRect(0, 0, W, H); });
    }
  }
}

// Phone sequences. shots: [{at, screen, scroll:[a,b], reveal}] in local time.
function deviceSequence(lt, dur, shots, o = {}) {
  let cur = 0;
  for (let i = 0; i < shots.length; i++) if (lt >= shots[i].at) cur = i;
  const s = shots[cur];
  const nx = shots[cur + 1];
  const segEnd = nx ? nx.at : dur;
  const k = ramp(lt, s.at, segEnd);
  const scroll = s.scroll ? lerp(s.scroll[0], s.scroll[1], easeInOut(k)) : 0;
  const mix = nx ? ramp(lt, nx.at - 0.22, nx.at) : 0;
  const enter = expoOut(ramp(lt, 0, 0.6));
  const drift = Math.sin((o.t0 + lt) * 0.6) * 0.012;
  const x = o.x ?? L.devX;
  const y = (o.y ?? L.devY) + (1 - enter) * H * 0.4;
  const h = o.h ?? L.devH;
  const stamp = 1 + 0.035 * (1 - expoOut(ramp(lt, s.at, s.at + 0.3))) * (cur > 0 ? 1 : 0);
  return phone(x, y, h, s.screen, {
    scroll,
    next: nx?.screen,
    nextScroll: nx?.scroll?.[0] ?? 0,
    mix,
    rot: (o.rot ?? -0.03) + drift,
    s: stamp,
    reveal: s.reveal ? lerp(s.reveal[0], s.reveal[1], k) : null,
    trace: o.trace ? ramp(lt, o.trace[0], o.trace[1]) : null,
    flash: cur > 0 ? 0.22 * (1 - ramp(lt, s.at, s.at + 0.1)) : 0,
  });
}

function backdrop(lt, o = {}) {
  bgDark(0.85);
  // Thin manga panel frame lines that slide slowly.
  g.save();
  g.strokeStyle = "rgba(244,242,238,0.07)";
  g.lineWidth = 2;
  const off = (lt * 30) % 200;
  for (let x = -200 + off; x < W + 200; x += 200) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x - 140, H);
    g.stroke();
  }
  g.restore();
  if (o.red) withAlpha(o.red, () => g.drawImage(HALFTONE_RED, 0, 0));
}

// Scene 3 — the real app in motion.
function sceneFeed(lt, dur, o) {
  backdrop(lt);
  if (!PORT && o.desktop) {
    // A wide browser behind the phone for depth.
    const a = ramp(lt, 0.2, 1) * (1 - ramp(lt, dur - 0.4, dur));
    withAlpha(0.3 * a, () => browser(W * 0.58 + Math.sin(lt * 0.3) * 20, H * 0.56, 1100, o.desktop, { rot: 0.02 }));
  }
  deviceSequence(lt, dur, o.shots, { t0: o.t0 ?? 0, trace: o.trace });
}

// Scene 4 — profile identity: banners cycle, colours sweep, a close-up card.
function sceneProfile(lt, dur, o) {
  backdrop(lt, { red: 0.4 });
  const shots = o.shots;
  let cur = 0;
  for (let i = 0; i < shots.length; i++) if (lt >= shots[i].at) cur = i;
  const s = shots[cur];
  // Halftone burst behind each change.
  const since = lt - s.at;
  if (since < 0.5 && cur > 0) {
    withAlpha(0.3 * (1 - since / 0.5), () => {
      g.save();
      g.translate(L.devX, L.devY);
      g.scale(0.6 + since, 0.6 + since);
      g.drawImage(BURST, -700, -700);
      g.restore();
    });
  }
  deviceSequence(lt, dur, shots, { t0: 2, trace: o.trace, rot: -0.02 });
  // Close-up of the profile header next to the phone (banner and frame).
  if (o.closeup && !PORT && s.screen.startsWith("p-profile")) {
    const a = ramp(lt, 0.3, 0.8) * (1 - ramp(lt, o.closeup - 0.3, o.closeup));
    withAlpha(a, () => {
      const cw = PORT ? 560 : 640;
      const cx = PORT ? W * 0.3 : W * 0.38;
      const cy2 = PORT ? H * 0.38 : H * 0.72;
      card(cx, cy2, cw, s.screen, [30, 170, 1020, 760], { rot: 0.05, persp: -0.04, border: RED });
    });
  }
}

// Scene 6 — Ghost Mode switch close-up, then language flips.
function sceneGhost(lt, dur, o) {
  backdrop(lt);
  const flip = o.flip;
  const on = lt >= flip;
  const a = expoOut(ramp(lt, 0, 0.5));
  phone(L.devX, L.devY + (1 - a) * 300, L.devH, on ? "p-ghost-on" : "p-ghost-off", { rot: -0.02, flash: on ? 0.6 * (1 - ramp(lt, flip, flip + 0.15)) : 0 });
  // Zoomed card of the Ghost Mode row.
  const z = ramp(lt, 0.4, 0.9) * (1 - ramp(lt, dur - 0.3, dur));
  withAlpha(z, () => {
    const cw = PORT ? 900 : 760;
    const pop = 1 + 0.06 * (1 - expoOut(ramp(lt, flip, flip + 0.3))) * (on ? 1 : 0);
    card(PORT ? W / 2 : W * 0.36, PORT ? H * 0.42 : H * 0.72, cw, on ? "p-ghost-on" : "p-ghost-off", [30, 210, 1020, 290], { s: pop, border: on ? RED : PAPER });
  });
}

function sceneLanguages(lt, dur, o) {
  backdrop(lt);
  const seq = [
    { at: 0, screen: "p-home", tag: "English" },
    { at: o.step, screen: "p-lang-ja-home", tag: "日本語" },
    { at: o.step * 2, screen: "p-lang-ar-home", tag: "العربية" },
  ];
  let cur = 0;
  for (let i = 0; i < seq.length; i++) if (lt >= seq[i].at) cur = i;
  const s = seq[cur];
  const since = lt - s.at;
  // Glitch transition: horizontal slices offset for a few frames.
  const glitch = cur > 0 && since < 0.16;
  const a = expoOut(ramp(lt, 0, 0.4));
  if (glitch) {
    const r = M.rng(Math.floor(lt * 60));
    for (let i = 0; i < 6; i++) {
      g.save();
      const y = r() * H, h = 30 + r() * 120;
      g.beginPath();
      g.rect(0, y, W, h);
      g.clip();
      phone(L.devX + (r() - 0.5) * 80, L.devY, L.devH, s.screen, { rot: -0.02 });
      g.restore();
    }
    withAlpha(0.5, () => phone(L.devX, L.devY, L.devH, seq[cur - 1].screen, { rot: -0.02 }));
  } else {
    phone(L.devX, L.devY + (1 - a) * 300, L.devH, s.screen, { rot: -0.02 });
  }
  // Big language word.
  const k = expoOut(ramp(since, 0, 0.35));
  const isJp = s.tag === "日本語";
  const font = isJp ? JP : s.tag === "English" ? DISPLAY : '"DejaVu Sans", sans-serif';
  withAlpha(k * (1 - ramp(lt, dur - 0.25, dur)), () => {
    const size = PORT ? 110 : 130;
    centered(s.tag, PORT ? W / 2 : L.titleX + (s.tag === "العربية" ? 420 : 0), PORT ? H * 0.17 : H * 0.78, size, { font, weight: isJp ? 700 : 900, align: PORT ? "center" : s.tag === "العربية" ? "right" : "left", color: cur === 0 ? PAPER : RED });
  });
}

// Scene 7 — YORU Pro, coming soon. Calmer and more refined.
function scenePro(lt, dur, o) {
  g.fillStyle = "#030303";
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, H * 0.95, 10, W / 2, H * 0.95, S * 0.75);
  glow.addColorStop(0, "rgba(229,16,47,0.42)");
  glow.addColorStop(0.5, "rgba(120,6,22,0.18)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  withAlpha(0.6, () => g.drawImage(HALFTONE_RED, 0, 0));
  // A crimson frame draws around the composition.
  const fr = easeInOut(ramp(lt, 0.2, 1.8));
  if (fr > 0) {
    const m = PORT ? 40 : 46;
    const per = 2 * (W + H - 4 * m);
    g.save();
    g.setLineDash([per * fr, per]);
    g.strokeStyle = RED;
    g.lineWidth = 3;
    g.strokeRect(m, m, W - 2 * m, H - 2 * m);
    g.restore();
  }
  // Pro cosmetics: real profile headers on a plinth of light.
  const cards = [
    { screen: "p-profile-sakura_night", at: o.cards },
    { screen: "p-profile-crimson_moon", at: o.cards + 0.6 },
    { screen: "p-profile-manga_panel", at: o.cards + 1.2 },
  ];
  const plY = PORT ? H * 0.56 : H * 0.62;
  const plX = PORT ? W / 2 : W * 0.66;
  const pl = ramp(lt, o.cards - 0.4, o.cards + 0.4) * (1 - ramp(lt, o.looks - 0.3, o.looks));
  withAlpha(pl, () => {
    const e = g.createRadialGradient(plX, plY + (PORT ? 380 : 330), 10, plX, plY + (PORT ? 380 : 330), PORT ? 520 : 600);
    e.addColorStop(0, "rgba(255,80,100,0.5)");
    e.addColorStop(1, "rgba(255,80,100,0)");
    g.fillStyle = e;
    g.beginPath();
    g.ellipse(plX, plY + (PORT ? 380 : 330), PORT ? 520 : 620, PORT ? 90 : 80, 0, 0, Math.PI * 2);
    g.fill();
  });
  cards.forEach((c, i) => {
    const k = expoOut(ramp(lt, c.at, c.at + 0.9));
    const out = ramp(lt, o.looks - 0.3, o.looks);
    if (k <= 0 || out >= 1) return;
    const spread = PORT ? 250 : 360;
    const ang = (i - 1) * 0.16 + Math.sin(lt * 0.5 + i) * 0.015;
    withAlpha(k * (1 - out), () => {
      card(plX + (i - 1) * spread * k, plY - (1 - k) * 120 + Math.abs(i - 1) * 40, PORT ? 470 : 480, c.screen, [30, 170, 1020, 900], { rot: ang, border: i === 1 ? RED : "rgba(244,242,238,0.6)" });
    });
  });
  // Saved looks / Pro tags in Settings (real screen).
  const lk = ramp(lt, o.looks, o.looks + 0.6) * (1 - ramp(lt, dur - 0.5, dur));
  withAlpha(lk, () => {
    card(PORT ? W / 2 : W * 0.73, plY - 40 + (1 - expoOut(ramp(lt, o.looks, o.looks + 0.8))) * 80, PORT ? 820 : 640, "p-settings-look", [30, 250, 1020, 700], { border: RED });
  });
}

// Scene 8 — converge and the final impact.
function sceneFinale(lt, dur, o) {
  const conv = o.converge; // [start, end]
  const impact = o.impact;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  if (lt < impact) {
    const screens = o.screens;
    const k = ramp(lt, conv[0], conv[1]);
    const n = Math.min(screens.length - 1, Math.floor(k * screens.length));
    const z = 1 + 0.25 * easeIn(k);
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(z, z);
    g.translate(-W / 2, -H / 2);
    withAlpha(0.6 * k, () => {
      g.save();
      g.translate(W / 2, H / 2);
      g.rotate(lt * 0.3);
      g.drawImage(RADIAL_W, -S / 2, -S / 2);
      g.restore();
    });
    // Panels close in from the edges.
    const edge = (1 - easeIn(k)) * 0.5;
    for (let i = 0; i <= n; i++) {
      const ang = (i / screens.length) * Math.PI * 2 + 0.4;
      const r = (PORT ? 700 : 760) * (edge + 0.12) * (1 - (i / screens.length) * 0.3);
      const age = lt - (conv[0] + (i / screens.length) * (conv[1] - conv[0]));
      const a = expoOut(clamp(age / 0.25));
      withAlpha(a, () => phone(W / 2 + Math.cos(ang) * r * (PORT ? 0.8 : 1.4), H / 2 + Math.sin(ang) * r * (PORT ? 1.2 : 0.7), (PORT ? 760 : 560) * (0.85 + 0.15 * a), screens[i], { rot: Math.cos(ang) * 0.12, rim: PAPER }));
    }
    g.restore();
    // One beat of silence: black.
    const blackout = ramp(lt, conv[1], conv[1] + 0.06);
    if (blackout > 0) withAlpha(blackout, () => { g.fillStyle = "#000"; g.fillRect(0, 0, W, H); });
    return;
  }
  const lh = lt - impact;
  bgDark(0.5);
  const burst = 1 - ramp(lh, 0, 1.2);
  withAlpha(burst, () => {
    g.save();
    g.translate(W / 2, H * 0.42);
    g.rotate(-lh * 0.15);
    g.drawImage(RADIAL_W, -S / 2, -S / 2);
    g.restore();
    g.save();
    g.translate(W / 2, H * 0.42);
    const bs = (PORT ? 1.3 : 1.6) * lerp(0.8, 1.15, easeOut(ramp(lh, 0, 0.8)));
    g.scale(bs, bs);
    g.drawImage(BURST, -700, -700);
    g.drawImage(SPLASH, -700, -700);
    g.restore();
  });
  // Brush slash under the wordmark.
  const sl = easeOut(ramp(lh, 0.1, 0.6));
  withAlpha(0.9, () => {
    g.save();
    g.translate(W / 2, H * 0.44);
    g.rotate(-0.08);
    const sw = (PORT ? 1300 : 1700) * sl;
    g.beginPath();
    g.rect(-(PORT ? 650 : 850), -300, sw, 600);
    g.clip();
    g.drawImage(SLASH, -(PORT ? 700 : 900), -260, PORT ? 1400 : 1800, PORT ? 612 : 790);
    g.restore();
  });
  const punch = 1 + 0.22 * (1 - expoOut(ramp(lh, 0, 0.55)));
  const ww = PORT ? 760 : 1080;
  g.save();
  g.translate(W / 2, H * 0.44);
  g.scale(punch, punch);
  g.translate(-W / 2, -H * 0.44);
  wordmark(W / 2, H * 0.44, ww, { depth: lerp(14, 4, easeOut(ramp(lh, 0, 1.5))), sweep: ramp(lh, 0.6, 1.8) });
  g.restore();
}

// ------------------------------------------------------------------ timelines
const PH = PORT ? 2338 : 2338; // phone screen source height
const TALL = IMG["p-home-tall"].height;
const SCENES = FULL
  ? [
      { a: 0, b: 7, fn: sceneIntro, o: { line: [1, 2], beats: [2, 2.5, 3, 3.5, 4], dimAt: 4.3, glint: [6.3, 7] } },
      { a: 7, b: 15, fn: sceneLogo, o: { hit: 1, sweep: [1.8, 3.2], settle: 3, whip: 7.5 } },
      { a: 15, b: 25, fn: sceneFeed, o: { t0: 0, desktop: "d-home", shots: [
        { at: 0, screen: "p-home-tall", scroll: [0, Math.min(TALL - PH, 2600)] },
        { at: 4, screen: "p-discover" },
        { at: 6.5, screen: "p-profile-crimson_moon" },
      ] } },
      { a: 25, b: 35, fn: sceneProfile, o: { closeup: 5, trace: [7.6, 9.6], shots: [
        { at: 0, screen: "p-profile-aurora" }, { at: 1, screen: "p-profile-ink" }, { at: 2, screen: "p-profile-sakura_night" },
        { at: 3, screen: "p-profile-crimson_moon" }, { at: 4, screen: "p-profile-manga_panel" },
        { at: 5, screen: "p-hue-351" }, { at: 5.5, screen: "p-hue-200" }, { at: 6, screen: "p-hue-140" }, { at: 6.5, screen: "p-hue-280" }, { at: 7, screen: "p-hue-45" },
        { at: 7.5, screen: "p-settings-themes" },
      ] } },
      { a: 35, b: 45, fn: sceneFeed, o: { t0: 3, shots: [
        { at: 0, screen: "p-discover", scroll: [0, 0] },
        { at: 3, screen: "p-chat" },
        { at: 6, screen: "p-collections" },
        { at: 8, screen: "p-home" },
      ] } },
      { a: 45, b: 48.5, fn: sceneGhost, o: { flip: 2 } },
      { a: 48.5, b: 52, fn: sceneLanguages, o: { step: 1.2 } },
      { a: 52, b: 55, fn: sceneFeed, o: { t0: 5, shots: [{ at: 0, screen: "p-creators" }] } },
      { a: 55, b: 68, fn: scenePro, o: { cards: 2, looks: 7 } },
      { a: 68, b: 80, fn: sceneFinale, o: { converge: [0, 4.4], impact: 4.5, screens: [
        "p-home", "p-discover", "p-profile-crimson_moon", "p-chat", "p-collections", "p-hue-200", "p-lang-ja-home", "p-creators", "p-profile-sakura_night",
      ] } },
    ]
  : [
      { a: 0, b: 3, fn: sceneIntro, o: { line: [0.2, 0.9], beats: [1, 1.25, 1.5, 1.75, 2], dimAt: 1.1, glint: [2.4, 3] } },
      { a: 3, b: 7, fn: sceneLogo, o: { hit: 0.5, sweep: [1.2, 2.4], settle: 1.8, whip: 3.6 } },
      { a: 7, b: 19, fn: sceneFeed, o: { t0: 0, shots: [
        { at: 0, screen: "p-home-tall", scroll: [0, 1400] },
        { at: 1.5, screen: "p-discover" },
        { at: 3, screen: "p-profile-crimson_moon" },
        { at: 4.5, screen: "p-hue-200" },
        { at: 6, screen: "p-chat" },
        { at: 7.5, screen: "p-collections" },
        { at: 9, screen: "p-ghost-on" },
        { at: 10.5, screen: "p-lang-ja-home" },
      ] } },
      { a: 19, b: 22, fn: scenePro, o: { cards: 0.3, looks: 2.4 } },
      { a: 22, b: 26, fn: sceneFinale, o: { converge: [-1, -0.5], impact: 0.2, screens: ["p-home"] } },
    ];

const BIG_HITS = FULL ? [8, 72.5] : [3.5, 22.2];

// ------------------------------------------------------------------ frame
window.renderFrame = (t) => {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  // Camera shake after the big hits.
  const sh = BIG_HITS.reduce((m, h) => Math.max(m, t >= h ? Math.exp(-(t - h) * 9) : 0), 0);
  g.save();
  if (sh > 0.01) {
    const r = M.rng(Math.floor(t * 60) + 7);
    g.translate((r() - 0.5) * 26 * sh, (r() - 0.5) * 26 * sh);
  }
  for (const s of SCENES) {
    if (t >= s.a && t < s.b) {
      g.save();
      s.fn(t - s.a, s.b - s.a, s.o);
      g.restore();
    }
  }
  g.restore();
  for (const lb of CUE.labels) drawLabel(lb, t);
  for (const c of CUE.captions) drawCaption(c, t);
  // Impact frames: one white, one inverted, on the big hits.
  for (const h of BIG_HITS) {
    const d = t - h;
    if (d >= 0 && d < 1 / 30) {
      g.fillStyle = "#fff";
      g.fillRect(0, 0, W, H);
    } else if (d >= 1 / 30 && d < 2 / 30) {
      g.globalCompositeOperation = "difference";
      g.fillStyle = "#fff";
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = "source-over";
    }
  }
  // Brand bug (top-left) once the logo has been revealed.
  const bugOn = FULL ? t > 15 && t < 68 : t > 7 && t < 22;
  if (bugOn) withAlpha(0.85, () => wordmark(PORT ? 120 : 130, PORT ? 70 : 62, PORT ? 150 : 150, {}));
  // Fade to black at the very end and fade in from black at the start.
  const fadeIn = 1 - ramp(t, 0, 0.4);
  const fadeOut = ramp(t, DUR - 0.8, DUR);
  if (fadeIn + fadeOut > 0) withAlpha(Math.max(fadeIn, fadeOut * 0.0), () => { g.fillStyle = "#000"; g.fillRect(0, 0, W, H); });
  // Grain and vignette.
  withAlpha(0.06, () => {
    g.globalCompositeOperation = "overlay";
    g.drawImage(GRAIN[Math.floor(t * 30) % 4], 0, 0, W, H);
  });
  g.drawImage(VIGNETTE, 0, 0);
};

window.meta = { W, H, duration: DUR, fps: cues.fps, cut: CUT, port: PORT };
window.ready = true;
