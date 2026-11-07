// The "breaking out of the feed" edit: YORU's posts on a real Instagram home
// screen, made to look native. Every piece of UI and every letter of text is
// cropped from nextyoru's own screenshots (status bar, header, nav, post
// headers, action icons, captions, timestamp); the posts are golden-hour
// frames with the film's characters, graded like video stills, and the
// characters step out of the post frames over the UI. No like counts: none
// are invented.

import { INK, rng, clamp, lerp } from "../film/manga.js";
import { head, standing, PAL } from "../film/art.js";

const c = document.getElementById("c");
const g = c.getContext("2d");
const W = 1080, H = 2424;
const BG = "rgb(13,16,20)";

const img = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });
const HOME = await img("/poster/ig/home.png");
const POST = await img("/poster/ig/post.png");
const PROF = await img("/poster/ig/profile.png");
const BOKEH = await img("/assets/stock/frames/bokeh/0260.jpg");
const BOKEH2 = await img("/assets/stock/frames/bokeh/0120.jpg");

function crop(src, sx, sy, sw, sh, dx, dy) {
  g.drawImage(src, sx, sy, sw, sh, dx, dy, sw, sh);
}
function canvas(w = W, h = H) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  return cv;
}
function paint(fn, w = W, h = H) {
  const cv = canvas(w, h);
  fn(cv.getContext("2d"));
  return cv;
}
const at = (q, x, y, s, fn) => { q.save(); q.translate(x, y); q.scale(s, s); fn(); q.restore(); };

// ------------------------------------------------------------------ layout (full-res px)
const A = { y: 392, h: 508, sun: [470, 0.5] };  // post A media
const B = { y: 1290, h: 540, sun: [640, 0.38] }; // post B media

