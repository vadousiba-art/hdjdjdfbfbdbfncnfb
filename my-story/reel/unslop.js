// The v2 "unslop" edit (my-story/YORU-STYLE.md), from reel/<project>/edit.json (?p=<project>):
// plain cuts, the speaker full frame, an on-screen hook on white boxes at the top, TikTok-style
// captions (1-3 words, white, bold, a coloured underline under the keyword, never italic), and
// inserts that sit straight in the top half (square corners, no outline, not animated) while the
// speaker stays in the bottom half. No zooms, flashes, transitions or end card.
//
// Items (plan.json "broll", anchored to a word):
//   hook  {text}                 on-screen hook, white boxes, until the first insert of its beat
//   split {img, crop?: [y0, y1]} an image in the top half, until the next split / "face" / the beat's end
//   split {clip, from}           another clip's frames in the top half (e.g. laptop footage)
//   split {pair: [imgA, imgB]}   two images side by side, tagged A and B
//   face                         back to the speaker full frame

const PROJ = new URLSearchParams(location.search).get("p") || "day1b";
const E = await (await fetch(`/reel/${PROJ}/edit.json`)).json();
const EXPO = await (await fetch(`/reel/${PROJ}/exposure.json`)).json();
const LAND = Boolean((E.style || {}).landscape);
const W = LAND ? 1920 : 1080, H = LAND ? 1080 : 1920;
window.W = W;
window.H = H;
const cv = document.getElementById("c");
cv.width = W;
cv.height = H;
const ctx = cv.getContext("2d");
const ACCENT = "#e11d48", PANEL = "#141010";

const load = (src) => new Promise((ok, no) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => no(new Error(src));
  i.src = src;
});
const IMG = {};
for (const b of E.timeline) for (const it of b.broll) for (const k of [it.img, ...(it.pair || [])]) if (k && !IMG[k]) IMG[k] = await load(`/photos/${PROJ}/broll/${k}.png`);
await Promise.all(["600", "700", "800"].map((w) => document.fonts.load(`${w} 50px Inter`)));

