// "Still waiting for it to pop?": a landscape reel (1920x1080) from
// reel/<project>/edit.json (?p=<project>). Animated scenes carry the voice
// lines; the speaker's take uses the cut-out masks (reel/mask.py) for words
// behind him and a key light on him alone.
//
// Scene items (plan.json "broll"; each lasts until the next scene or "face"):
//   heart  {count: [from, to], press: [from, to], cam: intro|macro|final}
//          a glossy heart balloon, a needle, a camcorder HUD, "frames to impact"
//   search {query}   a search bar that types; "result" brings up the YORU card
//   nope             a like card; "strike" crosses it out
//   cards            reaction cards, each "card" {emoji, label} pops in; "phone" {img} beside them
//   pop              the heart bursts into reactions, the logo lands; "join" + "click" press the button
// Overlays: wire/unwire (the heart turns to a wireframe), big (words behind
// the speaker), burst (emojis).

const W = 1920, H = 1080;
const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const PROJ = new URLSearchParams(location.search).get("p") || "yoru3";
const E = await (await fetch(`/reel/${PROJ}/edit.json`)).json();
const BRAND = "#e11d48", HOT = "#ff4d6d";

const load = (src) => new Promise((ok, no) => {
  const i = new Image();
  i.onload = () => ok(i);
  i.onerror = () => no(new Error(src));
  i.src = src;
});
const IMG = {};
for (const b of E.timeline) for (const it of b.broll) if (it.img && !IMG[it.img]) IMG[it.img] = await load(it.img.includes("/") ? `/photos/${it.img}.png` : `/photos/${PROJ}/broll/${it.img}.png`);
const WORDMARK = await load("/film/wordmark.png");
await Promise.all(["600", "700", "800", "900"].map((w) => document.fonts.load(`${w} 50px Inter`)));
await document.fonts.load("italic 800 50px Inter");
await document.fonts.load("900 50px YoruKanji", "夜");