// ------------------------------------------------------------------ golden-hour scene
function sky(q, M, { skyline = true, bokeh = BOKEH, seed = 1 } = {}) {
  const { y, h } = M;
  const r = rng(seed);
  const sx = W * M.sun[0] / W, sy = y + h * M.sun[1];
  const hz = y + h * 0.74;
  q.save();
  q.beginPath();
  q.rect(0, y, W, h);
  q.clip();
  const sk = q.createLinearGradient(0, y, 0, y + h);
  sk.addColorStop(0, "#353469");
  sk.addColorStop(0.3, "#7d5a98");
  sk.addColorStop(0.55, "#e9927f");
  sk.addColorStop(0.74, "#ffcf98");
  sk.addColorStop(1, "#f2a079");
  q.fillStyle = sk;
  q.fillRect(0, y, W, h);
  // soft clouds lit from below
  q.filter = "blur(16px)";
  for (let i = 0; i < 9; i++) {
    const cx = r() * W, cy = y + h * (0.12 + r() * 0.4), rw = 160 + r() * 260, rh = 22 + r() * 30;
    const cg = q.createLinearGradient(0, cy - rh, 0, cy + rh);
    cg.addColorStop(0, "rgba(120,90,160,0.55)");
    cg.addColorStop(1, "rgba(255,170,140,0.7)");
    q.fillStyle = cg;
    q.beginPath();
    q.ellipse(cx, cy, rw, rh, 0, 0, Math.PI * 2);
    q.fill();
  }
  q.filter = "none";
  // the sun and its glow
  q.globalCompositeOperation = "screen";
  for (const [rad, a] of [[h * 1.3, 0.55], [h * 0.55, 0.6], [h * 0.16, 0.9]]) {
    const sg = q.createRadialGradient(sx, sy, 0, sx, sy, rad);
    sg.addColorStop(0, `rgba(255,236,200,${a})`);
    sg.addColorStop(1, "rgba(255,200,140,0)");
    q.fillStyle = sg;
    q.fillRect(0, y, W, h);
  }
  // god rays
  q.filter = "blur(10px)";
  for (let i = 0; i < 16; i++) {
    const an = -Math.PI + (i / 16) * Math.PI + (r() - 0.5) * 0.1;
    const wdt = 0.025 + r() * 0.04;
    q.fillStyle = `rgba(255,225,180,${0.05 + r() * 0.07})`;
    q.beginPath();
    q.moveTo(sx, sy);
    q.lineTo(sx + Math.cos(an - wdt) * 2000, sy + Math.sin(an - wdt) * 2000);
    q.lineTo(sx + Math.cos(an + wdt) * 2000, sy + Math.sin(an + wdt) * 2000);
    q.closePath();
    q.fill();
  }
  q.filter = "none";
  q.globalCompositeOperation = "source-over";
  if (skyline) {
    const roofs = (q, x, top, bw) => {
      // stepped tops, water tanks and antennas
      const k = r();
      q.beginPath();
      q.moveTo(x, y + h);
      q.lineTo(x, top);
      if (k < 0.3) { q.lineTo(x + bw * 0.2, top); q.lineTo(x + bw * 0.2, top - 14); q.lineTo(x + bw * 0.7, top - 14); q.lineTo(x + bw * 0.7, top); }
      else if (k < 0.5) { q.lineTo(x + bw / 2, top - 18); }
      q.lineTo(x + bw, top);
      q.lineTo(x + bw, y + h);
      q.closePath();
      q.fill();
      if (r() < 0.35) q.fillRect(x + bw * (0.3 + r() * 0.4), top - 30 - r() * 30, 3, 40);
      if (r() < 0.25) q.fillRect(x + bw * 0.6, top - 12, 18, 12);
    };
    // far city, hazy pink
    q.fillStyle = "rgba(176,112,160,0.55)";
    q.filter = "blur(1.5px)";
    let x = -20;
    while (x < W) {
      const bw = 34 + r() * 66;
      roofs(q, x, hz - h * (0.1 + r() * 0.16), bw);
      x += bw + 2 + r() * 6;
    }
    q.filter = "none";
    const haze = q.createLinearGradient(0, hz - h * 0.3, 0, hz + h * 0.05);
    haze.addColorStop(0, "rgba(255,200,160,0)");
    haze.addColorStop(1, "rgba(255,186,150,0.5)");
    q.fillStyle = haze;
    q.fillRect(0, hz - h * 0.3, W, h * 0.36);
    // near city: deep indigo, sun-lit edges, warm windows
    x = -30;
    while (x < W) {
      const bw = 60 + r() * 120, top = hz - h * (0.08 + r() * 0.2) + h * 0.05;
      if (Math.abs(x + bw / 2 - sx) < 120 && r() < 0.7) { x += bw; continue; } // keep the sun clear
      q.fillStyle = "#2c2448";
      roofs(q, x, top, bw);
      q.fillStyle = "rgba(255,176,120,0.55)";
      q.fillRect(x + (x + bw / 2 < sx ? bw - 3 : 0), top, 3, h); // rim of sunlight on the side facing the sun
      for (let wy = top + 14; wy < y + h; wy += 16) {
        for (let wx = x + 10; wx < x + bw - 10; wx += 15) {
          if (r() < 0.3) {
            q.fillStyle = r() < 0.8 ? "rgba(255,206,128,0.9)" : "rgba(170,210,255,0.8)";
            q.fillRect(wx, wy, 6, 8);
          }
        }
      }
      x += bw + 4 + r() * 10;
    }
    const ground = q.createLinearGradient(0, hz + h * 0.1, 0, y + h);
    ground.addColorStop(0, "rgba(33,26,54,0)");
    ground.addColorStop(1, "rgba(33,26,54,0.85)");
    q.fillStyle = ground;
    q.fillRect(0, hz, W, h);
  }
  // the real city lights from the footage, out of focus
  q.globalCompositeOperation = "screen";
  q.filter = `blur(${skyline ? 3 : 10}px) saturate(1.3)`;
  q.globalAlpha = skyline ? 0.35 : 0.7;
  const s = Math.max(W / bokeh.width, h / bokeh.height) * (skyline ? 1.0 : 1.4);
  q.drawImage(bokeh, (W - bokeh.width * s) / 2, y + (h - bokeh.height * s) / 2 + (skyline ? h * 0.3 : 0), bokeh.width * s, bokeh.height * s);
  q.restore();
}

