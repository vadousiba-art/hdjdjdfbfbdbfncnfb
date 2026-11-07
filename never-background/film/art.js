// Original manga character art for "You were never a background character",
// drawn with Canvas 2D paths. Heads live in a 600×720 box (chin near y 600);
// bodies extend below it. Every function draws at the current transform.

import { INK, PAPER, CRIMSON, rng, clamp, lerp } from "./manga.js";

export const GREY = "#8d8b88";

// Colours. MONO is the black-and-white manga world; the others are the
// colour that comes back at the end. Line art stays ink in both.
export const MONO = {
  color: false, skin: PAPER, skinDot: INK, hair: INK, shine: PAPER, cloth: PAPER, clothDot: INK, dark: INK,
  iris: ["#050505", "#2b2b2e", "#77767a"], white: "#fbfaf7", lip: INK, blush: INK, acc: INK, lid: "rgba(10,10,10,0.35)",
  jeans: PAPER, jeansDot: INK, shoe: PAPER,
};
const C0 = { color: true, white: "#fffaf3", lip: "#6a1f2b", blush: "#ef8a95", acc: CRIMSON, lid: "rgba(70,30,40,0.28)", jeans: "#3d4f75", jeansDot: "#222d47", shoe: "#f7f3ec" };
export const PAL = {
  hero: { ...C0, skin: "#f3cfb3", skinDot: "#c98b6b", hair: "#1a2136", shine: "#8fa3d6", cloth: "#2f3546", clothDot: "#151926", dark: "#2f3546", iris: ["#1f120c", "#6b3b24", "#d39a64"] },
  bob: { ...C0, skin: "#f6d6bd", skinDot: "#d39a7c", hair: "#6b3523", shine: "#e0a37a", cloth: "#8fd6c4", clothDot: "#4f9d8b", dark: "#8fd6c4", iris: ["#24150e", "#6d4429", "#b98552"] },
  curly: { ...C0, skin: "#8d5b3d", skinDot: "#5c3822", hair: "#22150f", shine: "#9a7a5f", cloth: "#eaae3e", clothDot: "#a8741a", dark: "#eaae3e", iris: ["#120a06", "#4a2a18", "#8a5a36"] },
  cap: { ...C0, skin: "#edc19f", skinDot: "#c48e6b", hair: "#22336b", shine: "#6f86cc", cloth: "#f08a4b", clothDot: "#b85a24", dark: "#f08a4b", iris: ["#14202e", "#2f5372", "#6f9cc0"] },
  long: { ...C0, skin: "#f4dccb", skinDot: "#d2a58c", hair: "#1c2747", shine: "#7d95d6", cloth: "#b8a6ec", clothDot: "#7c69bf", dark: "#b8a6ec", iris: ["#15122a", "#3e3478", "#8b7fd0"] },
  buns: { ...C0, skin: "#f7dcc8", skinDot: "#dca286", hair: "#ef86ad", shine: "#ffd3e4", cloth: "#f7b48c", clothDot: "#cf7d55", dark: "#f7b48c", iris: ["#2a1020", "#7a2c52", "#d77aa2"] },
  undercut: { ...C0, skin: "#6f4632", skinDot: "#472a1c", hair: "#7350c4", shine: "#b9a0f2", cloth: "#2e9a92", clothDot: "#1c6660", dark: "#2e9a92", iris: ["#100804", "#3a2214", "#7a5236"] },
};
let K = MONO;
export const SHADE = "#2a2a2c";
const P = (d) => new Path2D(d);

export function fill(g, d, c) {
  g.fillStyle = c;
  g.fill(typeof d === "string" ? P(d) : d);
}
export function stroke(g, d, c = INK, w = 5) {
  g.strokeStyle = c;
  g.lineWidth = w;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.stroke(typeof d === "string" ? P(d) : d);
}
export function ink(g, d, w = 6, c = PAPER) {
  const p = typeof d === "string" ? P(d) : d;
  fill(g, p, c);
  stroke(g, p, INK, w);
}

// Screentone dots inside a path (density 0..1).
export function tone(g, d, density, { cell = 9, color = INK, angle = Math.PI / 4, box = [0, 0, 600, 720] } = {}) {
  g.save();
  g.clip(typeof d === "string" ? P(d) : d);
  const [x0, y0, w, h] = box;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const cx = x0 + w / 2, cy = y0 + h / 2;
  const R = Math.hypot(w, h) / 2 + cell;
  const f = typeof density === "function" ? density : () => density;
  g.fillStyle = color;
  g.beginPath();
  for (let v = -R; v <= R; v += cell) {
    for (let u = -R; u <= R; u += cell) {
      const px = cx + u * ca - v * sa;
      const py = cy + u * sa + v * ca;
      const k = f(px, py);
      if (k <= 0.02) continue;
      const r = cell * 0.5 * Math.sqrt(Math.min(1, k)) * 1.15;
      g.moveTo(px + r, py);
      g.arc(px, py, r, 0, Math.PI * 2);
    }
  }
  g.fill();
  g.restore();
}