const frameUrl = (clip, n) => `/photos/${PROJ}/frames/${clip}/${String(n).padStart(4, "0")}.jpg`;
const maskUrl = (clip, n) => `/photos/${PROJ}/masks/${clip}/${String(n).padStart(4, "0")}.png`;
const FRAMES = {};
for (const clip of new Set(E.timeline.filter((b) => b.kind === "face").map((b) => b.src))) {
  let n = 1, step = 256;
  while (step >= 1) {
    if ((await fetch(frameUrl(clip, n + step), { method: "HEAD" })).ok) n += step;
    else step >>= 1;
  }
  FRAMES[clip] = n;
}

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeIn = (k) => k * k * k;
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const back = (k) => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const rnd = (seed) => { const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const mk = (w = W, h = H) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

// ------------------------------------------------------------------ the timeline of items
const SCENES = ["heart", "search", "nope", "cards", "pop", "face"];
const ITEMS = [];
for (const b of E.timeline) for (const it of b.broll) ITEMS.push({ ...it, beat: b });
ITEMS.sort((a, b) => a.at - b.at);
for (const it of ITEMS) {
  const after = ITEMS.filter((x) => x.at > it.at);
  if (SCENES.includes(it.type)) it.end = Math.min(E.duration, ...after.filter((x) => SCENES.includes(x.type)).map((x) => x.at));
  else if (it.type === "wire") it.end = Math.min(E.duration, ...after.filter((x) => x.type === "unwire").map((x) => x.at));
  else if (it.type === "big") it.end = Math.min(it.beat.end, ...after.filter((x) => x.type === "big" && x.beat === it.beat).map((x) => x.at));
  else if (it.type === "burst") it.end = it.at + 1.9;
  else it.end = E.duration;
}
const sceneAt = (t) => ITEMS.filter((x) => SCENES.includes(x.type) && x.at <= t).pop() || ITEMS[0];
const last = (type, t) => ITEMS.filter((x) => x.type === type && x.at <= t).pop();
const POP = ITEMS.find((x) => x.type === "pop");
const POP_T = POP ? POP.at + (POP.delay || 0) : 1e9;
const WATCH_FROM = E.timeline.find((b) => b.kind !== "insert")?.start ?? 7;

// film grain, a few frames of it
const GRAIN = Array.from({ length: 6 }, (_, i) => {
  const c = mk(480, 270), g = c.getContext("2d"), d = g.createImageData(480, 270);
  for (let p = 0; p < d.data.length; p += 4) {
    const v = 128 + (rnd(i * 1e5 + p) - 0.5) * 255;
    d.data[p] = d.data[p + 1] = d.data[p + 2] = v;
    d.data[p + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  return c;
});

// ------------------------------------------------------------------ the heart
// classic heart curve, in units of s/17 around (0,0); y up is negative on screen
const HEART = [];
for (let i = 0; i <= 240; i++) {
  const a = (i / 240) * Math.PI * 2;
  HEART.push([16 * Math.sin(a) ** 3, -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]);
}
// the top of the left lobe: where the needle lands
const LOBE = HEART.filter(([x]) => x < -5 && x > -11).reduce((a, p) => (p[1] < a[1] ? p : a), [0, 0]);
function heartPath(s, dx = 0, depth = 0, width = 1) {
  // depth > 0 pushes the skin in around x = dx (the needle's dent)
  const p = new Path2D();
  HEART.forEach(([x, y], i) => {
    const px = (x * s) / 17;
    let py = (y * s) / 17;
    if (depth > 0 && y < 0) py += depth * Math.exp(-(((px - dx) / width) ** 2));
    i ? p.lineTo(px, py) : p.moveTo(px, py);
  });
  p.closePath();
  return p;
}
function heartState(t) {
  // count, press and camera from the heart item playing at t (or the last one before)
  const it = last("heart", t);
  const k = clamp((t - it.at) / Math.max(0.1, it.end - it.at));
  const kc = it.cam === "final" ? k : 1 - Math.pow(1 - k, 1.6);
  const count = lerp(it.count[0], it.count[1], kc);
  // the needle only presses in once the count is low: one source for both
  return { it, count, press: clamp((22 - count) / 21), k };
}
function drawHeart(g, t, opts = {}) {
  const { it, count, press } = heartState(t);
  const S = 300; // heart half-size in px at wide framing
  const bob = Math.sin(t * 1.3) * 6, sway = Math.sin(t * 0.7) * 0.03;
  // camera: wide, then a macro cut onto the lobe, pushing in
  let zoom = 1, fx = 0, fy = 0;
  const lobeX = (LOBE[0] * S) / 17, lobeY = (LOBE[1] * S) / 17;
  if (it.cam === "intro") {
    const cut = t - it.at > 3.6;
    zoom = cut ? 2.6 + 0.25 * clamp((t - it.at - 3.6) / 3.6) : 1 + 0.06 * clamp((t - it.at) / 3.6);
    if (cut) { fx = lobeX; fy = lobeY + 120; }
  } else if (it.cam === "macro") {
    zoom = 2.85 + 0.55 * easeInOut(clamp((t - it.at) / (it.end - it.at)));
    fx = lobeX; fy = lobeY + 110;
  } else if (it.cam === "final") {
    zoom = 3.4 + 0.5 * clamp((t - it.at) / (it.end - it.at));
    fx = lobeX; fy = lobeY + 100;
  }
  if (opts.zoom) zoom = opts.zoom;
  // background: deep red dark
  const bg = g.createRadialGradient(W / 2, H * 0.6, 50, W / 2, H * 0.55, H * 1.1);
  bg.addColorStop(0, "#2a0710");
  bg.addColorStop(0.5, "#0f0306");
  bg.addColorStop(1, "#030102");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  g.save();
  g.translate(W / 2, H * 0.58 + bob);
  g.scale(zoom, zoom);
  g.translate(-fx, -fy);
  g.rotate(sway * (zoom > 1.5 ? 0.3 : 1));
  const squash = 1 - 0.035 * press;
  const depth = S * 0.14 * Math.pow(press, 1.3), dentW = S * (0.1 + 0.12 * press);
  const path = heartPath(S, (LOBE[0] * S) / 17, depth, dentW);
  // glow behind it
  const glow = g.createRadialGradient(0, 0, S * 0.3, 0, 0, S * 1.6);
  glow.addColorStop(0, "rgba(225,29,72,0.35)");
  glow.addColorStop(1, "rgba(225,29,72,0)");
  g.fillStyle = glow;
  g.fillRect(-S * 2, -S * 2, S * 4, S * 4);
  // string and knot under the point
  g.strokeStyle = "rgba(255,255,255,0.25)";
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(0, S * 1.03);
  g.bezierCurveTo(14 * Math.sin(t), S * 1.35, -14, S * 1.6, 6 * Math.sin(t * 1.3), S * 2.2);
  g.stroke();
  g.fillStyle = "#9b0f2c";
  g.beginPath();
  g.moveTo(-10, S * 1.05);
  g.lineTo(10, S * 1.05);
  g.lineTo(0, S * 0.97);
  g.fill();

  g.save();
  g.scale(1, squash);
  const wire = ITEMS.some((x) => x.type === "wire" && t >= x.at && t < x.end);
  if (wire) {
    // a balloon that doesn't exist: the mesh under the skin
    g.fillStyle = "rgba(20,3,8,0.92)";
    g.fill(path);
    g.save();
    g.clip(path);
    g.strokeStyle = "rgba(255,77,109,0.75)";
    g.lineWidth = 1.1 / zoom * 1.6;
    for (let i = -20; i <= 20; i++) {
      g.beginPath();
      for (let j = -20; j <= 20; j++) {
        const x = i * S * 0.07, y = j * S * 0.07, bulge = 1 + 0.25 * Math.cos((x / S) * 1.4) * Math.cos((y / S) * 1.4);
        j === -20 ? g.moveTo(x * bulge, y * bulge) : g.lineTo(x * bulge, y * bulge);
      }
      g.stroke();
      g.beginPath();
      for (let j = -20; j <= 20; j++) {
        const y = i * S * 0.07, x = j * S * 0.07, bulge = 1 + 0.25 * Math.cos((x / S) * 1.4) * Math.cos((y / S) * 1.4);
        j === -20 ? g.moveTo(x * bulge, y * bulge) : g.lineTo(x * bulge, y * bulge);
      }
      g.stroke();
    }
    g.restore();
    g.strokeStyle = HOT;
    g.lineWidth = 2.5 / zoom * 1.6;
    g.stroke(path);
  } else {
    const body = g.createRadialGradient(-S * 0.35, -S * 0.45, S * 0.05, -S * 0.1, -S * 0.1, S * 1.35);
    body.addColorStop(0, "#ff8094");
    body.addColorStop(0.28, "#f0234a");
    body.addColorStop(0.7, "#a30a2a");
    body.addColorStop(1, "#4a0412");
    g.fillStyle = body;
    g.fill(path);
    // bottom shade and rim light
    g.save();
    g.clip(path);
    const shade = g.createLinearGradient(0, -S, 0, S);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(30,0,8,0.55)");
    g.fillStyle = shade;
    g.fillRect(-S * 1.2, -S * 1.2, S * 2.4, S * 2.4);
    // the dent where the needle presses
    if (press > 0.01) {
      const dx = lobeX, dy = lobeY;
      const dent = g.createRadialGradient(dx, dy + depth, 2, dx, dy + depth, S * (0.12 + 0.22 * press));
      dent.addColorStop(0, `rgba(40,0,10,${0.75 * press})`);
      dent.addColorStop(0.55, `rgba(120,5,30,${0.35 * press})`);
      dent.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = dent;
      g.fillRect(dx - S, dy - S, S * 2, S * 2);
      g.strokeStyle = `rgba(255,190,200,${0.45 * press})`;
      g.lineWidth = 3 / zoom * 1.4;
      g.beginPath();
      g.ellipse(dx, dy + depth * 0.35, dentW * 1.6, S * (0.03 + 0.05 * press), 0, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
    }
    g.restore();
    // specular highlights
    g.save();
    g.clip(path);
    g.filter = "blur(14px)";
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.beginPath();
    g.ellipse(-S * 0.5, -S * 0.42, S * 0.2, S * 0.09, -0.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.35)";
    g.beginPath();
    g.ellipse(S * 0.42, -S * 0.45, S * 0.12, S * 0.05, 0.5, 0, Math.PI * 2);
    g.fill();
    g.filter = "none";
    g.restore();
    g.strokeStyle = "rgba(255,140,160,0.35)";
    g.lineWidth = 3;
    g.stroke(path);
  }
  g.restore();

  // the needle: from far above down to the lobe; past zero it presses in
  const gap = press > 0 ? -depth : S * (0.06 + 1.6 * Math.pow(clamp((count - 14) / 290), 1.25));
  const tipY = lobeY * squash - gap;
  const nx = lobeX, nw = 7;
  const ng = g.createLinearGradient(nx - nw, 0, nx + nw, 0);
  ng.addColorStop(0, "#5c5f66");
  ng.addColorStop(0.45, "#f2f4f8");
  ng.addColorStop(0.6, "#b9bec7");
  ng.addColorStop(1, "#3c3f45");
  g.fillStyle = ng;
  g.beginPath();
  g.moveTo(nx - nw, tipY - S * 6);
  g.lineTo(nx + nw, tipY - S * 6);
  g.lineTo(nx + nw * 0.55, tipY - S * 0.18);
  g.lineTo(nx, tipY);
  g.lineTo(nx - nw * 0.55, tipY - S * 0.18);
  g.closePath();
  g.fill();
  // its reflection on the skin
  g.fillStyle = `rgba(255,220,225,${0.18 + 0.3 * clamp(1 - gap / (S * 0.5))})`;
  g.beginPath();
  g.ellipse(nx, lobeY * squash + depth * 0.85 + S * 0.01, S * 0.05 * (1 - 0.5 * press), S * 0.012, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  return { count };
}
function hud(g, t, count, a) {
  if (a <= 0) return;
  g.save();
  g.globalAlpha = a;
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 3;
  const m = 70, L = 60;
  for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    g.beginPath();
    g.moveTo(x, y + dy * L);
    g.lineTo(x, y);
    g.lineTo(x + dx * L, y);
    g.stroke();
  }
  g.font = "700 28px 'DejaVu Sans Mono', monospace";
  g.textBaseline = "middle";
  if (Math.floor(t * 1.6) % 2 === 0) {
    g.fillStyle = "#ff3b30";
    g.beginPath();
    g.arc(m + 34, m + 40, 9, 0, Math.PI * 2);
    g.fill();
  }
  const fr = Math.floor(t * 30);
  const tc = `00:00:${String(Math.floor(fr / 30)).padStart(2, "0")}:${String(fr % 30).padStart(2, "0")}`;
  g.fillStyle = "#fff";
  g.fillText(`REC ${tc}`, m + 54, m + 41);
  g.textAlign = "right";
  g.fillText(t > 3.6 ? "100MM MACRO" : "50MM", W - m - 20, m + 41);
  g.textAlign = "center";
  g.font = "700 22px 'DejaVu Sans Mono', monospace";
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.fillText("FRAMES TO IMPACT", W / 2, H - 150);
  g.font = "700 84px 'DejaVu Sans Mono', monospace";
  g.fillStyle = count < 40 ? HOT : "#fff";
  g.fillText(String(Math.max(1, Math.round(count))).padStart(3, "0"), W / 2, H - 95);
  g.restore();
}

// ------------------------------------------------------------------ motion-graphics scenes
function nightBg(g, t, tint = 0) {
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#07070d");
  bg.addColorStop(1, tint ? "#1c0710" : "#120a18");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) {
    const x = W * (0.2 + 0.3 * i) + Math.sin(t * 0.4 + i) * 120, y = H * (0.3 + 0.2 * (i % 2)) + Math.cos(t * 0.3 + i) * 80;
    const r = g.createRadialGradient(x, y, 10, x, y, 520);
    r.addColorStop(0, i === 1 ? "rgba(225,29,72,0.22)" : "rgba(120,60,255,0.14)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, W, H);
  }
}
function glass(g, x, y, w, h, r, a = 1) {
  g.save();
  g.globalAlpha *= a;
  g.shadowColor = "rgba(0,0,0,0.5)";
  g.shadowBlur = 50;
  g.shadowOffsetY = 18;
  g.fillStyle = "rgba(255,255,255,0.08)";
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fill();
  g.shadowColor = "transparent";
  const sh = g.createLinearGradient(0, y, 0, y + h);
  sh.addColorStop(0, "rgba(255,255,255,0.14)");
  sh.addColorStop(1, "rgba(255,255,255,0.03)");
  g.fillStyle = sh;
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.22)";
  g.lineWidth = 2;
  g.stroke();
  g.restore();
}
function cursor(g, x, y, press = 0) {
  g.save();
  g.translate(x, y);
  g.scale(1 - 0.15 * press, 1 - 0.15 * press);
  g.shadowColor = "rgba(0,0,0,0.5)";
  g.shadowBlur = 12;
  g.fillStyle = "#fff";
  g.strokeStyle = "#111";
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, 44);
  g.lineTo(11, 33);
  g.lineTo(20, 52);
  g.lineTo(28, 48);
  g.lineTo(19, 30);
  g.lineTo(34, 30);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
  if (press > 0) {
    g.strokeStyle = `rgba(255,255,255,${0.6 * (1 - press)})`;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, y, 20 + 40 * press, 0, Math.PI * 2);
    g.stroke();
  }
}
// text that sharpens in: blur and scale settle over 0.25 s
function blurText(g, text, x, y, t0, t, size, opts = {}) {
  const k = clamp((t - t0) / 0.28);
  if (k <= 0) return;
  g.save();
  g.globalAlpha = easeOut(k) * (opts.a ?? 1);
  g.filter = `blur(${(1 - easeOut(k)) * 16}px)`;
  g.translate(x, y + (1 - easeOut(k)) * 14);
  const sc = lerp(1.14, 1, easeOut(k));
  g.scale(sc, sc);
  g.font = `${opts.weight || 800} ${size}px ${opts.family || "Inter"}`;
  g.textAlign = opts.align || "center";
  g.textBaseline = "middle";
  g.fillStyle = opts.color || "#fff";
  g.fillText(text, 0, 0);
  g.restore();
}
function search(g, it, t) {
  nightBg(g, t);
  const k = easeOut(clamp((t - it.at) / 0.35));
  const bw = 1180, bh = 116, bx = W / 2 - bw / 2, by = 330 - 40 * (1 - k);
  g.save();
  g.globalAlpha = k;
  g.filter = `blur(${(1 - k) * 10}px)`;
  glass(g, bx, by, bw, bh, bh / 2);
  g.filter = "none";
  // magnifier
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = 5;
  g.beginPath();
  g.arc(bx + 70, by + bh / 2 - 4, 20, 0, Math.PI * 2);
  g.moveTo(bx + 84, by + bh / 2 + 10);
  g.lineTo(bx + 100, by + bh / 2 + 26);
  g.stroke();
  // typing
  const typeAt = it.at + 0.05, n = Math.floor(clamp((t - typeAt) / 0.38) * it.query.length);
  const typed = it.query.slice(0, n);
  g.font = "600 46px Inter";
  g.textBaseline = "middle";
  g.fillStyle = typed ? "#fff" : "rgba(255,255,255,0.4)";
  g.fillText(typed || "Search", bx + 130, by + bh / 2);
  if (Math.floor(t * 2.5) % 2 === 0 || n < it.query.length) {
    const tw = g.measureText(typed).width;
    g.fillStyle = HOT;
    g.fillRect(bx + 134 + tw, by + 30, 4, bh - 60);
  }
  g.restore();
  // the result
  const res = last("result", t);
  if (res && res.at >= it.at) {
    const kr = clamp((t - res.at) / 0.4), e = back(kr);
    const cw = 1000, ch = 250, cx = W / 2 - cw / 2, cy = 500 + 80 * (1 - e);
    g.save();
    g.globalAlpha = clamp(kr * 2);
    g.filter = `blur(${(1 - easeOut(kr)) * 12}px)`;
    glass(g, cx, cy, cw, ch, 36);
    g.filter = "none";
    // app icon
    g.fillStyle = "#0b0b0f";
    g.beginPath();
    g.roundRect(cx + 40, cy + 45, 160, 160, 38);
    g.fill();
    g.font = "900 104px YoruKanji";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = BRAND;
    g.fillText("夜", cx + 120, cy + 128);
    const ww = 300, wh = (ww * WORDMARK.height) / WORDMARK.width;
    g.drawImage(WORDMARK, cx + 240, cy + 70, ww, wh);
    g.textAlign = "left";
    g.font = "600 34px Inter";
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.fillText("Social media · Free · Likes that mean something", cx + 244, cy + 172);
    g.restore();
    // the cursor goes to it
    const kc = easeInOut(clamp((t - res.at - 0.2) / 0.6));
    cursor(g, lerp(1500, cx + 640, kc), lerp(900, cy + 150, kc), clamp((t - res.at - 0.85) / 0.25) * (t - res.at < 1.2 ? 1 : 0));
  } else {
    const kc = easeInOut(clamp((t - it.at) / 0.4));
    cursor(g, lerp(1700, bx + 600, kc), lerp(1000, by + 80, kc), clamp((t - it.at - 0.4) / 0.2) * (t - it.at < 0.65 ? 1 : 0));
  }
}
function nope(g, it, t) {
  nightBg(g, t, 1);
  const k = back(clamp((t - it.at) / 0.4));
  const strike = last("strike", t);
  const ks = strike && strike.at >= it.at ? clamp((t - strike.at) / 0.25) : 0;
  const shake = ks > 0 && ks < 1 ? Math.sin(t * 80) * 14 * (1 - ks) : 0;
  const cw = 640, ch = 420, cx = W / 2 - cw / 2 + shake, cy = 260 + 60 * (1 - k);
  g.save();
  g.globalAlpha = clamp((t - it.at) / 0.2);
  g.filter = ks > 0 ? `grayscale(${ks})` : "none";
  glass(g, cx, cy, cw, ch, 40);
  g.font = "220px 'Noto Color Emoji'";
  g.textAlign = "center";
  g.textBaseline = "middle";
  const beat = 1 + 0.06 * Math.max(0, Math.sin(t * 7));
  g.save();
  g.translate(W / 2 + shake, cy + 180);
  g.scale(beat, beat);
  g.fillText("❤️", 0, 0);
  g.restore();
  g.font = "700 44px Inter";
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.fillText("47 likes", W / 2 + shake, cy + 350);
  g.filter = "none";
  g.restore();
  if (ks > 0) {
    // a red slash across it
    g.save();
    g.strokeStyle = BRAND;
    g.lineWidth = 30;
    g.lineCap = "round";
    g.shadowColor = "rgba(225,29,72,0.7)";
    g.shadowBlur = 30;
    g.beginPath();
    g.moveTo(cx + 40, cy + ch - 40);
    g.lineTo(lerp(cx + 40, cx + cw - 40, easeOut(ks)), lerp(cy + ch - 40, cy + 40, easeOut(ks)));
    g.stroke();
    g.restore();
  }
}
function cards(g, it, t) {
  nightBg(g, t);
  const list = ITEMS.filter((x) => x.type === "card" && x.at >= it.at && x.at < it.end);
  list.forEach((c, i) => {
    const k = clamp((t - c.at) / 0.4);
    if (k <= 0) return;
    const e = back(k), x = 150 + i * 400, y = 360 + 60 * (1 - e);
    g.save();
    g.globalAlpha = clamp(k * 2.5);
    g.filter = `blur(${(1 - easeOut(k)) * 12}px)`;
    glass(g, x, y, 360, 400, 40);
    g.filter = "none";
    g.font = "170px 'Noto Color Emoji'";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const pulse = 1 + 0.12 * Math.max(0, 1 - (t - c.at) / 0.3);
    g.save();
    g.translate(x + 180, y + 170);
    g.scale(pulse, pulse);
    g.fillText(c.emoji, 0, 0);
    g.restore();
    g.font = "900 54px Inter";
    g.fillStyle = "#fff";
    g.fillText(c.label, x + 180, y + 320);
    // +1 floating up
    const kp = clamp((t - c.at - 0.15) / 0.8);
    if (kp > 0 && kp < 1) {
      g.globalAlpha = 1 - kp;
      g.font = "800 46px Inter";
      g.fillStyle = HOT;
      g.fillText("+1", x + 300, y + 60 - 80 * kp);
    }
    g.restore();
  });
  // the cursor taps each card as it lands
  const cur = list.filter((c) => c.at <= t).pop();
  if (cur) {
    const i = list.indexOf(cur), prevX = i ? 150 + (i - 1) * 400 + 250 : 900;
    const km = easeInOut(clamp((t - cur.at + 0.25) / 0.25));
    cursor(g, lerp(prevX, 150 + i * 400 + 250, km), 640, clamp((t - cur.at) / 0.2) * (t - cur.at < 0.35 ? 1 : 0));
  }
  const ph = ITEMS.find((x) => x.type === "phone" && x.at >= it.at && x.at < it.end);
  if (ph && list.length) {
    // the real app, small, at the right
    phone(g, ph, t, 1600);
  }
}
const PH = { h: 820, w: Math.round(820 / 2.1667) };
function phone(g, it, t, cxEnd) {
  const img = IMG[it.img];
  const k = easeOut(clamp((t - it.at) / 0.45));
  const cx = lerp(W + PH.w, cxEnd, k), cy = 560 + 8 * Math.sin(t * 1.3);
  g.save();
  g.translate(cx, cy);
  g.rotate(lerp(0.12, -0.04, k));
  g.shadowColor = "rgba(0,0,0,0.6)";
  g.shadowBlur = 60;
  g.fillStyle = "#0b0b0f";
  g.beginPath();
  g.roundRect(-PH.w / 2, -PH.h / 2, PH.w, PH.h, 54);
  g.fill();
  g.shadowColor = "transparent";
  const sw = PH.w - 20, sh = PH.h - 20;
  g.beginPath();
  g.roundRect(-sw / 2, -sh / 2, sw, sh, 44);
  g.clip();
  const kz = easeInOut(clamp((t - it.at - 0.4) / 2.5));
  const [fx, fy] = it.focus || [0.5, 0.4];
  const s = Math.max(sw / img.width, sh / img.height) * (1 + 0.3 * kz);
  const dw = img.width * s, dh = img.height * s;
  g.drawImage(img, -sw / 2 - (dw - sw) * fx * (kz > 0 ? 1 : 0.5), Math.max(-sh / 2 - (dh - sh), -sh / 2 - (dh - sh) * fy * kz), dw, dh);
  g.restore();
}
function popScene(g, t) {
  // until the pop, the heart; then the burst, then the logo and the button
  if (t < POP_T) {
    const st = drawHeart(g, t);
    return st;
  }
  const k = t - POP_T;
  // the heart is gone: same backdrop, a flash and a shockwave
  const bg = g.createRadialGradient(W / 2, H * 0.55, 50, W / 2, H * 0.55, H * 1.1);
  bg.addColorStop(0, "#3a0a16");
  bg.addColorStop(0.5, "#12040a");
  bg.addColorStop(1, "#030102");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const ring = easeOut(clamp(k / 0.6));
  if (ring < 1) {
    g.strokeStyle = `rgba(255,120,140,${0.8 * (1 - ring)})`;
    g.lineWidth = 30 * (1 - ring) + 2;
    g.beginPath();
    g.arc(W / 2, H * 0.5, 80 + 1100 * ring, 0, Math.PI * 2);
    g.stroke();
  }
  // shreds of the heart
  for (let i = 0; i < 46; i++) {
    const a = rnd(i) * Math.PI * 2, sp = 500 + rnd(i + 50) * 1300, kk = clamp(k / 1.4);
    if (kk >= 1) continue;
    const x = W / 2 + Math.cos(a) * sp * easeOut(kk), y = H * 0.5 + Math.sin(a) * sp * easeOut(kk) + 600 * kk * kk;
    g.save();
    g.globalAlpha = 1 - kk;
    g.translate(x, y);
    g.rotate(a + kk * 8 * (rnd(i + 9) - 0.5));
    g.fillStyle = i % 3 ? "#e0103a" : "#ff6b7f";
    g.beginPath();
    g.moveTo(0, -18 - rnd(i + 3) * 20);
    g.lineTo(14 + rnd(i + 4) * 16, 10);
    g.lineTo(-16, 14);
    g.fill();
    g.restore();
  }
  // the reactions it turns into
  const EM = ["🤡", "💀", "🧢", "🔥", "😭", "🫡", "🤡", "💀", "🔥", "🧢"];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + rnd(i + 7) * 0.4, sp = 380 + rnd(i + 21) * 560, kk = clamp((k - rnd(i + 2) * 0.08) / 1.7);
    if (kk <= 0 || kk >= 1) continue;
    const x = W / 2 + Math.cos(a) * sp * easeOut(kk), y = H * 0.5 + Math.sin(a) * sp * easeOut(kk) + 260 * kk * kk;
    const s = (80 + rnd(i + 5) * 70) * (kk < 0.12 ? back(kk / 0.12) : 1);
    g.save();
    g.globalAlpha = kk > 0.7 ? (1 - kk) / 0.3 : 1;
    g.translate(x, y);
    g.rotate((rnd(i + 11) - 0.5) * 1.2 * kk);
    g.font = `${s}px 'Noto Color Emoji'`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(EM[i % EM.length], 0, 0);
    g.restore();
  }
  // the flash
  if (k < 0.12) {
    g.fillStyle = `rgba(255,235,240,${1 - k / 0.12})`;
    g.fillRect(0, 0, W, H);
  }
  // the logo lands
  const kl = clamp((k - 0.45) / 0.5);
  if (kl > 0) {
    g.save();
    g.globalAlpha = easeOut(kl) * 0.12;
    g.font = "900 760px YoruKanji";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = BRAND;
    g.fillText("夜", W / 2, H * 0.47);
    g.restore();
    g.save();
    g.globalAlpha = easeOut(kl);
    g.filter = `blur(${(1 - easeOut(kl)) * 18}px)`;
    const ww = 620 * lerp(1.2, 1, easeOut(kl)), wh = (ww * WORDMARK.height) / WORDMARK.width;
    g.shadowColor = "rgba(225,29,72,0.8)";
    g.shadowBlur = 60;
    g.drawImage(WORDMARK, W / 2 - ww / 2, 300 - wh / 2, ww, wh);
    g.restore();
  }
  // the button: a + that grows into "Join YORU, it's free" and gets clicked
  const join = ITEMS.find((x) => x.type === "join");
  const click = ITEMS.find((x) => x.type === "click");
  if (join && t >= join.at + 0.3) {
    const kb = clamp((t - join.at - 0.3) / 0.5), grow = easeInOut(clamp((t - join.at - 0.55) / 0.45));
    const bw = lerp(110, 640, grow), bh = 110, bx = W / 2 - bw / 2, by = 470;
    const clicked = click && t >= click.at + 0.15;
    g.save();
    g.globalAlpha = easeOut(kb);
    g.filter = `blur(${(1 - easeOut(kb)) * 10}px)`;
    g.shadowColor = clicked ? "rgba(34,197,94,0.6)" : "rgba(225,29,72,0.6)";
    g.shadowBlur = 40;
    g.fillStyle = clicked ? "#16a34a" : BRAND;
    g.beginPath();
    g.roundRect(bx, by, bw, bh, bh / 2);
    g.fill();
    g.shadowColor = "transparent";
    g.fillStyle = "#fff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    if (grow < 0.5) {
      g.font = "300 80px Inter";
      g.fillText("+", W / 2, by + bh / 2 - 4);
    } else {
      g.globalAlpha *= clamp((grow - 0.5) / 0.3);
      g.font = "800 46px Inter";
      g.fillText(clicked ? "Joined ✓" : "Join YORU · it's free", W / 2, by + bh / 2 + 2);
    }
    g.filter = "none";
    g.restore();
    g.save();
    g.globalAlpha = easeOut(kb) * 0.6;
    g.font = "600 30px Inter";
    g.textAlign = "center";
    g.fillStyle = "#fff";
    g.fillText("yoru-social.vercel.app", W / 2, by + bh + 52);
    g.restore();
    if (click) {
      const kc = easeInOut(clamp((t - click.at + 0.5) / 0.5));
      cursor(g, lerp(1500, W / 2 + 120, kc), lerp(980, by + 70, kc), clamp((t - click.at) / 0.18) * (t - click.at < 0.4 ? 1 : 0));
    }
  }
  return null;
}