// Light the characters like the scene: backlit by the sun, cooler below,
// slightly soft like a video frame.
function lit(cv, M, { soft = 0.35, blur = 0 } = {}) {
  const out = canvas();
  const q = out.getContext("2d");
  q.filter = `blur(${soft + blur}px)`;
  q.drawImage(cv, 0, 0);
  q.filter = "none";
  q.globalCompositeOperation = "source-atop";
  const sx = M.sun[0], sy = M.y + M.h * M.sun[1];
  const warm = q.createRadialGradient(sx, sy, 0, sx, sy, M.h * 1.4);
  warm.addColorStop(0, "rgba(255,190,130,0.16)");
  warm.addColorStop(1, "rgba(255,170,120,0.03)");
  q.fillStyle = warm;
  q.fillRect(0, 0, W, H);
  const amb = q.createLinearGradient(0, M.y, 0, M.y + M.h * 1.3);
  amb.addColorStop(0, "rgba(60,30,90,0)");
  amb.addColorStop(1, "rgba(50,25,80,0.18)");
  q.fillStyle = amb;
  q.fillRect(0, 0, W, H);
  return out;
}

// Grade a frame like a video still: gentle contrast, soft bloom, warm
// highlights, fine grain.
function grade(cv) {
  const out = canvas();
  const q = out.getContext("2d");
  q.filter = "contrast(1.08) saturate(1.12)";
  q.drawImage(cv, 0, 0);
  q.filter = "blur(22px) brightness(1.15)";
  q.globalCompositeOperation = "screen";
  q.globalAlpha = 0.13;
  q.drawImage(cv, 0, 0);
  q.globalAlpha = 1;
  q.filter = "none";
  q.globalCompositeOperation = "source-atop";
  q.fillStyle = "rgba(255,170,110,0.04)";
  q.fillRect(0, 0, W, H);
  const d = q.getImageData(0, 0, W, H);
  const r = rng(77);
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 3] === 0) continue;
    const n = (r() - 0.5) * 9;
    d.data[i] += n;
    d.data[i + 1] += n;
    d.data[i + 2] += n;
  }
  q.putImageData(d, 0, 0);
  return out;
}

// ------------------------------------------------------------------ the posts
const skyA = paint((q) => sky(q, A, { seed: 3 }));
const charsA = lit(paint((q) => {
  at(q, 712 - 306 * 0.25, A.y + 34 - 30 * 0.25, 0.25, () => standing(q, { pal: PAL.bob, hair: "bob", eyes: "smile", mouth: "grin", earring: true }));
  at(q, 400 - 306 * 0.29, A.y - 46 - 30 * 0.29, 0.29, () => standing(q, { pal: PAL.hero, headphones: true, eyes: "open", look: [0.35, -0.1], mouth: "soft", brows: "calm", rim: 1 }));
}), A);
const notesA = paint((q) => {
  const note = (x, y, s, color, rot) => {
    q.save();
    q.translate(x, y);
    q.rotate(rot);
    q.scale(s, s);
    q.fillStyle = color;
    q.beginPath();
    q.ellipse(-14, 30, 16, 12, -0.4, 0, Math.PI * 2);
    q.ellipse(34, 20, 16, 12, -0.4, 0, Math.PI * 2);
    q.rect(-2, -34, 6, 64);
    q.rect(46, -44, 6, 64);
    q.moveTo(-2, -34); q.lineTo(52, -44); q.lineTo(52, -30); q.lineTo(-2, -20); q.closePath();
    q.fill();
    q.restore();
  };
  q.shadowColor = "rgba(255,220,180,0.9)";
  q.shadowBlur = 16;
  note(548, A.y - 18, 1.05, "#fff3e2", -0.2);
  note(498, A.y + 95, 0.62, "#ffe0b8", -0.1);
});
const frameA = grade(paint((q) => { q.drawImage(skyA, 0, 0); q.drawImage(charsA, 0, 0); q.drawImage(notesA, 0, 0); }));