const frameUrl = (clip, n) => `/photos/${PROJ}/frames/${clip}/${String(n).padStart(4, "0")}.jpg`;
const FRAMES = {};
const clips = new Set([...E.timeline.map((b) => b.src), ...E.timeline.flatMap((b) => b.broll.filter((x) => x.clip).map((x) => x.clip))]);
for (const clip of clips) {
  let n = 1, step = 256;
  while (step >= 1) {
    if ((await fetch(frameUrl(clip, n + step), { method: "HEAD" })).ok) n += step;
    else step >>= 1;
  }
  FRAMES[clip] = n;
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

// every item with when it ends
const ITEMS = [];
for (const b of E.timeline) for (const it of b.broll) ITEMS.push({ ...it, beat: b });
ITEMS.sort((a, b) => a.at - b.at);
for (const it of ITEMS) {
  const after = ITEMS.filter((x) => x.at > it.at && x.beat === it.beat);
  if (it.type === "split") it.end = Math.min(it.beat.end, ...after.filter((x) => x.type === "split" || x.type === "face").map((x) => x.at));
  else if (it.type === "hook") it.end = Math.min(it.beat.end, ...after.filter((x) => x.type === "split").map((x) => x.at));
  else it.end = it.beat.end;
}
const active = (type, t) => ITEMS.filter((x) => x.type === type && t >= x.at && t < x.end);

function beatAt(t) {
  let b = E.timeline[0];
  for (const x of E.timeline) if (t >= x.start) b = x;
  return b;
}
// draw img to fill (cover) or fit (contain) a box, straight, no rounding
function place(g, img, x, y, w, h, mode = "cover", fy = 0.5) {
  const s = mode === "cover" ? Math.max(w / img.width, h / img.height) : Math.min(w / img.width, h / img.height);
  const dw = img.width * s, dh = img.height * s;
  const dx = x + (w - dw) / 2, dy = mode === "cover" ? y + (h - dh) * fy : y + (h - dh) / 2;
  g.drawImage(img, dx, dy, dw, dh);
}

// ------------------------------------------------------------------ text
function wrap(g, text, maxW) {
  const words = text.split(" "), lines = [""];
  for (const w of words) {
    const test = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w;
    if (g.measureText(test).width > maxW && lines[lines.length - 1]) lines.push(w);
    else lines[lines.length - 1] = test;
  }
  return lines;
}
// the on-screen hook: black text on white boxes, one box per line
function hook(g, it) {
  const size = LAND ? 52 : 58;
  g.save();
  g.font = `600 ${size}px Inter`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const lines = wrap(g, it.text, W - 180);
  const lh = size * 1.28, y0 = H * (LAND ? 0.1 : 0.13);
  lines.forEach((l, i) => {
    const w = g.measureText(l).width + 30, y = y0 + i * lh;
    g.fillStyle = "#fff";
    g.beginPath();
    g.roundRect(W / 2 - w / 2, y - lh / 2 + 2, w, lh - 4, 6);
    g.fill();
    g.fillStyle = "#000";
    g.fillText(l, W / 2, y + 2);
  });
  g.restore();
}
function tokens(text) {
  const out = [];
  let it = false;
  for (const raw of text.split(" ")) {
    const open = raw.startsWith("*"), close = raw.replace(/[.,!?:]+$/, "").endsWith("*");
    if (open) it = true;
    out.push({ w: raw.replace(/\*/g, ""), accent: it });
    if (close) it = false;
  }
  return out;
}
// TikTok-style caption: white, bold, a soft shadow, the keyword underlined in red
function caption(g, c, y) {
  const toks = tokens(c.text);
  let size = LAND ? 60 : 66;
  g.save();
  g.font = `800 ${size}px Inter`;
  const width = () => toks.reduce((s, tk) => s + g.measureText(tk.w).width, 0) + g.measureText(" ").width * (toks.length - 1);
  if (width() > W - 120) { size *= (W - 120) / width(); g.font = `800 ${size}px Inter`; }
  const space = g.measureText(" ").width, total = width();
  let x = W / 2 - total / 2;
  g.textAlign = "left";  // words are placed one by one from the left edge of the line
  g.textBaseline = "middle";
  g.lineJoin = "round";
  for (const tk of toks) {
    const w = g.measureText(tk.w).width;
    g.shadowColor = "rgba(0,0,0,0.75)";
    g.shadowBlur = 12;
    g.shadowOffsetY = 3;
    g.lineWidth = 4;
    g.strokeStyle = "rgba(0,0,0,0.55)";
    g.strokeText(tk.w, x, y);
    g.fillStyle = "#fff";
    g.fillText(tk.w, x, y);
    if (tk.accent) {
      g.shadowColor = "transparent";
      g.fillStyle = ACCENT;
      g.beginPath();
      g.roundRect(x, y + size * 0.6, w, size * 0.11, size * 0.055);
      g.fill();
    }
    x += w + space;
  }
  g.restore();
}

// ------------------------------------------------------------------ the frame
window.renderFrame = async (t) => {
  const tt = Math.min(t, E.speech_end - 0.001);
  const b = beatAt(tt);
  let p = b.pieces[0];
  for (const q of b.pieces) if (tt >= q.at) p = q;
  const n = clamp(Math.round((p.in + (tt - p.at)) * 30) + 1, 1, FRAMES[b.src]);
  const img = await load(frameUrl(b.src, n));
  const gain = EXPO[b.src]?.[n - 1] ?? 1;
  const sp = active("split", tt)[0];

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.filter = `brightness(${gain})`;
  if (!sp) {
    place(ctx, img, 0, 0, W, H, "cover", 0.4);
  } else {
    // the speaker in the bottom half, the face centred in it
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, H / 2, W, H / 2);
    ctx.clip();
    const s = W / img.width, dh = img.height * s;
    const fy = b.look?.face_y ?? (E.style || {}).face_y ?? 0.4;
    ctx.drawImage(img, 0, H * 0.75 - fy * dh, W, dh);
    ctx.restore();
  }
  ctx.filter = "none";
  if (sp) {
    // the insert: straight, square, still, on a near-black panel
    ctx.fillStyle = PANEL;
    ctx.fillRect(0, 0, W, H / 2);
    const pad = 50, bx = pad, by = pad + (LAND ? 0 : 40), bw = W - pad * 2, bh = H / 2 - by - pad;
    if (sp.pair) {
      const gap = 30, w2 = (bw - gap) / 2;
      sp.pair.forEach((k, i) => {
        const x = bx + i * (w2 + gap);
        place(ctx, IMG[k], x, by, w2, bh, "contain");
        // a plain tag, top left of its image
        const im = IMG[k], s2 = Math.min(w2 / im.width, bh / im.height);
        const ix = x + (w2 - im.width * s2) / 2, iy = by + (bh - im.height * s2) / 2;
        ctx.font = "800 52px Inter";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#fff";
        ctx.fillRect(ix, iy - 74, 74, 70);
        ctx.fillStyle = "#000";
        ctx.fillText(i ? "B" : "A", ix + 37, iy - 37);
      });
    } else if (sp.clip) {
      const fn = clamp(Math.round((sp.from + (tt - sp.at)) * 30) + 1, 1, FRAMES[sp.clip]);
      place(ctx, await load(frameUrl(sp.clip, fn)), bx, by, bw, bh, "contain");
    } else {
      place(ctx, IMG[sp.img], bx, by, bw, bh, "contain");
    }
  }
  for (const it of active("hook", tt)) hook(ctx, it);

  // captions: on the line between the halves during an insert, else 68% down
  // one caption at a time: each shows from just before its first word until the next one starts
  const y = sp ? H / 2 : H * 0.68;
  let cur = null;
  E.captions.forEach((c, i) => {
    const next = E.captions[i + 1];
    const end = next ? Math.min(next.s - 0.02, next.s - c.e < 0.25 ? next.s : c.e + 0.1) : c.e + 0.1;
    if (t >= c.s - 0.02 && t < end) cur = c;
  });
  if (cur) caption(ctx, cur, y);
};
window.duration = E.duration;
window.ready = true;
