// The talking-head reel, drawn from reel/edit.json: graded face footage with
// punch-ins on every cut, B-roll over the lines (callback flashes, the app on a
// phone, the code, family photos), captions in the series' white boxes, the
// hook title, and an end card. Every frame is a function of t.

const W = 1080, H = 1920;
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const E = await (await fetch("/reel/edit.json")).json();
const EXPO = await (await fetch("/reel/exposure.json")).json();  // per-frame brightness gains (reel/exposure.py)

const load = (src) => new Promise((ok, no) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => no(new Error(src));
  i.src = src;
});
const imgSrc = (name) => {
  if (name.startsWith("vscode")) return `/photos/part3/broll/${name}.png`;
  if (/^d\d-/.test(name)) return `/photos/dev/${name}.png`;
  if (name.includes("/")) return `/photos/${name}`;
  return `/photos/cropped/${name}.png`;
};
const IMG = {};
for (const b of E.timeline) for (const it of b.broll) if (it.img && !IMG[it.img]) IMG[it.img] = await load(imgSrc(it.img));
const WORDMARK = await load("/film/wordmark.png");
await Promise.all(["600", "700", "800"].map((w) => document.fonts.load(`${w} 50px Inter`)));
await document.fonts.load("italic 600 50px Inter");

const frameUrl = (src, n) => `/photos/part3/frames/${src}/${String(n).padStart(4, "0")}.jpg`;
const FRAMES = {};
for (const b of E.timeline) {
  if (b.kind !== "face" || FRAMES[b.src]) continue;
  let n = 1, step = 256;
  while (step >= 1) {  // find the last frame by galloping, then halving
    if ((await fetch(frameUrl(b.src, n + step), { method: "HEAD" })).ok) n += step;
    else step >>= 1;
  }
  FRAMES[b.src] = n;
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const mk = (w = W, h = H) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};
function cover(g, img, z, fx, fy, w = W, h = H, x0 = 0, y0 = 0) {
  const s = Math.max(w / img.width, h / img.height) * z;
  const dw = img.width * s, dh = img.height * s;
  const x = clamp(x0 + w / 2 - fx * dw, x0 + w - dw, x0);
  const y = clamp(y0 + h / 2 - fy * dh, y0 + h - dh, y0);
  g.drawImage(img, x, y, dw, dh);
}
const VIGNETTE = (() => {
  const c = mk(), g = c.getContext("2d");
  const v = g.createRadialGradient(W / 2, H * 0.42, H * 0.3, W / 2, H * 0.5, H * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  g.fillStyle = v;
  g.fillRect(0, 0, W, H);
  return c;
})();

// ------------------------------------------------------------------ face footage
async function face(g, b, t) {
  let p = b.pieces[0];
  for (const q of b.pieces) if (t >= q.at) p = q;
  const srcT = p.in + (t - p.at);
  const n = clamp(Math.round(srcT * 30) + 1, 1, FRAMES[b.src]);
  const img = await load(frameUrl(b.src, n));
  const close = b.look.close;
  const k = clamp((t - p.at) / Math.max(0.5, p.out - p.in));
  const z = (p.punch ? 1.12 : 1.0) * (close ? 1.0 : 1.02) + 0.025 * k;
  let mono = 0;
  if (b.look.mono_until_word != null) {
    const turn = E.captions.find((c) => c.text.startsWith("now i'm doing it")).s;
    mono = 1 - clamp((t - turn + 0.1) / 0.5);
  }
  const gain = EXPO[b.src]?.[n - 1] ?? 1;
  g.filter = `brightness(${gain})` + (mono > 0 ? ` grayscale(${mono}) contrast(${1 + 0.1 * mono})` : "");
  cover(g, img, z, 0.5, 0.4);
  g.filter = "none";
}

// ------------------------------------------------------------------ B-roll
function flash(g, it, t) {
  const k = clamp((t - it.at) / Math.max(0.3, it.until - it.at));
  g.filter = it.grade === "mono" ? "grayscale(1) contrast(1.1) brightness(0.9)" : "saturate(1.05) contrast(1.04)";
  cover(g, IMG[it.img], 1.04 + 0.06 * k, it.fx ?? 0.5, it.fy ?? 0.5);
  g.filter = "none";
  const f = clamp(1 - (t - it.at) / 0.12);
  if (f > 0) {
    g.fillStyle = `rgba(255,255,255,${0.7 * f})`;
    g.fillRect(0, 0, W, H);
  }
}

const PHONE = { w: 600, h: Math.round(600 * 2.1667) };
function phoneBack(g, img, t) {
  g.filter = "blur(40px) brightness(0.4) saturate(1.2)";
  cover(g, img, 1.25, 0.5, 0.3);
  g.filter = "none";
  const glow = g.createRadialGradient(W / 2, H * 0.45, 30, W / 2, H * 0.45, W * 0.85);
  glow.addColorStop(0, "rgba(225,29,72,0.22)");
  glow.addColorStop(1, "rgba(225,29,72,0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
}
function phone(g, it, prev, t) {
  const img = IMG[it.img];
  phoneBack(g, img, t);
  const px = (W - PHONE.w) / 2, py = 300 + 6 * Math.sin(t * 1.4);
  const sx = px + 14, sy = py + 14, sw = PHONE.w - 28, sh = PHONE.h - 28;
  g.save();
  g.shadowColor = "rgba(0,0,0,0.7)";
  g.shadowBlur = 80;
  g.shadowOffsetY = 30;
  g.fillStyle = "#08080a";
  g.beginPath();
  g.roundRect(px, py, PHONE.w, PHONE.h, 72);
  g.fill();
  g.restore();
  g.strokeStyle = "rgba(255,255,255,0.16)";
  g.lineWidth = 2;
  g.beginPath();
  g.roundRect(px + 1, py + 1, PHONE.w - 2, PHONE.h - 2, 71);
  g.stroke();
  const draw = (im, d, off) => {
    const top = d.cropTop || 0, ih = im.height - top;
    const s = Math.max(sw / im.width, sh / ih);
    const dh = ih * s;
    const fy = d.focus ?? 0;  // scroll the screen to a point of interest
    const scroll = (dh - sh) * fy * easeOut(clamp((t - d.at) / 0.9));
    g.drawImage(im, 0, top, im.width, ih, sx + (sw - im.width * s) / 2, sy + off - scroll, im.width * s, dh);
  };
  g.save();
  g.beginPath();
  g.roundRect(sx, sy, sw, sh, 58);
  g.clip();
  g.fillStyle = "#070707";
  g.fillRect(sx, sy, sw, sh);
  const ks = easeInOut(clamp((t - it.at) / 0.32));
  if (prev && ks < 1) {
    draw(IMG[prev.img], prev, -ks * sh * 0.3);
    g.fillStyle = `rgba(0,0,0,${0.5 * ks})`;
    g.fillRect(sx, sy, sw, sh);
    draw(img, it, (1 - ks) * sh);
  } else draw(img, it, 0);
  g.restore();
  g.fillStyle = "#000";
  g.beginPath();
  g.roundRect(W / 2 - 66, sy + 18, 132, 36, 18);
  g.fill();
  if (it.label) {
    const la = easeOut(clamp((t - it.at) / 0.25));
    g.save();
    g.globalAlpha = la;
    g.font = "700 34px Inter";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const tw = g.measureText(it.label).width + 64;
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.beginPath();
    g.roundRect(W / 2 - tw / 2, 196, tw, 62, 31);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.3)";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = "#fff";
    g.fillText(it.label, W / 2, 228);
    g.restore();
  }
}

function code(g, it, t) {
  const img = IMG[it.img];
  const k = clamp((t - it.at) / Math.max(0.5, it.until - it.at));
  g.fillStyle = "#1f1f1f";
  g.fillRect(0, 0, W, H);
  if (it.zoom === "wide") {
    // the whole editor, filling the height, drifting from the file tree to the code
    cover(g, img, 1.0 + 0.04 * k, lerp(0.3, 0.5, easeInOut(k)), 0.45);
  } else {
    cover(g, img, 1.45 + 0.05 * k, 0.56, lerp(0.3, 0.42, easeInOut(k)));
  }
  if (it.glitch) {
    const gk = clamp(1 - (t - it.at) / 0.6);
    if (gk > 0) {
      // rgb split and torn rows for the first moments
      g.globalCompositeOperation = "screen";
      g.globalAlpha = 0.5 * gk;
      g.filter = "hue-rotate(-60deg)";
      g.drawImage(g.canvas, 14 * gk, 0);
      g.filter = "none";
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      const R = (s) => (Math.sin(s * 91.7 + Math.floor(t * 30) * 13.1) * 43758.5453) % 1;
      for (let i = 0; i < 9; i++) {
        const y = Math.abs(R(i)) * H, hh = 20 + Math.abs(R(i + 9)) * 70, dx = (R(i + 4)) * 80 * gk;
        g.drawImage(g.canvas, 0, y, W, hh, dx, y, W, hh);
      }
      g.fillStyle = `rgba(241,76,76,${0.18 * gk})`;
      g.fillRect(0, 0, W, H);
    }
  }
  // soft edges so the screen sits in the dark
  g.drawImage(VIGNETTE, 0, 0);
}

function photo(g, it, prev, t) {
  const draw = (p, a) => {
    const k = clamp((t - p.at) / Math.max(0.8, p.until - p.at + 0.4));
    g.globalAlpha = a;
    g.filter = "saturate(1.08) sepia(0.08) contrast(1.03)";
    cover(g, IMG[p.img], (p.z || 1.0) * (1.03 + 0.06 * k), p.fx ?? 0.5, p.fy ?? 0.5);
    g.filter = "none";
    g.globalAlpha = 1;
  };
  const kf = clamp((t - it.at) / 0.3);
  if (prev && kf < 1) {
    draw(prev, 1);
    draw(it, easeInOut(kf));
  } else draw(it, 1);
  const warm = g.createLinearGradient(0, 0, 0, H);
  warm.addColorStop(0, "rgba(255,170,90,0.07)");
  warm.addColorStop(1, "rgba(255,120,60,0.1)");
  g.globalCompositeOperation = "soft-light";
  g.fillStyle = warm;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
}

// ------------------------------------------------------------------ captions
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
const font = (size, it, wt = 700) => `${it ? "italic " : ""}${wt} ${size}px Inter`;
function boxText(g, text, cy, size, a = 1, pop = 1, maxW = 880) {
  const toks = tokens(text);
  g.font = font(size, false);
  const space = g.measureText(" ").width;
  const lines = [[]];
  let wsum = 0;
  for (const tk of toks) {
    g.font = font(size, tk.it);
    const w = g.measureText(tk.w).width;
    if (lines[lines.length - 1].length && wsum + space + w > maxW) {
      lines.push([]);
      wsum = 0;
    }
    const line = lines[lines.length - 1];
    if (line.length) wsum += space;
    line.push({ ...tk, x: wsum, width: w });
    wsum += w;
  }
  const lh = Math.round(size * 1.3), pad = 16;
  const total = lines.length * lh;
  g.save();
  g.globalAlpha = a;
  g.translate(W / 2, cy);
  g.scale(pop, pop);
  g.translate(-W / 2, -cy);
  lines.forEach((l, i) => {
    const width = l.length ? l[l.length - 1].x + l[l.length - 1].width : 0;
    const x0 = W / 2 - width / 2, y = cy - total / 2 + i * lh;
    g.fillStyle = "#fff";
    g.beginPath();
    g.roundRect(x0 - pad, y, width + pad * 2, lh + 1, 6);
    g.fill();
    g.fillStyle = "#111";
    g.textAlign = "left";
    g.textBaseline = "middle";
    for (const w of l) {
      g.font = font(size, w.it);
      g.fillText(w.w, x0 + w.x, y + lh / 2 + size * 0.03);
    }
  });
  g.restore();
}

// ------------------------------------------------------------------ the frame
const LAYER = mk(), LG = LAYER.getContext("2d");
function beatAt(t) {
  let b = E.timeline[0];
  for (const x of E.timeline) if (t >= x.start) b = x;
  return b;
}
window.renderFrame = async (t) => {
  const tt = Math.min(t, E.speech_end - 0.001);
  const b = beatAt(tt);
  const g = LG;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.filter = "none";
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);

  // which picture: B-roll item active at t, else the face (VO beats are all B-roll)
  let it = null, prev = null;
  for (let i = 0; i < b.broll.length; i++) if (tt >= b.broll[i].at) {
    it = b.broll[i];
    prev = b.broll[i - 1] || null;
  }
  if (it && it.type === "face") it = null;
  if (!it && b.kind === "vo") it = b.broll[0];
  if (!it) await face(g, b, tt);
  else if (it.type === "flash") flash(g, it, tt);
  else if (it.type === "phone") phone(g, it, prev && prev.type === "phone" ? prev : null, tt);
  else if (it.type === "code") code(g, it, tt);
  else if (it.type === "photo") photo(g, it, prev && prev.type === "photo" ? prev : null, tt);

  // a small punch on every change of picture
  const changes = [b.start, ...b.broll.map((x) => x.at)].filter((x) => x <= tt);
  const since = tt - Math.max(...changes);
  const z = 1 + 0.035 * (1 - easeOut(clamp(since / 0.22)));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(LAYER, 0, 0);
  ctx.restore();
  ctx.drawImage(VIGNETTE, 0, 0);

  // end card: the last frame dims and holds
  const endK = clamp((t - E.speech_end) / 0.5);
  if (endK > 0) {
    ctx.fillStyle = `rgba(0,0,0,${0.6 * endK})`;
    ctx.fillRect(0, 0, W, H);
    const lines = E.end_card.lines;
    lines.forEach((ln, i) => {
      const a = easeOut(clamp((t - E.speech_end - 0.15 - i * 0.35) / 0.25));
      boxText(ctx, ln, 880 + i * 110, i ? 52 : 72, a, 0.94 + 0.06 * a);
    });
    ctx.globalAlpha = 0.7 * easeOut(clamp((t - E.speech_end - 0.8) / 0.4));
    const ww = 230, wh = (ww * WORDMARK.height) / WORDMARK.width;
    ctx.drawImage(WORDMARK, W / 2 - ww / 2, 1180, ww, wh);
    ctx.globalAlpha = 1;
  }

  // hook title and series pill
  for (const ti of E.titles) {
    const endAt = typeof ti.e === "string" ? E.timeline.find((x) => x.id === ti.e).end : ti.e;
    if (t < ti.s || t > endAt) continue;
    const a = Math.min(1, (t - ti.s) / 0.06 + (ti.s === 0 ? 1 : 0)) * clamp((endAt - t) / 0.2);
    if (ti.pill) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = "700 30px Inter";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const tw = ctx.measureText(ti.pill).width + 56;
      ctx.fillStyle = "rgba(225,29,72,0.92)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - tw / 2, 190, tw, 54, 27);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(ti.pill, W / 2, 218);
      ctx.restore();
    } else boxText(ctx, ti.text, ti.y, ti.size, a, 1);
  }

  // captions
  E.captions.forEach((c, i) => {
    const next = E.captions[i + 1];
    // back-to-back captions swap cleanly; a caption followed by a pause fades out
    const end = next && next.s - c.e < 0.15 ? next.s - 0.02 : c.e + 0.08;
    if (t < c.s - 0.02 || t > end) return;
    const a = clamp((t - c.s + 0.02) / 0.07) * (end === c.e + 0.08 ? clamp((end - t) / 0.08) : 1);
    const pop = 0.9 + 0.1 * easeOut(clamp((t - c.s) / 0.14));
    boxText(ctx, c.text, 1290, 58, a, pop);
  });

  const out = clamp((t - (E.duration - 0.5)) / 0.5);
  if (out > 0) {
    ctx.fillStyle = `rgba(0,0,0,${out})`;
    ctx.fillRect(0, 0, W, H);
  }
};
window.duration = E.duration;
window.ready = true;
