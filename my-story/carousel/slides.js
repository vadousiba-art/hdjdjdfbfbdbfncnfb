// The story as carousel slides (1080x1440, like a photo-mode post) and as a
// 1080x1920 video of the same slides: full-bleed pictures with stacked white
// caption boxes. Slides, text and timing come from slides.json.

// ?set=slides-part2 picks another story; slides.json is the default
const SET = new URLSearchParams(location.search).get("set") || "slides";
const D = await (await fetch(`/carousel/${SET}.json`)).json();
const S = D.slides;
const BEAT = 60 / D.bpm;
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");

const load = (src) => new Promise((ok, no) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => no(new Error(src));
  i.src = src;
});
const src = (bg) => (bg.includes("/") ? `/photos/${bg}` : `/photos/cropped/${bg}.png`);
const clipFrame = (name, n) => `/photos/clips/${name}/${String(n).padStart(4, "0")}.jpg`;
const IMG = {};
for (const s of S) {
  if (s.bg) IMG[s.bg] = await load(src(s.bg));
  if (s.clip) IMG[`${s.clip}#still`] = await load(clipFrame(s.clip, s.still));
  if (s.dev) for (const d of s.dev) IMG[d] = await load(`/photos/dev/${d}.png`);
}
const CLIPLEN = {};
for (const s of S) {
  if (!s.clip) continue;
  let n = 1;
  while ((await fetch(clipFrame(s.clip, n + 1), { method: "HEAD" })).ok) n++;
  CLIPLEN[s.clip] = n;
}
await Promise.all(["600", "700"].map((w) => document.fonts.load(`${w} 50px Inter`)));
await document.fonts.load("italic 600 50px Inter");

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const mk = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
function rnd(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ------------------------------------------------------------------ pictures
const GRADE = {
  none: "contrast(1.03) saturate(1.04)",
  mono: "grayscale(1) contrast(1.1) brightness(0.92)",
  dark: "grayscale(0.85) contrast(1.12) brightness(0.72)",
  muted: "saturate(0.45) contrast(1.04) brightness(0.88)",
  faded: "saturate(0.55) sepia(0.15) contrast(0.96) brightness(0.9)",
  golden: "saturate(1.25) sepia(0.1) contrast(1.05) brightness(1.04)",
};
// draw img over rect r (cover × z) with image point (fx, fy) at the rect centre, clamped to stay covered
function cover(g, img, r, z, fx, fy) {
  const s = Math.max(r.w / img.width, r.h / img.height) * z;
  const dw = img.width * s, dh = img.height * s;
  const x = clamp(r.x + r.w / 2 - fx * dw, r.x + r.w - dw, r.x);
  const y = clamp(r.y + r.h / 2 - fy * dh, r.y + r.h - dh, r.y);
  g.drawImage(img, x, y, dw, dh);
  return { x, y, dw, dh };
}
const TMP = mk(1080, 1920), TM = TMP.getContext("2d");
function softRegion(g, img, m, [rx, ry, rw, rh], filter) {
  // redraw part of the picture blurred (people who aren't part of the story)
  g.save();
  g.beginPath();
  g.ellipse(m.x + (rx + rw / 2) * m.dw, m.y + (ry + rh / 2) * m.dh, (rw / 2) * m.dw, (rh / 2) * m.dh, 0, 0, Math.PI * 2);
  g.clip();
  g.filter = `${filter} blur(22px)`;
  g.drawImage(img, m.x, m.y, m.dw, m.dh);
  g.restore();
}
function picture(g, W, H, s, img, z) {
  const f = GRADE[s.grade || "none"];
  if (s.mode === "fit") {
    // the photo at full width, a blurred copy of it behind
    g.filter = `${f} blur(36px) brightness(0.5)`;
    cover(g, img, { x: -80, y: -80, w: W + 160, h: H + 160 }, 1.1, 0.5, 0.5);
    g.filter = "none";
    const h = Math.round((W * img.height) / img.width);
    const r = { x: 0, y: Math.round(H * (H > 1500 ? 0.33 : 0.3) - h / 2), w: W, h };
    g.save();
    g.shadowColor = "rgba(0,0,0,0.6)";
    g.shadowBlur = 50;
    g.fillStyle = "#000";
    g.fillRect(r.x, r.y, r.w, r.h);
    g.restore();
    g.save();
    g.beginPath();
    g.rect(r.x, r.y, r.w, r.h);
    g.clip();
    if (s.spot) {
      g.filter = `${f} blur(14px) brightness(0.8)`;
      cover(g, img, r, z, s.fx, s.fy);
      TM.setTransform(1, 0, 0, 1, 0, 0);
      TM.globalCompositeOperation = "source-over";
      TM.clearRect(0, 0, TMP.width, TMP.height);
      TM.filter = f;
      cover(TM, img, r, z, s.fx, s.fy);
      TM.filter = "none";
      const [sx, sy, rx, ry] = s.spot;
      TM.globalCompositeOperation = "destination-in";
      TM.translate(r.x + sx * r.w, r.y + sy * r.h);
      TM.scale(rx * r.w, ry * r.h);
      const gg = TM.createRadialGradient(0, 0, 0, 0, 0, 1);
      gg.addColorStop(0, "#000");
      gg.addColorStop(0.62, "#000");
      gg.addColorStop(1, "rgba(0,0,0,0)");
      TM.fillStyle = gg;
      TM.fillRect(-20, -20, 40, 40);
      TM.setTransform(1, 0, 0, 1, 0, 0);
      TM.globalCompositeOperation = "source-over";
      g.filter = "none";
      g.drawImage(TMP, 0, 0);
    } else {
      g.filter = f;
      const m = cover(g, img, r, z, s.fx, s.fy);
      g.filter = "none";
      if (s.gone) {
        // his side of the photo fades into the dark
        const ex = m.x + s.gone * m.dw;
        const lg = g.createLinearGradient(ex - 90, 0, ex + 150, 0);
        lg.addColorStop(0, "rgba(6,8,12,0)");
        lg.addColorStop(1, "rgba(6,8,12,0.86)");
        g.fillStyle = lg;
        g.fillRect(r.x, r.y, r.w, r.h);
      }
    }
    g.restore();
    return;
  }
  g.filter = f;
  const m = cover(g, img, { x: 0, y: 0, w: W, h: H }, z, s.fx, s.fy);
  g.filter = "none";
  for (const b of s.blur || []) softRegion(g, img, m, b, f);
}

function devSlide(g, W, H, s, k) {
  g.save();
  const a = IMG[s.dev[1]];
  g.filter = "blur(40px) brightness(0.4) saturate(1.2)";
  cover(g, a, { x: -80, y: -80, w: W + 160, h: H + 160 }, 1.2, 0.5, 0.3);
  g.filter = "none";
  const glow = g.createRadialGradient(W / 2, H * 0.3, 20, W / 2, H * 0.3, W * 0.8);
  glow.addColorStop(0, "rgba(225,29,72,0.25)");
  glow.addColorStop(1, "rgba(225,29,72,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  const ph = H > 1500 ? 800 : 620, pw = Math.round(ph / 2.1667), gap = 70;
  const top = H > 1500 ? 200 : 110;
  s.dev.forEach((d, i) => {
    const img = IMG[d];
    const x = W / 2 + (i ? gap / 2 : -gap / 2 - pw);
    const y = top + 46 + (i ? 0 : 26) + 10 * (1 - easeOut(clamp(k * 3 - i * 0.4)));
    g.save();
    g.shadowColor = "rgba(0,0,0,0.65)";
    g.shadowBlur = 50;
    g.shadowOffsetY = 18;
    g.fillStyle = "#0a0a0c";
    g.beginPath();
    g.roundRect(x - 9, y - 9, pw + 18, ph + 18, 44);
    g.fill();
    g.restore();
    g.save();
    g.beginPath();
    g.roundRect(x, y, pw, ph, 36);
    g.clip();
    const sc = pw / img.width;
    g.drawImage(img, x, y, pw, img.height * sc);
    g.restore();
    g.font = "600 30px Inter";
    g.textAlign = "center";
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.fillText(s.labels[i], x + pw / 2, y - 26);
  });
  g.restore();
}

// ------------------------------------------------------------------ caption boxes
const SIZE = { head: 54, body: 44 };
function tokens(text) {
  // *word* is set in italic
  const out = [];
  let it = false;
  for (const raw of text.split(" ")) {
    let w = raw;
    const open = w.startsWith("*"), close = w.replace(/[.,!?:]+$/, "").endsWith("*");
    if (open) it = true;
    w = w.replace(/\*/g, "");
    out.push({ w, it });
    if (close) it = false;
  }
  return out;
}
function font(size, it) {
  return `${it ? "italic " : ""}600 ${size}px Inter`;
}
function layoutBlock(g, text, size, maxW) {
  const lines = [[]];
  let wsum = 0;
  g.font = font(size, false);
  const space = g.measureText(" ").width;
  for (const t of tokens(text)) {
    g.font = font(size, t.it);
    const w = g.measureText(t.w).width;
    const cur = lines[lines.length - 1];
    if (cur.length && wsum + space + w > maxW) {
      lines.push([]);
      wsum = 0;
    }
    const line = lines[lines.length - 1];
    if (line.length) wsum += space;
    line.push({ ...t, x: wsum, width: w });
    wsum += w;
  }
  return lines.map((l) => ({ words: l, width: l.length ? l[l.length - 1].x + l[l.length - 1].width : 0 }));
}
const PAD = 15, LEFT = 106, MAXW = 838, GAP = 34;
function layout(g, blocks, H) {
  const out = blocks.map((b, i) => {
    const size = i === 0 ? SIZE.head : SIZE.body;
    const lines = layoutBlock(g, b, size, MAXW);
    const lh = Math.round(size * 1.3);
    return { size, lines, lh, h: lines.length * lh };
  });
  const total = out.reduce((a, b) => a + b.h, 0) + GAP * (out.length - 1);
  const pref = H > 1500 ? 1010 : 790, maxBottom = H > 1500 ? 1560 : 1352;
  let y = Math.min(pref, maxBottom - total);
  for (const b of out) {
    b.y = y;
    y += b.h + GAP;
  }
  return out;
}
function drawBlock(g, b, a = 1, pop = 1) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  const cy = b.y + b.h / 2;
  g.translate(LEFT, cy);
  g.scale(pop, pop);
  g.translate(-LEFT, -cy);
  b.lines.forEach((l, i) => {
    const y = b.y + i * b.lh;
    g.fillStyle = "#fff";
    g.beginPath();
    g.roundRect(LEFT - PAD, y, l.width + PAD * 2, b.lh + 1, 5);
    g.fill();
  });
  g.fillStyle = "#121212";
  g.textAlign = "left";
  g.textBaseline = "middle";
  b.lines.forEach((l, i) => {
    const y = b.y + i * b.lh + b.lh / 2 + b.size * 0.03;
    for (const w of l.words) {
      g.font = font(b.size, w.it);
      g.fillText(w.w, LEFT + w.x, y);
    }
  });
  g.restore();
}

// ------------------------------------------------------------------ grain
const GRAIN = [0, 1, 2].map((i) => {
  const c = mk(540, 720), g = c.getContext("2d");
  const d = g.createImageData(540, 720), r = rnd(17 + i * 31);
  for (let p = 0; p < d.data.length; p += 4) {
    const v = 128 + (r() + r() + r() - 1.5) * 100;
    d.data[p] = d.data[p + 1] = d.data[p + 2] = v;
    d.data[p + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
});
function grain(g, W, H, n, a) {
  g.save();
  g.globalCompositeOperation = "overlay";
  g.globalAlpha = a;
  const R = rnd(n * 7 + 3), ox = -Math.floor(R() * 540), oy = -Math.floor(R() * 720);
  for (let x = ox; x < W; x += 540) for (let y = oy; y < H; y += 720) g.drawImage(GRAIN[n % 3], x, y);
  g.restore();
}

// ------------------------------------------------------------------ one slide
async function slideImage(s, local) {
  if (!s.clip) return IMG[s.bg];
  const n = CLIPLEN[s.clip];
  if (local == null) return IMG[`${s.clip}#still`];
  // ping-pong through the clip so it never jumps
  const f = Math.floor(local * 30) % (2 * n - 2);
  const idx = 1 + (f < n ? f : 2 * n - 2 - f);
  return load(clipFrame(s.clip, idx));
}
async function drawSlide(g, W, H, i, local, dur) {
  const s = S[i];
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.filter = "none";
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  const k = local == null ? 1 : clamp(local / dur);
  if (s.dev) devSlide(g, W, H, s, local == null ? 1 : k);
  else {
    const img = await slideImage(s, local);
    const z = (s.z || 1) * (local == null ? 1 : lerp(1.0, 1.06, easeInOut(k)));
    picture(g, W, H, s, img, z);
  }
  // a soft shade under the captions, like a phone photo with text on it
  const L = layout(g, s.blocks, H);
  const top = L[0].y - 120, bot = L[L.length - 1].y + L[L.length - 1].h + 80;
  const sh = g.createLinearGradient(0, top, 0, bot);
  sh.addColorStop(0, "rgba(0,0,0,0)");
  sh.addColorStop(0.5, "rgba(0,0,0,0.16)");
  sh.addColorStop(1, "rgba(0,0,0,0.2)");
  g.fillStyle = sh;
  g.fillRect(0, top, W, H - top);
  return L;
}

// carousel: one slide, everything on it
window.renderSlide = async (i) => {
  cv.width = 1080;
  cv.height = 1440;
  const L = await drawSlide(ctx, 1080, 1440, i, null, 1);
  grain(ctx, 1080, 1440, i, 0.06);
  for (const b of L) drawBlock(ctx, b);
};
window.slideCount = S.length;

// video: the slides one after another, swiped like a carousel, captions arriving one by one
const START = [];
let acc = 0;
for (const s of S) {
  START.push(acc);
  acc += s.beats * BEAT;
}
window.duration = acc;
const SWIPE = 0.32;
const A = mk(1080, 1920), AG = A.getContext("2d");
const B = mk(1080, 1920), BG = B.getContext("2d");
async function videoSlide(g, i, t) {
  const s = S[i], local = t - START[i], dur = s.beats * BEAT;
  const L = await drawSlide(g, 1080, 1920, i, local, dur);
  grain(g, 1080, 1920, Math.round(t * 30), 0.07);
  L.forEach((b, j) => {
    const at = 0.18 + j * 0.62;
    const kk = clamp((local - at) / 0.16);
    drawBlock(g, b, kk, 0.94 + 0.06 * easeOut(kk));
  });
}
window.renderFrame = async (t) => {
  cv.width = 1080;
  cv.height = 1920;
  let i = 0;
  for (let j = 0; j < S.length; j++) if (t >= START[j]) i = j;
  const k = i > 0 ? clamp((t - START[i]) / SWIPE) : 1;
  await videoSlide(AG, i, t);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 1080, 1920);
  if (k < 1) {
    // swipe: the old slide leaves to the left, the new one comes in from the right
    await videoSlide(BG, i - 1, t);
    const e = easeInOut(k);
    ctx.drawImage(B, -1080 * e, 0);
    ctx.drawImage(A, 1080 * (1 - e), 0);
  } else ctx.drawImage(A, 0, 0);
  const end = clamp((t - (window.duration - 0.7)) / 0.7);
  if (end > 0) {
    ctx.fillStyle = `rgba(0,0,0,${end})`;
    ctx.fillRect(0, 0, 1080, 1920);
  }
};
window.timeline = START.map((s, i) => ({ i, s, beats: S[i].beats }));
window.ready = true;