// Parallel hatching inside a path.
export function hatch(g, d, { gap = 9, angle = -0.9, w = 1.6, color = INK, box = [0, 0, 600, 720], alpha = 1 } = {}) {
  g.save();
  g.clip(typeof d === "string" ? P(d) : d);
  g.globalAlpha *= alpha;
  g.strokeStyle = color;
  g.lineWidth = w;
  const [x0, y0, bw, bh] = box;
  const R = Math.hypot(bw, bh);
  const cx = x0 + bw / 2, cy = y0 + bh / 2;
  const ca = Math.cos(angle), sa = Math.sin(angle);
  g.beginPath();
  for (let s = -R; s <= R; s += gap) {
    g.moveTo(cx + s * -sa - R * ca, cy + s * ca - R * sa);
    g.lineTo(cx + s * -sa + R * ca, cy + s * ca + R * sa);
  }
  g.stroke();
  g.restore();
}

// A tapered ink line through points (Catmull-Rom), thick in the middle.
export function taper(g, pts, w, { color = INK, a = 0.25, b = 0.25, steps = 40 } = {}) {
  const S = [];
  const n = pts.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    const m = i === n - 2 ? steps : steps - 1;
    for (let j = 0; j <= m; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      S.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  const L = [], R = [];
  for (let i = 0; i < S.length; i++) {
    const p = S[i], q = S[Math.min(S.length - 1, i + 1)], o = S[Math.max(0, i - 1)];
    let dx = q[0] - o[0], dy = q[1] - o[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const k = i / (S.length - 1);
    const prof = Math.min(1, k / Math.max(a, 1e-3), (1 - k) / Math.max(b, 1e-3));
    const hw = (w / 2) * (0.12 + 0.88 * Math.sin((Math.PI / 2) * clamp(prof)));
    L.push([p[0] - dy * hw, p[1] + dx * hw]);
    R.push([p[0] + dy * hw, p[1] - dx * hw]);
  }
  g.beginPath();
  g.moveTo(L[0][0], L[0][1]);
  for (const p of L) g.lineTo(p[0], p[1]);
  for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath();
  g.fillStyle = color;
  g.fill();
}

// ------------------------------------------------------------------ heads

const FACE = "M150 270 C148 390 172 470 226 540 C258 580 284 602 306 602 C332 600 362 572 398 526 C438 470 455 392 456 270 Z";
const NECK = "M238 520 L232 700 L382 700 L376 520 Z";
const EAR_L = "M156 318 C128 306 118 340 126 372 C132 398 150 410 162 404 Z";
const EAR_R = "M450 318 C478 306 488 340 480 372 C474 398 456 410 444 404 Z";

const HAIR = {
  // The protagonist: messy, spiky, falls over the eyes a little.
  messy: {
    front:
      "M92 372 C70 250 104 136 186 82 C250 40 352 30 424 70 C496 110 534 190 520 300 C516 336 508 362 500 384 L476 300 L462 372 L436 262 L414 340 L392 238 L358 328 L334 226 L304 318 L276 232 L248 326 L222 244 L200 336 L178 268 L160 362 L138 306 L118 392 Z",
    side: ["M126 300 C112 380 104 430 98 490 C126 450 146 410 160 372 Z", "M486 300 C500 380 508 430 516 486 C488 446 468 408 452 372 Z"],
    shine: [[[176, 150], [230, 118], [290, 106]], [[330, 104], [390, 112], [438, 140]]],
  },
  bob: {
    back: "M112 300 C100 180 186 66 306 66 C426 66 512 180 500 300 L506 560 C486 576 446 576 440 548 L172 548 C166 576 126 576 106 560 Z",
    front: "M118 330 C106 186 188 72 306 72 C424 72 506 186 494 330 L466 318 L460 290 L440 312 L432 284 L150 284 L144 312 L128 296 Z",
    shine: [[[170, 150], [240, 112], [306, 104]], [[340, 104], [400, 116], [446, 150]]],
  },
  long: {
    back: "M106 300 C96 170 190 54 306 54 C422 54 516 170 506 300 L540 720 L72 720 Z",
    front: "M136 340 C140 200 214 104 306 98 C398 104 472 200 476 340 C452 286 418 248 352 226 C372 262 378 296 372 330 C340 280 296 250 238 244 C204 268 168 300 136 340 Z",
    shine: [[[186, 150], [246, 120], [306, 112]]],
  },
  curly: { curly: true },
  buns: {
    buns: [[160, 92, 78], [452, 92, 78]],
    front:
      "M110 340 C96 200 180 90 306 88 C432 90 516 200 502 340 L478 288 L462 330 L440 262 L420 318 L396 250 L370 306 L340 246 L312 304 L280 248 L254 306 L228 252 L204 318 L180 270 L156 330 L136 288 Z",
    shine: [[[180, 160], [240, 128], [300, 120]]],
  },
  cap: { cap: true },
  undercut: {
    front:
      "M140 300 C130 190 190 96 290 80 C380 70 470 110 500 200 C520 260 500 300 470 300 L452 240 C420 200 360 190 300 196 C230 202 190 230 168 300 Z M300 196 C330 150 400 130 470 180 C420 170 360 170 300 196 Z",
    shave: true,
    shine: [[[220, 120], [300, 98], [380, 104]]],
  },
};

function hairShine(g, lines, w = 7) {
  for (const l of lines) taper(g, l, w, { color: K.shine, a: 0.45, b: 0.45, steps: 24 });
}

function curlyHair(g) {
  const r = rng(77);
  g.fillStyle = K.hair;
  g.beginPath();
  for (let i = 0; i <= 26; i++) {
    const a = Math.PI * (1.08 + (0.84 * i) / 26) - 0.02;
    const R = 248 + r() * 26;
    const x = 306 + Math.cos(a) * R * 0.95, y = 300 + Math.sin(a) * R * 0.92;
    const rad = 62 + r() * 26;
    g.moveTo(x + rad, y);
    g.arc(x, y, rad, 0, Math.PI * 2);
  }
  g.arc(306, 220, 210, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = K.shine;
  g.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const x = 160 + r() * 290, y = 60 + r() * 200;
    g.beginPath();
    g.arc(x, y, 10 + r() * 10, r() * 6, r() * 6 + 2.4);
    g.stroke();
  }
}

// Eyes: states "open" | "up" | "down" | "closed" | "wide" | "smile".
function eye(g, cx, cy, s, state, look, side, glow) {
  const [lx, ly] = look;
  g.save();
  g.translate(cx, cy);
  g.scale(side * s, s);
  if (state === "closed" || state === "smile") {
    const up = state === "smile" ? -1 : 1;
    taper(g, [[-56, -2 * up], [-20, 14 * up], [24, 14 * up], [56, 0]], 11, { a: 0.2, b: 0.35 });
    if (state === "closed") for (const x of [-30, -6, 18, 40]) taper(g, [[x, 12], [x - 4, 24]], 4, { a: 0.1, b: 0.6, steps: 6 });
    g.restore();
    return;
  }
  const lid = state === "down" ? 16 : state === "wide" ? -10 : 0;
  // White of the eye
  const white = `M-58 ${4 + lid} C-40 ${-30 + lid} 30 ${-34 + lid} 58 ${-6 + lid} C52 30 20 46 -4 46 C-34 46 -52 30 -58 ${4 + lid} Z`;
  fill(g, white, K.white);
  g.save();
  g.clip(P(white));
  // Iris
  const ix = lx * 16, iy = 10 + ly * 12 + lid * 0.5;
  const grd = g.createLinearGradient(0, iy - 40, 0, iy + 40);
  grd.addColorStop(0, K.iris[0]);
  grd.addColorStop(0.62, K.iris[1]);
  grd.addColorStop(1, K.iris[2]);
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(ix, iy, 30, 40, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#000";
  g.beginPath();
  g.ellipse(ix, iy - 2, 13, 18, 0, 0, Math.PI * 2);
  g.fill();
  if (glow) {
    g.fillStyle = glow;
    g.globalAlpha = 0.85;
    g.fillRect(ix - 10, iy + 8, 14, 18);
    g.globalAlpha = 1;
  }
  g.fillStyle = "#fff";
  g.beginPath();
  g.ellipse(ix + 9, iy - 16, 10, 12, -0.3, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(ix - 11, iy + 18, 4.5, 0, Math.PI * 2);
  g.fill();
  if (K.color) {
    g.fillStyle = "rgba(255,255,255,0.55)";
    g.beginPath();
    g.ellipse(ix - 4, iy + 26, 12, 5, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Lid shadow
  g.fillStyle = K.lid;
  g.fill(P(`M-60 ${-40 + lid} L60 ${-40 + lid} L60 ${-2 + lid} C30 ${-22 + lid} -30 ${-20 + lid} -60 ${8 + lid} Z`));
  g.restore();
  // Upper lid line + lashes
  taper(g, [[-62, 10 + lid], [-40, -24 + lid], [6, -34 + lid], [50, -16 + lid], [64, -6 + lid]], 13, { a: 0.15, b: 0.2 });
  taper(g, [[52, -16 + lid], [66, -22 + lid], [74, -30 + lid]], 5, { a: 0.1, b: 0.7, steps: 10 });
  taper(g, [[60, -8 + lid], [72, -9 + lid], [80, -15 + lid]], 3.5, { a: 0.1, b: 0.7, steps: 10 });
  // Lower lid
  taper(g, [[-34, 44], [-4, 50], [30, 42]], 4, { a: 0.4, b: 0.4, steps: 14 });
  g.restore();
}

function brow(g, x, y, s, side, mood, outline = false) {
  // Local -x is the inner end (by the nose).
  const dy = mood === "worried" ? [-12, 6] : mood === "determined" ? [12, -6] : mood === "up" ? [-8, -8] : [0, 0];
  g.save();
  g.translate(x, y);
  g.scale(side * s, s);
  const pts = [[-44, 6 + dy[0]], [-6, -3], [38, 3 + dy[1]]];
  if (outline) taper(g, pts, 15, { color: K.color ? K.skin : PAPER, a: 0.25, b: 0.55, steps: 20 });
  taper(g, pts, 8, { a: 0.25, b: 0.55, steps: 20 });
  g.restore();
}

function mouth(g, kind) {
  if (kind === "smile") taper(g, [[262, 500], [296, 518], [342, 500]], 6, { a: 0.3, b: 0.3, steps: 18 });
  else if (kind === "grin") {
    const m = "M258 494 C280 492 330 492 350 492 C344 540 270 540 258 494 Z";
    fill(g, m, K.lip);
    stroke(g, m, INK, 4);
    fill(g, "M268 498 L340 498 C336 508 272 508 268 498 Z", PAPER);
  } else if (kind === "open") {
    fill(g, "M286 500 C292 490 322 490 326 500 C324 524 290 524 286 500 Z", K.lip);
    stroke(g, "M286 500 C292 490 322 490 326 500 C324 524 290 524 286 500 Z", INK, 3);
  } else if (kind === "sad") taper(g, [[276, 510], [304, 502], [334, 510]], 5, { a: 0.4, b: 0.4, steps: 14 });
  else if (kind === "soft") taper(g, [[276, 502], [306, 510], [336, 500]], 5, { a: 0.4, b: 0.4, steps: 14 });
  else taper(g, [[280, 504], [306, 507], [332, 503]], 5, { a: 0.4, b: 0.4, steps: 14 });
}

/**
 * Front three-quarter head in the 600×720 box.
 * o: { hair, eyes, look:[x,y], mouth, brows, tone (skin screentone 0..0.5),
 *      light: "below"|"none", rim (crimson rim light 0..1), headphones, glasses,
 *      earring, headset, collar, blush, glow (iris reflection colour), hairTone }
 */
export function head(g, o = {}) {
  const prev = K;
  K = o.pal || MONO;
  try {
    headInner(g, o);
  } finally {
    K = prev;
  }
}

function headInner(g, o) {
  const h = HAIR[o.hair || "messy"];
  const eyes = o.eyes || "open";
  const look = o.look || [0, 0];
  // Back hair
  if (h.back) fill(g, h.back, K.hair);
  if (h.buns) for (const [x, y, r] of h.buns) { g.fillStyle = K.hair; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); hairShine(g, [[[x - r * 0.5, y - r * 0.3], [x, y - r * 0.62], [x + r * 0.4, y - r * 0.5]]], 6); }
  if (h.curly) curlyHair(g);
  // Neck
  ink(g, NECK, 6, K.skin);
  tone(g, NECK, (x, y) => clamp(0.65 - (y - 520) / 300), { cell: 8, color: K.skinDot });
  if (o.collar !== false) collar(g, o.collar || "hoodie");
  // Headphones band sits behind the jaw
  if (o.headphones) {
    taper(g, [[176, 560], [190, 640], [306, 676], [424, 640], [438, 560]], 22, { a: 0.1, b: 0.1 });
  }
  // Face
  ink(g, EAR_L, 5, K.skin);
  ink(g, EAR_R, 5, K.skin);
  ink(g, FACE, 6, K.skin);
  if (o.tone && !K.color) tone(g, FACE, o.tone, { cell: 7 });
  if (K.color) {
    // soft form shading: cheek warmth and a shadow down the far side
    g.save();
    g.clip(P(FACE));
    const sh = g.createLinearGradient(150, 0, 460, 0);
    sh.addColorStop(0, "rgba(255,255,255,0.10)");
    sh.addColorStop(0.65, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(60,20,30,0.22)");
    g.fillStyle = sh;
    g.fillRect(140, 250, 330, 360);
    for (const x of [214, 394]) {
      const bl = g.createRadialGradient(x, 456, 4, x, 456, 46);
      bl.addColorStop(0, "rgba(239,120,140,0.38)");
      bl.addColorStop(1, "rgba(239,120,140,0)");
      g.fillStyle = bl;
      g.fillRect(x - 50, 406, 100, 100);
    }
    g.restore();
  }
  if (o.shave) tone(g, "M150 270 L150 340 L180 300 L460 300 L456 270 Z", 0.4, { cell: 6, color: K.color ? K.hair : INK });
  // Shadow under the fringe
  tone(g, "M150 270 C200 330 410 330 456 270 L456 250 L150 250 Z", 0.5, { cell: 7, color: K.skinDot });
  if (o.light === "below") {
    // Phone light from below: lower face bright, a soft dark band above.
    g.save();
    g.clip(P(FACE));
    const lg = g.createLinearGradient(0, 260, 0, 610);
    lg.addColorStop(0, "rgba(8,8,10,0.62)");
    lg.addColorStop(0.55, "rgba(8,8,10,0.12)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    g.fillRect(100, 240, 400, 380);
    g.restore();
  }
  if (o.blush) for (const x of [214, 394]) hatch(g, `M${x - 34} 452 L${x + 34} 440 L${x + 30} 466 L${x - 30} 476 Z`, { gap: 7, angle: -1.1, w: 2, color: K.blush });
  // Brows, eyes, nose, mouth
  const by = eyes === "down" ? 272 : 262;
  eye(g, 234, 380, 1.12, eyes, [-look[0], look[1]], -1, o.glow);
  eye(g, 380, 380, 0.98, eyes, look, 1, o.glow);
  taper(g, [[310, 420], [302, 452], [314, 456]], 5, { a: 0.3, b: 0.3, steps: 12 });
  mouth(g, o.mouth || "neutral");
  // Front hair
  if (h.cap) {
    taper(g, [[156, 300], [166, 360]], 8, { a: 0.2, b: 0.2, steps: 8 });
    taper(g, [[450, 300], [442, 360]], 8, { a: 0.2, b: 0.2, steps: 8 });
    fill(g, "M126 286 C120 150 206 84 306 84 C406 84 492 150 486 286 Z", K.hair);
    fill(g, "M96 290 C190 250 420 250 524 290 C500 320 120 320 96 290 Z", K.color ? K.hair : INK);
    stroke(g, "M126 286 C120 150 206 84 306 84 C406 84 492 150 486 286 Z", INK, 5);
    stroke(g, "M96 290 C190 250 420 250 524 290 C500 320 120 320 96 290 Z", INK, 5);
    stroke(g, "M98 290 C190 252 420 252 522 290", K.shine, 3);
    g.fillStyle = PAPER;
    g.beginPath();
    g.arc(306, 180, 30, 0, Math.PI * 2);
    g.fill();
    fill(g, "M296 162 L320 166 L300 200 Z", INK);
  } else if (h.front) {
    fill(g, h.front, o.hairTone ? GREY : K.hair);
    if (o.hairTone || K.color) stroke(g, h.front, INK, 5);
    if (h.side) for (const s of h.side) fill(g, s, o.hairTone ? GREY : K.hair);
    if (K.color) {
      // a glossy band of reflected light across the hair
      g.save();
      g.clip(P(h.front));
      const gl = g.createLinearGradient(0, 60, 0, 300);
      gl.addColorStop(0, "rgba(255,255,255,0.0)");
      gl.addColorStop(0.35, "rgba(255,255,255,0.10)");
      gl.addColorStop(0.6, "rgba(0,0,0,0.0)");
      gl.addColorStop(1, "rgba(0,0,0,0.18)");
      g.fillStyle = gl;
      g.fillRect(60, 20, 500, 400);
      g.restore();
    }
    if (h.shine) hairShine(g, h.shine, 8);
  }
  // Brows sit over the fringe (drawn "through" the hair), outlined in paper.
  if (!h.cap) {
    brow(g, 230, by, 1.05, -1, o.brows, true);
    brow(g, 382, by, 0.92, 1, o.brows, true);
  }
  if (h.curly) {
    // Curls falling over the forehead
    g.fillStyle = K.hair;
    g.beginPath();
    for (const [x, y, r] of [[190, 260, 44], [250, 246, 46], [312, 240, 48], [374, 246, 46], [430, 262, 44]]) {
      g.moveTo(x + r, y);
      g.arc(x, y, r, 0, Math.PI * 2);
    }
    g.fill();
  }
  // Accessories
  if (o.glasses) {
    for (const [x, w] of [[236, 1], [378, 0.88]]) {
      g.save();
      g.translate(x, 384);
      g.scale(w, 1);
      stroke(g, "M-70 -36 L70 -36 C74 10 60 40 0 40 C-60 40 -74 10 -70 -36 Z", INK, 6);
      g.restore();
    }
    stroke(g, "M302 352 C310 344 320 344 322 352", INK, 6);
  }
  if (o.earring) {
    g.strokeStyle = INK;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(476, 412, 13, 0, Math.PI * 2);
    g.stroke();
  }
  if (o.headset) {
    taper(g, [[120, 380], [110, 200], [306, 40], [500, 200], [490, 380]], 26, { a: 0.05, b: 0.05 });
    for (const x of [110, 500]) { g.fillStyle = INK; g.beginPath(); g.ellipse(x, 380, 44, 70, 0, 0, Math.PI * 2); g.fill(); stroke(g, `M${x - 20} 340 L${x - 20} 420`, PAPER, 4); }
    taper(g, [[134, 440], [170, 520], [236, 548]], 10, { a: 0.1, b: 0.1 });
    g.fillStyle = INK;
    g.beginPath();
    g.arc(240, 548, 14, 0, Math.PI * 2);
    g.fill();
  }
  if (o.headphones) {
    for (const [x, r] of [[178, -0.4], [436, 0.4]]) {
      g.save();
      g.translate(x, 600);
      g.rotate(r);
      fill(g, "M-40 -54 C-10 -64 30 -60 44 -40 L44 46 C30 64 -10 66 -40 56 Z", INK);
      stroke(g, "M-24 -36 L-24 36", K.color ? K.acc : PAPER, K.color ? 7 : 4);
      g.restore();
    }
  }
  if (o.rim) {
    // Crimson rim light along the right-hand silhouette of hair and jaw.
    g.save();
    g.globalAlpha = o.rim;
    const R = o.hair === "messy" || !o.hair
      ? [[300, 32], [400, 50], [492, 118], [532, 220], [522, 320], [500, 386]]
      : [[300, 60], [420, 80], [500, 170], [512, 300]];
    taper(g, R.map(([x, y]) => [x + 9, y - 4]), 10, { color: CRIMSON, a: 0.2, b: 0.3 });
    taper(g, [[462, 300], [458, 400], [432, 480], [394, 534], [350, 580]], 7, { color: CRIMSON, a: 0.15, b: 0.6 });
    g.restore();
  }
}

export function collar(g, kind) {
  if (kind === "hoodie") {
    const d = "M92 720 C120 640 196 600 236 600 C270 650 344 650 378 600 C420 600 494 640 520 720 Z";
    ink(g, d, 6, K.cloth);
    tone(g, d, K.color ? (x) => (x > 380 ? 0.45 : 0.12) : 0.28, { cell: 9, color: K.clothDot });
    stroke(g, "M262 640 L254 712", K.color ? K.acc : INK, 5);
    stroke(g, "M352 640 L360 712", K.color ? K.acc : INK, 5);
  } else if (kind === "tee") {
    const d = "M80 720 C110 650 190 620 236 616 C260 660 352 660 376 616 C424 620 504 650 532 720 Z";
    ink(g, d, 6, K.cloth);
    if (K.color) tone(g, d, (x) => (x > 400 ? 0.4 : 0), { cell: 9, color: K.clothDot });
  } else if (kind === "jacket") {
    const d = "M70 720 C100 640 190 604 236 600 L306 700 L376 600 C424 604 512 640 542 720 Z";
    fill(g, d, K.color ? K.cloth : INK);
    if (K.color) { tone(g, d, (x) => (x > 400 ? 0.45 : 0.1), { cell: 9, color: K.clothDot }); stroke(g, d, INK, 5); }
    stroke(g, "M236 600 L272 720 M376 600 L340 720", K.color ? INK : PAPER, 4);
  } else if (kind === "dark") {
    const d = "M80 720 C110 640 196 604 236 600 C270 650 344 650 378 600 C420 604 504 640 532 720 Z";
    fill(g, d, K.color ? K.cloth : INK);
    if (K.color) { tone(g, d, (x) => (x > 400 ? 0.45 : 0.1), { cell: 9, color: K.clothDot }); stroke(g, d, INK, 5); }
  }
}

// Silhouette head + shoulders with a glowing phone over the face (the crowd).
export function phoneHead(g, { glow = 1, seed = 1, sat = 0.55 }) {
  const r = rng(seed);
  const hw = 1 + (r() - 0.5) * 0.18;
  g.save();
  g.scale(hw, 1);
  g.fillStyle = sat > 0.5 ? "#55545a" : "#7d7c80";
  g.beginPath();
  g.ellipse(0, 0, 60, 70, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-150, 260);
  g.bezierCurveTo(-140, 140, -90, 96, -40, 80);
  g.lineTo(40, 80);
  g.bezierCurveTo(90, 96, 140, 140, 150, 260);
  g.closePath();
  g.fill();
  g.restore();
  // Phone + glow
  const gr = g.createRadialGradient(0, 4, 10, 0, 4, 150);
  gr.addColorStop(0, `rgba(255,255,255,${0.75 * glow})`);
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.beginPath();
  g.arc(0, 4, 150, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#111";
  g.fillRect(-34, -48, 68, 116);
  g.fillStyle = `rgba(250,250,255,${0.85 + 0.15 * glow})`;
  g.fillRect(-29, -42, 58, 104);
  // Hands holding it
  g.fillStyle = sat > 0.5 ? "#4a494f" : "#6f6e72";
  g.beginPath();
  g.ellipse(-36, 50, 16, 26, 0.3, 0, Math.PI * 2);
  g.ellipse(36, 50, 16, 26, -0.3, 0, Math.PI * 2);
  g.fill();
}

// Plain grey silhouette bust (the "colourless" crowd before the reveal).
export function silhouette(g, { color = "#6d6c70", seed = 1 } = {}) {
  const r = rng(seed);
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(306, 330 + r() * 10, 165 + r() * 20, 210, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(40, 900);
  g.bezierCurveTo(50, 720, 150, 640, 240, 600);
  g.lineTo(372, 600);
  g.bezierCurveTo(462, 640, 560, 720, 570, 900);
  g.closePath();
  g.fill();
}

// Side profile head facing right, same box.
const PFACE =
  "M306 196 C338 230 352 290 354 336 C370 360 410 388 424 404 C410 414 396 418 396 428 C402 438 404 448 396 454 C402 462 400 476 388 480 C386 500 382 522 362 540 C322 562 268 548 246 520 L230 420 Z";
export function profile(g, o = {}) {
  ink(g, "M260 520 L268 700 L394 700 L370 520 Z", 6);
  tone(g, "M260 520 L268 700 L394 700 L370 520 Z", 0.5, { cell: 8 });
  if (o.collar !== false) fill(g, "M150 720 C170 640 220 610 270 600 C300 640 360 640 392 606 C440 620 490 660 510 720 Z", INK);
  ink(g, PFACE, 6);
  if (o.light === "below") {
    g.save();
    g.clip(P(PFACE));
    const lg = g.createLinearGradient(0, 200, 0, 560);
    lg.addColorStop(0, "rgba(8,8,10,0.75)");
    lg.addColorStop(0.6, "rgba(8,8,10,0.3)");
    lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg;
    g.fillRect(200, 180, 260, 400);
    g.restore();
  } else if (o.light === "dark") {
    tone(g, PFACE, 0.55, { cell: 7 });
  }
  // Eye in profile
  if (o.eyes === "closed") {
    taper(g, [[340, 336], [356, 346], [374, 342]], 7, { a: 0.3, b: 0.3, steps: 12 });
    taper(g, [[352, 346], [348, 356]], 3, { a: 0.1, b: 0.5, steps: 6 });
  } else {
    fill(g, "M342 330 C352 320 372 322 380 334 C370 352 352 352 342 330 Z", "#fbfaf7");
    fill(g, "M352 326 C360 324 366 330 366 342 C360 350 352 348 350 340 Z", INK);
    taper(g, [[336, 330], [356, 318], [384, 330]], 8, { a: 0.2, b: 0.2, steps: 14 });
  }
  taper(g, [[324, 296], [350, 286], [384, 296]], 7, { a: 0.2, b: 0.5, steps: 14 });
  taper(g, [[372, 470], [388, 468]], 4, { a: 0.3, b: 0.3, steps: 6 });
  // Ear
  ink(g, "M246 360 C222 350 214 384 220 412 C226 436 244 442 256 434 Z", 5);
  // Hair
  fill(
    g,
    "M330 220 C320 150 260 96 180 104 C150 92 110 100 96 126 L118 132 C78 160 60 220 68 290 L40 300 L76 330 C78 380 96 430 120 470 L96 500 L150 504 C176 526 206 536 236 536 L252 520 C238 470 236 424 246 380 L262 352 C282 330 300 300 318 270 L330 316 L340 262 L366 330 L360 262 L394 300 L368 230 Z",
    INK,
  );
  hairShine(g, [[[130, 210], [180, 168], [244, 160]], [[110, 300], [124, 250]]], 7);
  if (o.headphones) {
    taper(g, [[240, 360], [200, 220], [220, 120], [290, 96]], 20, { a: 0.05, b: 0.3 });
    fill(g, "M196 336 C220 320 268 322 280 350 L282 440 C270 462 220 466 196 446 Z", INK);
    stroke(g, "M214 352 L214 432", PAPER, 4);
  }
  if (o.rim) {
    g.save();
    g.globalAlpha = o.rim;
    g.translate(6, -2);
    stroke(g, PFACE, CRIMSON, 5);
    g.restore();
  }
}

// ------------------------------------------------------------------ bodies

// Hoodie torso under a head (head box coordinates, extends to y 1100).
export function torso(g, { tone: tn = 0.25, dark = false, strings = true } = {}) {
  const d = "M20 1100 C30 860 90 720 200 670 L412 670 C522 720 582 860 592 1100 Z";
  if (dark) fill(g, d, INK);
  else {
    ink(g, d, 7);
    tone(g, d, (x) => clamp(tn + (x > 420 ? 0.25 : 0)), { cell: 9, box: [0, 600, 620, 520] });
    stroke(g, "M150 780 C160 900 150 1000 140 1100 M460 780 C452 900 462 1000 472 1100", INK, 4);
  }
  if (strings && !dark) {
    stroke(g, "M262 690 L252 820", INK, 5);
    stroke(g, "M350 690 L360 820", INK, 5);
  }
}

// Standing figure, hands in pockets (for the final panel). Head box on top;
// the figure ends near y 2230.
export function standing(g, o = {}) {
  const prev = K;
  K = o.pal || MONO;
  try {
    const legs = "M162 1500 L176 2150 L296 2150 L306 1650 L316 2150 L436 2150 L450 1500 Z";
    ink(g, legs, 8, K.jeans);
    tone(g, legs, (x) => (x > 330 ? 0.7 : 0.45), { cell: 10, box: [150, 1450, 320, 720], color: K.jeansDot });
    stroke(g, "M306 1650 L306 1520", INK, 5);
    stroke(g, "M232 1800 L230 1960 M382 1800 L384 1960", INK, 3);
    ink(g, "M120 2180 C116 2140 164 2126 294 2132 C320 2160 320 2214 294 2226 L136 2226 C114 2220 112 2202 120 2180 Z", 7, K.shoe);
    ink(g, "M318 2132 C448 2126 496 2140 492 2180 C500 2202 498 2220 476 2226 L318 2226 C292 2214 292 2160 318 2132 Z", 7, K.shoe);
    stroke(g, "M142 2206 L286 2206 M326 2206 L470 2206", K.color ? K.acc : INK, K.color ? 6 : 3);
    const body = "M66 1560 C60 1180 96 860 170 720 C200 690 230 680 250 680 L362 680 C382 680 412 690 442 720 C516 860 552 1180 546 1560 Z";
    ink(g, body, 8, K.cloth);
    tone(g, body, (x) => (x > 400 ? 0.5 : 0.16), { cell: 10, box: [40, 660, 540, 920], color: K.clothDot });
    stroke(g, "M104 820 C96 1000 108 1180 170 1330 M508 820 C516 1000 504 1180 442 1330", INK, 7);
    stroke(g, "M150 1300 C230 1270 382 1270 462 1300 L450 1440 L162 1440 Z", INK, 6);
    stroke(g, "M70 1500 C220 1530 392 1530 542 1500", INK, 5);
    stroke(g, "M262 700 L250 880 M350 700 L362 880", K.color ? K.acc : INK, 5);
  } finally {
    K = prev;
  }
  head(g, { ...o, collar: "hoodie" });
}