// ------------------------------------------------------------------ the speaker
const PIC = mk(), PG = PIC.getContext("2d");
const CUT = mk(), CG = CUT.getContext("2d");
function cover(g, img, z, fx, fy) {
  const s = Math.max(W / img.width, H / img.height) * z;
  const dw = img.width * s, dh = img.height * s;
  g.drawImage(img, (W - dw) * fx, (H - dh) * fy, dw, dh);
}
async function speaker(g, b, t) {
  let p = b.pieces[0];
  for (const q of b.pieces) if (t >= q.at) p = q;
  const n = clamp(Math.round((p.in + (t - p.at)) * 30) + 1, 1, FRAMES[b.src]);
  const img = await load(frameUrl(b.src, n)), m = await load(maskUrl(b.src, n));
  const z = (p.punch ? 1.08 : 1.02) + 0.03 * clamp((t - p.at) / 4);
  // the room at night, darker and cooler
  g.filter = "brightness(0.55) saturate(0.85) contrast(1.05)";
  cover(g, img, z, 0.42, 0.4);
  g.filter = "none";
  const tint = g.createLinearGradient(0, 0, W, H);
  tint.addColorStop(0, "rgba(40,10,60,0.25)");
  tint.addColorStop(1, "rgba(120,10,40,0.2)");
  g.fillStyle = tint;
  g.fillRect(0, 0, W, H);
  // words go between the room and him
  for (const it of ITEMS.filter((x) => x.type === "big" && t >= x.at && t < x.end)) bigText(g, it, t);
  // him, with a key light
  CG.globalCompositeOperation = "source-over";
  CG.clearRect(0, 0, W, H);
  CG.filter = "brightness(0.98) contrast(1.06) saturate(1.02)";
  cover(CG, img, z, 0.42, 0.4);
  CG.filter = "none";
  CG.globalCompositeOperation = "destination-in";
  cover(CG, m, z, 0.42, 0.4);
  CG.globalCompositeOperation = "source-over";
  g.drawImage(CUT, 0, 0);
}
function bigText(g, it, t) {
  const k = clamp((t - it.at) / 0.25), out = clamp((it.end - t) / 0.12);
  const lines = it.text.split(" ").length > 2 ? splitTwo(g, it.text, it.size || 280) : [it.text];
  let size = it.size || 280;
  g.font = `900 ${size}px Inter`;
  const widest = Math.max(...lines.map((l) => g.measureText(l).width));
  if (widest > 760) size *= 760 / widest;
  const lh = size * 0.92, cx = it.x ?? 1460, cy = 400 - ((lines.length - 1) * lh) / 2;
  g.save();
  g.globalAlpha = easeOut(k) * out;
  g.filter = `blur(${(1 - easeOut(k)) * 18}px)`;
  g.translate(cx, cy);
  const sc = lerp(1.2, 1, easeOut(k));
  g.scale(sc, sc);
  g.font = `900 ${size}px Inter`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const grad = g.createLinearGradient(0, -size / 2, 0, size / 2 + (lines.length - 1) * lh);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#ff9fb0");
  g.shadowColor = "rgba(225,29,72,0.55)";
  g.shadowBlur = 40;
  g.fillStyle = grad;
  lines.forEach((l, i) => g.fillText(l, 0, i * lh));
  g.restore();
}
function splitTwo(g, text, size) {
  g.font = `900 ${size}px Inter`;
  const w = text.split(" ");
  let best = null;
  for (let i = 1; i < w.length; i++) {
    const a = w.slice(0, i).join(" "), b = w.slice(i).join(" ");
    const m = Math.max(g.measureText(a).width, g.measureText(b).width);
    if (!best || m < best.m) best = { m, l: [a, b] };
  }
  return best.l;
}
function burst(g, it, t, idx) {
  const n = it.n || 12, k = (t - it.at) / 1.9;
  for (let i = 0; i < n; i++) {
    const r1 = rnd(idx * 97 + i), r2 = rnd(idx * 131 + i * 7), r3 = rnd(idx * 53 + i * 3);
    const kk = clamp((k * 1.9 - r3 * 0.35) / 1.4);
    if (kk <= 0 || kk >= 1) continue;
    const x = 1200 + r1 * 650 + Math.sin(kk * 6 + r2 * 6) * 40, y = 1120 - easeOut(kk) * (620 + r2 * 360);
    g.save();
    g.globalAlpha = kk > 0.75 ? (1 - kk) / 0.25 : 1;
    g.translate(x, y);
    g.font = `${(70 + r2 * 70) * (kk < 0.15 ? back(kk / 0.15) : 1)}px 'Noto Color Emoji'`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(it.emoji, 0, 0);
    g.restore();
  }
}

