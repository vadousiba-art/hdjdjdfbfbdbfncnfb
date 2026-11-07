// The founder story, edited in code. Every frame is a pure function of t, drawn
// with Canvas 2D from the cropped photos (photos/cropped), the YORU development
// screenshots (photos/dev) and the timeline in cues.json, which the score reads too.

const W = 1080, H = 1920;
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const C = await (await fetch("/film/cues.json")).json();

const load = (src) => new Promise((ok, no) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => no(new Error(src));
  i.src = src;
});
const IMG = {};
for (let n = 1; n <= 15; n++) {
  const k = `p${String(n).padStart(2, "0")}`;
  IMG[k] = await load(`/photos/cropped/${k}.png`);
}
for (const d of C.dev) IMG[d.img] = await load(`/photos/dev/${d.img}.png`);
const WORDMARK = await load("/film/wordmark.png");
await Promise.all(["700", "800", "900"].map((w) => document.fonts.load(`${w} 60px Inter`)));

// ------------------------------------------------------------------ helpers
const canvas = (w = W, h = H) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ramp = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (k) => k * k * (3 - 2 * k);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeBack = (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
function rnd(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function reset(g) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-over";
  g.globalAlpha = 1;
  g.filter = "none";
  g.shadowColor = "transparent";
  g.shadowBlur = 0;
}

// blurred, darkened cover copies of each picture, for behind the photo and the phone
function blurredCover(img, blur, bright, sat = 1.1, cropTop = 0) {
  const c = canvas(270, 480), g = c.getContext("2d");
  const ih = img.height - cropTop;
  const s = Math.max(270 / img.width, 480 / ih) * 1.35;
  g.filter = `blur(${blur}px) brightness(${bright}) saturate(${sat})`;
  g.drawImage(img, 0, cropTop, img.width, ih, (270 - img.width * s) / 2, (480 - ih * s) / 2, img.width * s, ih * s);
  return c;
}
const BG = {};
for (const k of Object.keys(IMG)) BG[k] = blurredCover(IMG[k], 7, 0.55);

// film grain: four noise tiles, cycled per frame
const GRAIN = [0, 1, 2, 3].map((i) => {
  const c = canvas(540, 960), g = c.getContext("2d");
  const d = g.createImageData(540, 960), r = rnd(91 + i * 7);
  for (let p = 0; p < d.data.length; p += 4) {
    const v = 128 + (r() + r() + r() - 1.5) * 120;
    d.data[p] = d.data[p + 1] = d.data[p + 2] = v;
    d.data[p + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
});
const VIGNETTE = (() => {
  const c = canvas(), g = c.getContext("2d");
  const v = g.createRadialGradient(W / 2, H * 0.46, H * 0.28, W / 2, H * 0.5, H * 0.78);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.62)");
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return c;
})();

const LAYER_A = canvas(), LA = LAYER_A.getContext("2d");
const LAYER_B = canvas(), LB = LAYER_B.getContext("2d");
const PHOTO = canvas(), PH = PHOTO.getContext("2d");
const TMP = canvas(), TM = TMP.getContext("2d");

// ------------------------------------------------------------------ grading
function grade(sh, t) {
  switch (sh.grade) {
    case "warm":
      return { f: "saturate(1.12) sepia(0.14) contrast(1.05) brightness(1.03)", tint: ["#ff9a3c", 0.12] };
    case "warmlow":
      return { f: "saturate(1.15) sepia(0.16) contrast(1.12) brightness(0.86)", tint: ["#ff8a3c", 0.14] };
    case "cool":
      return { f: "saturate(0.55) contrast(1.1) brightness(0.8)", tint: ["#21406e", 0.45] };
    case "mono":
      return { f: "grayscale(1) contrast(1.14) brightness(0.9)" };
    case "night":
      return { f: "grayscale(1) contrast(1.18) brightness(0.7)", tint: ["#14243c", 0.35] };
    case "muted":
      return { f: "saturate(0.42) contrast(1.04) brightness(0.86)", tint: ["#30425a", 0.18] };
    case "faded":
      return { f: "saturate(0.5) sepia(0.18) contrast(0.94) brightness(0.88)", tint: ["#c4664a", 0.16] };
    case "soft":
      return { f: "saturate(1.05) sepia(0.08) contrast(1.03) brightness(1.02)", tint: ["#ffb070", 0.1] };
    case "golden":
      return { f: "saturate(1.3) sepia(0.12) contrast(1.06) brightness(1.06)", tint: ["#ff8a2a", 0.2] };
    case "half": {
      const d = smooth(ramp(t, sh.dim[0], sh.dim[1]));
      return { f: `grayscale(${0.6 + 0.4 * d}) contrast(1.08) brightness(${0.9 * (1 - 0.94 * d)})` };
    }
    case "drain": {
      const k = smooth(ramp(t, sh.drain[0], sh.drain[1]));
      return { f: `grayscale(${k}) saturate(${1.1 - 0.1 * k}) sepia(${0.12 * (1 - k)}) contrast(${1.04 + 0.1 * k}) brightness(${1.02 - 0.12 * k})`, tint: ["#ff9a3c", 0.1 * (1 - k)] };
    }
    case "return": {
      const k = smooth(ramp(t, sh.ret[0], sh.ret[1]));
      return { f: `grayscale(${1 - k}) saturate(${1 + 0.12 * k}) sepia(${0.1 * k}) contrast(1.05) brightness(${0.86 + 0.16 * k})`, tint: ["#ff9a3c", 0.12 * k] };
    }
  }
  return { f: "none" };
}

// ------------------------------------------------------------------ photo geometry
function frameOf(sh, img) {
  if (sh.mode === "fill") return { x: 0, y: 0, w: W, h: H };
  const h = Math.round((W * img.height) / img.width);
  const cy = sh.cy || 860;
  return { x: 0, y: Math.round(cy - h / 2), w: W, h };
}
function zoomAt(sh, t) {
  let z = lerp(sh.z[0], sh.z[1], easeInOut(ramp(t, sh.s, sh.e)));
  let fx = sh.fx, fy = sh.fy;
  if (sh.punch && t >= sh.punch[0]) {  // a jump-cut punch-in
    const [pt, px, py, pz] = sh.punch;
    z = pz * (1 + 0.035 * ramp(t, pt, sh.e));
    fx = px;
    fy = py;
  }
  return { z, fx, fy };
}
// draws img over rect r (cover × z) with image point (fx, fy) at the rect centre, clamped so r stays covered
function drawCover(g, img, r, z, fx, fy) {
  const s = Math.max(r.w / img.width, r.h / img.height) * z;
  const dw = img.width * s, dh = img.height * s;
  const x = clamp(r.x + r.w / 2 - fx * dw, r.x + r.w - dw, r.x);
  const y = clamp(r.y + r.h / 2 - fy * dh, r.y + r.h - dh, r.y);
  g.drawImage(img, x, y, dw, dh);
  return { x, y, dw, dh };
}

// the graded photo, alone on the transparent PHOTO canvas
function photoLayer(sh, t, img, r) {
  const gr = grade(sh, t);
  const { z, fx, fy } = zoomAt(sh, t);
  reset(PH);
  PH.clearRect(0, 0, W, H);
  PH.save();
  PH.beginPath();
  PH.rect(r.x, r.y, r.w, r.h);
  PH.clip();
  let m;
  if (sh.spot) {
    // other people in the picture stay soft; the boys are sharp
    PH.filter = `${gr.f} blur(14px) brightness(0.78)`;
    m = drawCover(PH, img, r, z, fx, fy);
    PH.filter = "none";
    reset(TM);
    TM.clearRect(0, 0, W, H);
    TM.filter = gr.f;
    drawCover(TM, img, r, z, fx, fy);
    TM.filter = "none";
    const [sx, sy, rx, ry] = sh.spot;
    TM.globalCompositeOperation = "destination-in";
    TM.translate(r.x + sx * r.w, r.y + sy * r.h);
    TM.scale(rx * r.w, ry * r.h);
    const g = TM.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, "#000");
    g.addColorStop(0.62, "#000");
    g.addColorStop(1, "rgba(0,0,0,0)");
    TM.fillStyle = g;
    TM.fillRect(-20, -20, 40, 40);
    reset(TM);
    PH.drawImage(TMP, 0, 0);
  } else {
    PH.filter = gr.f;
    m = drawCover(PH, img, r, z, fx, fy);
    PH.filter = "none";
  }
  if (sh.gone) {
    // he fades out of the picture; the boy stays
    const k = smooth(ramp(t, sh.gone[0], sh.gone[1]));
    if (k > 0) {
      reset(TM);
      TM.clearRect(0, 0, W, H);
      TM.filter = `grayscale(1) blur(${2 + 16 * k}px) brightness(${1 - 0.86 * k})`;
      drawCover(TM, img, r, z, fx, fy);
      TM.filter = "none";
      const ex = m.x + sh.goneX * m.dw;
      TM.globalCompositeOperation = "destination-in";
      const lg = TM.createLinearGradient(ex - 90, 0, ex + 140, 0);
      lg.addColorStop(0, "rgba(0,0,0,0)");
      lg.addColorStop(1, `rgba(0,0,0,${0.95 * k})`);
      TM.fillStyle = lg;
      TM.fillRect(0, 0, W, H);
      reset(TM);
      PH.drawImage(TMP, 0, 0);
    }
  }
  if (gr.tint && gr.tint[1] > 0) {
    PH.globalCompositeOperation = "soft-light";
    PH.globalAlpha = gr.tint[1];
    PH.fillStyle = gr.tint[0];
    PH.fillRect(r.x, r.y, r.w, r.h);
  }
  PH.restore();
  reset(PH);
  return m;
}

// ------------------------------------------------------------------ the crack (the divorce)
function crackLine(sh, r) {
  const img = IMG[sh.img];
  const { z, fx, fy } = zoomAt(sh, sh.crack);
  const s = Math.max(r.w / img.width, r.h / img.height) * z;
  const dw = img.width * s;
  const x0 = clamp(r.x + r.w / 2 - fx * dw, r.x + r.w - dw, r.x) + sh.crackX * dw;
  const R = rnd(7), pts = [];
  let x = x0;
  for (let y = r.y - 30; y <= r.y + r.h + 30; y += 26 + R() * 30) {
    x = x0 + (R() - 0.5) * 46 + (R() < 0.18 ? (R() - 0.5) * 70 : 0);
    pts.push([x, y]);
  }
  pts.push([x0 + (R() - 0.5) * 30, r.y + r.h + 60]);
  return pts;
}
function drawCracked(g, sh, t, r) {
  const k = t - sh.crack;
  const pts = crackLine(sh, r);
  const open = easeOut(clamp(k / 1.2));
  const dx = 64 * open + 14 * k, rot = 0.03 * open + 0.004 * k;
  const cx = pts[Math.floor(pts.length / 2)][0], cy = r.y + r.h / 2;
  const piece = (side) => {
    const sx = side < 0 ? -300 : W + 300;
    g.save();
    g.translate(cx + side * dx, cy + (side < 0 ? 10 : 26) * open);
    g.rotate(side * rot);
    g.translate(-cx, -cy);
    g.beginPath();
    g.moveTo(sx, -300);
    g.lineTo(pts[0][0], -300);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(pts[pts.length - 1][0], H + 300);
    g.lineTo(sx, H + 300);
    g.closePath();
    g.clip();
    g.filter = `brightness(${1 - 0.3 * open})`;
    g.drawImage(PHOTO, 0, 0);
    g.restore();
  };
  piece(-1);
  piece(1);
  // shards
  const R = rnd(33);
  for (let j = 0; j < 14; j++) {
    const p = pts[2 + Math.floor(R() * (pts.length - 4))];
    const vx = (R() < 0.5 ? -1 : 1) * (120 + R() * 320), vy = -(80 + R() * 260), w = (R() - 0.5) * 9;
    const sz = 14 + R() * 34;
    const a = 1 - clamp(k / (0.8 + R() * 0.6));
    if (a <= 0) continue;
    g.save();
    g.globalAlpha = a;
    g.translate(p[0] + vx * k, p[1] + vy * k + 900 * k * k);
    g.rotate(w * k);
    g.translate(-p[0], -p[1]);
    g.beginPath();
    g.moveTo(p[0] + (R() - 0.5) * sz, p[1] - sz * R());
    g.lineTo(p[0] + sz * (0.3 + R()), p[1] + (R() - 0.5) * sz);
    g.lineTo(p[0] - sz * (0.3 + R()), p[1] + sz * R());
    g.closePath();
    g.clip();
    g.drawImage(PHOTO, 0, 0);
    g.restore();
  }
  // the crack itself flares for an instant
  if (k < 0.4) {
    g.save();
    g.globalAlpha = 1 - k / 0.4;
    g.strokeStyle = "#fff";
    g.lineWidth = 5;
    g.shadowColor = "rgba(255,255,255,0.9)";
    g.shadowBlur = 30;
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
    g.restore();
  }
}

// ------------------------------------------------------------------ the development montage
const DEVBG = {};
for (const d of C.dev) DEVBG[d.img] = blurredCover(IMG[d.img], 9, 0.45, 1.2, d.cropTop || 0);
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function devScene(g, t) {
  const L = C.dev;
  let i = 0;
  for (let j = 0; j < L.length; j++) if (t >= L[j].s) i = j;
  const cur = L[i], prev = L[i - 1];
  const ks = prev ? easeInOut(ramp(t, cur.s, cur.s + 0.42)) : 1;
  // background: the screen itself, blurred, with a low red glow
  g.drawImage(DEVBG[cur.img], -60, -60, W + 120, H + 120);
  if (prev && ks < 1) {
    g.globalAlpha = 1 - ks;
    g.drawImage(DEVBG[prev.img], -60, -60, W + 120, H + 120);
    g.globalAlpha = 1;
  }
  g.fillStyle = "rgba(4,4,8,0.5)";
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 1180, 40, W / 2, 1180, 820);
  glow.addColorStop(0, "rgba(225,29,72,0.22)");
  glow.addColorStop(1, "rgba(225,29,72,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  // phone
  const k0 = easeOut(ramp(t, L[0].s, L[0].s + 0.7));
  const pw = 540, phh = Math.round(pw * 2.1667);
  const px = (W - pw) / 2, py = 548 + 50 * (1 - k0) + 5 * Math.sin(t * 1.3);
  const bz = 14, sx = px + bz, sy = py + bz, sw = pw - 2 * bz, shh = phh - 2 * bz;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.7)";
  g.shadowBlur = 80;
  g.shadowOffsetY = 30;
  g.fillStyle = "#08080a";
  roundRect(g, px, py, pw, phh, 66);
  g.fill();
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.16)";
  g.lineWidth = 2;
  roundRect(g, px + 1, py + 1, pw - 2, phh - 2, 65);
  g.stroke();
  g.save();
  roundRect(g, sx, sy, sw, shh, 54);
  g.clip();
  g.fillStyle = "#070707";
  g.fillRect(sx, sy, sw, shh);
  const screen = (d, off) => {
    const img = IMG[d.img], top = d.cropTop || 0, ih = img.height - top;
    const s = Math.max(sw / img.width, shh / ih);
    g.drawImage(img, 0, top, img.width, ih, sx + (sw - img.width * s) / 2, sy + off, img.width * s, ih * s);
  };
  if (prev && ks < 1) {
    screen(prev, -ks * shh * 0.3);
    g.fillStyle = `rgba(0,0,0,${0.5 * ks})`;
    g.fillRect(sx, sy, sw, shh);
    g.shadowColor = "rgba(0,0,0,0.6)";
    g.shadowBlur = 40;
    screen(cur, (1 - ks) * shh);
    g.shadowBlur = 0;
  } else screen(cur, 0);
  g.restore();
  g.fillStyle = "#000";
  roundRect(g, W / 2 - 62, sy + 16, 124, 34, 17);
  g.fill();

  // where it was: a small label and three dots
  const tags = ["the beginning", "getting there", "today"];
  const ti = tags.indexOf(cur.tag);
  const tagStart = L.find((d) => d.tag === cur.tag).s;
  const ka = i === 0 ? easeOut(ramp(t, tagStart + 0.15, tagStart + 0.5)) : easeOut(ramp(t, tagStart, tagStart + 0.3));
  g.save();
  g.font = "700 32px Inter";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const tw = g.measureText(cur.tag).width + 64;
  g.globalAlpha = ka;
  g.fillStyle = "rgba(255,255,255,0.1)";
  roundRect(g, W / 2 - tw / 2, 238 + 10 * (1 - ka), tw, 58, 29);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.28)";
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = "#fff";
  g.fillText(cur.tag, W / 2, 268 + 10 * (1 - ka));
  g.globalAlpha = Math.min(1, k0);
  for (let j = 0; j < 3; j++) {
    g.fillStyle = j <= ti ? "#e11d48" : "rgba(255,255,255,0.25)";
    g.beginPath();
    g.arc(W / 2 + (j - 1) * 30, 322, j === ti ? 7 : 5, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// ------------------------------------------------------------------ black frames
function dawn(g, t, sh) {
  // after the dark: a warm light starts to come up from below
  const k = smooth(ramp(t, sh.s, sh.e + 0.5));
  const gg = g.createRadialGradient(W / 2, H + 260, 60, W / 2, H + 260, 700 + 900 * k);
  gg.addColorStop(0, `rgba(255,160,90,${0.42 * k})`);
  gg.addColorStop(0.5, `rgba(255,110,60,${0.16 * k})`);
  gg.addColorStop(1, "rgba(255,110,60,0)");
  g.fillStyle = gg;
  g.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ one shot into a layer
function renderShot(g, sh, t) {
  reset(g);
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  if (sh.black) {
    if (sh.dawn) dawn(g, t, sh);
    return;
  }
  if (sh.dev) {
    devScene(g, t);
    reset(g);
    return;
  }
  const img = IMG[sh.img];
  const r = frameOf(sh, img);
  if (sh.mode === "fit") {
    const gr = grade(sh, t);
    const d = 1.08 + 0.05 * ramp(t, sh.s, sh.e);
    g.filter = gr.f;
    g.drawImage(BG[sh.img], W / 2 - (W * d) / 2, H / 2 - (H * d) / 2, W * d, H * d);
    g.filter = "none";
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(0, 0, W, H);
    g.save();
    g.shadowColor = "rgba(0,0,0,0.75)";
    g.shadowBlur = 70;
    g.fillStyle = "#000";
    g.fillRect(r.x, r.y, r.w, r.h);
    g.restore();
  }
  photoLayer(sh, t, img, r);
  if (sh.crack != null && t >= sh.crack) drawCracked(g, sh, t, r);
  else g.drawImage(PHOTO, 0, 0);
  reset(g);
}

// ------------------------------------------------------------------ overlays
function leaks(t, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const blobs = [[0.05, 0.12, "255,140,60"], [1.0, 0.36, "255,92,48"], [0.85, 0.92, "255,186,96"]];
  blobs.forEach(([bx, by, c], i) => {
    const x = W * (bx + 0.12 * Math.sin(t * 0.33 + i * 2.1));
    const y = H * (by + 0.07 * Math.cos(t * 0.27 + i * 1.3));
    const rr = 640 + 160 * Math.sin(t * 0.5 + i);
    const p = 0.75 + 0.25 * Math.sin(t * 0.9 + i * 2.7);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, `rgba(${c},${0.3 * a * p})`);
    g.addColorStop(0.5, `rgba(${c},${0.1 * a * p})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });
  ctx.restore();
}
function grain(t, a) {
  const f = Math.round(t * C.fps);
  const tile = GRAIN[f % 4];
  const R = rnd(f * 13 + 5);
  const ox = -Math.floor(R() * 540), oy = -Math.floor(R() * 960);
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = a;
  for (let x = ox; x < W; x += 540) for (let y = oy; y < H; y += 960) ctx.drawImage(tile, x, y);
  ctx.restore();
}
function shake(t) {
  let x = 0, y = 0, rot = 0;
  for (const [t0, amp, d] of C.shakes) {
    if (t < t0) continue;
    const e = amp * Math.exp(-(t - t0) / d);
    x += e * Math.sin((t - t0) * 61);
    y += e * Math.cos((t - t0) * 47);
    rot += (e / 2400) * Math.sin((t - t0) * 37);
  }
  // a breath of handheld drift on everything
  x += 2.2 * Math.sin(t * 0.71);
  y += 2.6 * Math.sin(t * 0.53 + 1);
  rot += 0.0012 * Math.sin(t * 0.41);
  return { x, y, rot };
}

function wrap(g, text, maxW) {
  const words = text.split(" "), lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  return lines;
}
function caption(t, [text, t0, t1, o = {}]) {
  if (t < t0 || t > t1) return;
  const size = o.size || 58, y = o.y || 1400, weight = o.weight || 800;
  const a = Math.min(1, (t - t0) / 0.08) * Math.min(1, (t1 - t) / 0.14);
  const s = 0.86 + 0.14 * easeBack(clamp((t - t0) / 0.22));
  ctx.save();
  ctx.font = `${weight} ${size}px Inter`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrap(ctx, text, o.maxW || 930);
  const lh = size * 1.2;
  // a soft shade behind the words, so they read on any picture
  const band = ctx.createRadialGradient(W / 2, y, 10, W / 2, y, 560);
  band.addColorStop(0, `rgba(0,0,0,${0.3 * a})`);
  band.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, y - 400, W, 800);
  ctx.translate(W / 2, y);
  ctx.scale(s, s);
  ctx.globalAlpha = a;
  lines.forEach((ln, i) => {
    const ly = (i - (lines.length - 1) / 2) * lh;
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = Math.max(4, size * 0.07);
    ctx.strokeText(ln, 0, ly);
    ctx.shadowColor = o.glow ? "rgba(255,190,120,0.9)" : "transparent";
    ctx.shadowBlur = o.glow ? 50 : 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = "#fff";
    ctx.fillText(ln, 0, ly);
  });
  ctx.restore();
}

// ------------------------------------------------------------------ the frame
const SH = C.shots;
function shotAt(t) {
  for (let i = SH.length - 1; i >= 0; i--) if (t >= SH[i].s) return i;
  return 0;
}

window.renderFrame = async (t) => {
  const i = shotAt(t), sh = SH[i];
  renderShot(LA, sh, t);
  reset(ctx);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const sk = shake(t);
  ctx.save();
  ctx.translate(W / 2 + sk.x, H / 2 + sk.y);
  ctx.rotate(sk.rot);
  ctx.scale(1.012, 1.012);  // a hair of overscan so the shake never shows an edge
  ctx.translate(-W / 2, -H / 2);
  const [kind, d] = sh.in || ["cut", 0];
  const k = d ? clamp((t - sh.s) / d) : 1;
  if (k < 1 && i > 0 && (kind === "fade" || kind === "black")) {
    renderShot(LB, SH[i - 1], t);
    if (kind === "fade") {
      ctx.drawImage(LAYER_B, 0, 0);
      ctx.globalAlpha = smooth(k);
      ctx.drawImage(LAYER_A, 0, 0);
    } else {
      ctx.globalAlpha = clamp(1 - 2 * k);
      ctx.drawImage(LAYER_B, 0, 0);
      ctx.globalAlpha = clamp(2 * k - 1);
      ctx.drawImage(LAYER_A, 0, 0);
    }
    ctx.globalAlpha = 1;
  } else if (k < 1 && kind === "punch") {
    const z = 1 + 0.07 * (1 - easeOut(k));
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(LAYER_A, 0, 0);
  } else ctx.drawImage(LAYER_A, 0, 0);
  ctx.restore();

  // light leaks on the warm shots (eased across cuts)
  const prev = SH[i - 1];
  const lk = lerp(prev && kind === "fade" ? prev.leak || 0 : sh.leak || 0, sh.leak || 0, k);
  leaks(t, lk);
  ctx.drawImage(VIGNETTE, 0, 0);
  const cold = ["mono", "night", "half", "drain"].includes(sh.grade) || sh.black;
  grain(t, cold ? 0.16 : 0.1);
  for (const [t0, a, dd] of C.flashes) {
    if (t < t0 - 0.03 || t > t0 + dd * 4) continue;
    const e = t < t0 ? (t - t0 + 0.03) / 0.03 : Math.exp(-(t - t0) / dd);
    ctx.fillStyle = `rgba(255,252,246,${a * clamp(e)})`;
    ctx.fillRect(0, 0, W, H);
  }
  for (const c of C.captions) caption(t, c);
  if (t >= C.wordmark[0]) {
    const a = 0.62 * easeOut(ramp(t, C.wordmark[0], C.wordmark[0] + 1.0));
    const ww = 236, wh = (ww * WORDMARK.height) / WORDMARK.width;
    ctx.globalAlpha = a;
    ctx.drawImage(WORDMARK, W / 2 - ww / 2, 1560 - wh / 2, ww, wh);
    ctx.globalAlpha = 1;
  }
  const out = ramp(t, C.duration - 0.6, C.duration);
  if (out > 0) {
    ctx.fillStyle = `rgba(0,0,0,${smooth(out)})`;
    ctx.fillRect(0, 0, W, H);
  }
};
window.renderCover = () => window.renderFrame(3.4);
window.ready = true;