const skyB = paint((q) => sky(q, B, { skyline: false, bokeh: BOKEH2, seed: 8 }));
const friendB = lit(paint((q) => at(q, -170, B.y + 70, 0.86, () => head(q, { pal: PAL.curly, hair: "curly", eyes: "smile", mouth: "grin", headset: true, collar: "jacket" }))), B, { blur: 3 });
const heroB = lit(paint((q) => at(q, 610 - 306 * 0.98, B.y - 128 - 30 * 0.98, 0.98, () => head(q, { pal: PAL.hero, headphones: true, eyes: "smile", mouth: "soft", brows: "calm", rim: 1 }))), B, { soft: 0.5 });
const frameB = grade(paint((q) => { q.drawImage(skyB, 0, 0); q.drawImage(friendB, 0, 0); q.drawImage(heroB, 0, 0); }));

// Draw a graded frame through a clip (inside the post, or the part that breaks out).
function piece(cv, rect, { shadow = false } = {}) {
  g.save();
  g.beginPath();
  g.rect(...rect);
  g.clip();
  if (shadow) {
    g.shadowColor = "rgba(0,0,0,0.38)";
    g.shadowBlur = 22;
    g.shadowOffsetY = 8;
  }
  g.drawImage(cv, 0, 0);
  g.restore();
}
// Only the characters' pixels from a graded frame (for the parts outside the post).
function onlyChars(frame, chars) {
  const out = canvas();
  const q = out.getContext("2d");
  q.drawImage(frame, 0, 0);
  q.globalCompositeOperation = "destination-in";
  q.drawImage(chars, 0, 0);
  return out;
}
const outA = onlyChars(frameA, paint((q) => { q.drawImage(charsA, 0, 0); q.drawImage(notesA, 0, 0); }));
const outB = onlyChars(frameB, heroB);

function mute(x, y) {
  g.save();
  g.fillStyle = "rgba(30,30,32,0.78)";
  g.beginPath();
  g.arc(x, y, 30, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fff";
  g.beginPath();
  g.moveTo(x - 14, y - 6); g.lineTo(x - 7, y - 6); g.lineTo(x + 3, y - 15); g.lineTo(x + 3, y + 15); g.lineTo(x - 7, y + 6); g.lineTo(x - 14, y + 6); g.closePath();
  g.fill();
  g.strokeStyle = "#fff";
  g.lineWidth = 3;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x + 9, y - 6); g.lineTo(x + 18, y + 6);
  g.moveTo(x + 18, y - 6); g.lineTo(x + 9, y + 6);
  g.moveTo(x - 16, y - 16); g.lineTo(x + 18, y + 18);
  g.stroke();
  g.restore();
}

// ------------------------------------------------------------------ compose the screen
g.fillStyle = BG;
g.fillRect(0, 0, W, H);

// Post A — its header scrolled half under the top bar
crop(POST, 0, 1415, W, 115, 0, 270);
piece(frameA, [0, A.y, W, A.h]);
mute(1008, A.y + A.h - 50);
crop(POST, 0, 1105, W, 85, 0, A.y + A.h + 8);   // heart · comment · repost · share · save
crop(POST, 0, 1215, W, 155, 0, A.y + A.h + 100); // caption + "30 minutes ago"
piece(outA, [0, A.y + A.h, W, 600], { shadow: true }); // feet step out over the icons
piece(outA, [0, A.y - 200, W, 200], { shadow: true }); // head and a note break the top

// Post B
crop(POST, 0, 1415, W, 115, 0, B.y - 120);
piece(frameB, [0, B.y, W, B.h]);
mute(1008, B.y + B.h - 50);
crop(POST, 0, 1105, W, 85, 0, B.y + B.h + 8);
// caption: "nextyoru" from the real caption + the real bio line, on one baseline
const base = B.y + B.h + 136;
crop(POST, 30, 1215, 160, 50, 33 - 3, base - 36);
crop(PROF, 40, 296, 568, 50, 197 - 3, base - 38);
crop(HOME, 30, 1995, 170, 45, 33 - 4, base + 58 - 30); // "2 days ago"
piece(outB, [0, B.y - 300, W, 300], { shadow: true }); // the head breaks out over the header

// the next post, peeking in
crop(POST, 0, 1415, W, 115, 0, 2098);
crop(HOME, 0, 2203, W, 30, 0, 2213);

// real top bar and nav on top of everything
crop(HOME, 0, 0, W, 318, 0, 0);
crop(HOME, 0, 2233, W, 191, 0, 2233);

window.ready = true;