// ------------------------------------------------------------------ captions: words sharpen in one by one
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
function caption(g, c, t, a, y) {
  const toks = tokens(c.text);
  const ws = c.words && c.words.length === toks.length ? c.words : toks.map((_, i) => c.s + ((c.e - c.s) * i) / toks.length);
  const size = 62;
  const font = (it) => `${it ? "italic 800" : "700"} ${size}px Inter`;
  g.font = font(false);
  const space = g.measureText(" ").width;
  const widths = toks.map((tk) => { g.font = font(tk.it); return g.measureText(tk.w).width; });
  const total = widths.reduce((s, w) => s + w, 0) + space * (toks.length - 1);
  let x = W / 2 - total / 2;
  toks.forEach((tk, i) => {
    const k = clamp((t - ws[i] + 0.03) / 0.22);
    if (k > 0) {
      g.save();
      g.globalAlpha = a * easeOut(k);
      g.filter = `blur(${(1 - easeOut(k)) * 12}px)`;
      g.font = font(tk.it);
      g.textBaseline = "middle";
      g.shadowColor = "rgba(0,0,0,0.65)";
      g.shadowBlur = 16;
      g.fillStyle = tk.it ? HOT : "#fff";
      g.fillText(tk.w, x, y + (1 - easeOut(k)) * 12);
      g.restore();
    }
    x += widths[i] + space;
  });
}

// ------------------------------------------------------------------ the frame
function beatAt(t) {
  let b = E.timeline[0];
  for (const x of E.timeline) if (t >= x.start) b = x;
  return b;
}
window.renderFrame = async (t) => {
  const tt = Math.min(t, E.duration - 0.001);
  const b = beatAt(Math.min(tt, E.speech_end - 0.001));
  const sc = sceneAt(tt);
  const g = PG;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.filter = "none";
  let count = null;
  if (sc.type === "face" && b.kind === "face") await speaker(g, b, tt);
  else if (sc.type === "heart") count = drawHeart(g, tt).count;
  else if (sc.type === "search") search(g, sc, tt);
  else if (sc.type === "nope") nope(g, sc, tt);
  else if (sc.type === "cards") cards(g, sc, tt);
  else if (sc.type === "pop") { const st = popScene(g, tt); if (st) count = st.count; }
  else { g.fillStyle = "#000"; g.fillRect(0, 0, W, H); }

  // a punch and a short flash on every change of scene
  const since = tt - sc.at;
  const z = 1 + 0.05 * (1 - easeOut(clamp(since / 0.25)));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-W / 2, -H / 2);
  ctx.drawImage(PIC, 0, 0);
  ctx.restore();
  if (since < 0.08 && sc.at > 0.1) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - since / 0.08)})`;
    ctx.fillRect(0, 0, W, H);
  }
  ITEMS.forEach((it, i) => { if (it.type === "burst" && tt >= it.at && tt < it.end) burst(ctx, it, tt, i); });
  if (sc.type === "cards") {} // cards scene draws its own cursor
  // the camcorder HUD on the heart: full in the intro, back for the final countdown
  if (count !== null) {
    const intro = sc.it?.cam === "intro" || last("heart", tt).cam === "intro";
    const fin = last("heart", tt).cam === "final";
    const a = intro ? 1 - clamp((tt - (WATCH_FROM - 0.4)) / 0.4) : fin ? clamp((tt - last("heart", tt).at) / 0.3) : 0;
    hud(ctx, tt, count, a);
  }
  // vignette and grain
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 1.05);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.06;
  ctx.globalCompositeOperation = "overlay";
  ctx.drawImage(GRAIN[Math.floor(tt * 24) % GRAIN.length], 0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // "watching 7.4s": your own watch time, from the moment the voice calls it out
  if (tt >= WATCH_FROM - 0.2) {
    const a = clamp((tt - WATCH_FROM + 0.2) / 0.3);
    ctx.save();
    ctx.globalAlpha = a * 0.92;
    ctx.font = "700 26px Inter";
    const label = `watching ${tt.toFixed(1)}s`;
    const tw = ctx.measureText(label).width + 66;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.roundRect(W / 2 - tw / 2, 42, tw, 50, 25);
    ctx.fill();
    ctx.fillStyle = "#ff3b30";
    ctx.beginPath();
    ctx.arc(W / 2 - tw / 2 + 28, 67, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, W / 2 - tw / 2 + 46, 68);
    ctx.restore();
  }

  // captions
  const finalHud = (sc.type === "heart" && last("heart", tt).cam === "final") || (sc.type === "pop" && tt < POP_T);
  const y = sc.type === "face" ? 930 : sc.type === "pop" && tt >= POP_T ? 820 : finalHud ? 760 : 900;
  E.captions.forEach((c, i) => {
    const next = E.captions[i + 1];
    const end = next && next.s - c.e < 0.3 ? next.s - 0.03 : c.e + 0.25;
    if (t < c.s - 0.05 || t > end) return;
    const a = clamp((end - t) / 0.12);
    caption(ctx, c, t, a, y);
  });
};
window.duration = E.duration;
window.ready = true;
