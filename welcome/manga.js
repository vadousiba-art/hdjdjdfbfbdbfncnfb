// Procedural manga ink: everything is drawn with Canvas 2D from seeded
// randomness, so a given (seed, t) always produces the same drawing.

export const INK = "#0a0a0a";
export const PAPER = "#f4f2ee";
export const CRIMSON = "#e5102f";

export function rng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash1 = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export function noise1(x) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return (hash1(i) * (1 - u) + hash1(i + 1) * u) * 2 - 1;
}
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ramp = (t, a, b) => clamp((t - a) / (b - a));
export const easeOut = (k) => 1 - Math.pow(1 - k, 3);
export const easeIn = (k) => k * k * k;
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const expoOut = (k) => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k));

// Radial speed lines: tapered wedges aimed at a focal point.
export function radialLines(g, { cx, cy, n = 160, rIn = [260, 520], width = [3, 26], len = 2600, color = INK, seed = 1, alpha = 1, arc = [0, Math.PI * 2] }) {
  const r = rng(seed);
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = arc[0] + ((i + r() * 0.9) / n) * (arc[1] - arc[0]);
    const r0 = rIn[0] + r() * (rIn[1] - rIn[0]);
    const w = width[0] + Math.pow(r(), 2.2) * (width[1] - width[0]);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    g.moveTo(cx + dx * r0, cy + dy * r0);
    g.lineTo(cx + dx * len - dy * w, cy + dy * len + dx * w);
    g.lineTo(cx + dx * len + dy * w, cy + dy * len - dx * w);
    g.closePath();
  }
  g.fill();
  g.restore();
}

// Parallel motion lines across a region, tapered at both ends.
export function motionLines(g, { angle, n = 60, color = INK, seed = 3, width = [1, 7], area = [0, 0, 1080, 1920], len = [300, 1400], alpha = 1, offset = 0 }) {
  const r = rng(seed);
  const [x, y, w, h] = area;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const diag = Math.hypot(w, h);
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const p = (r() - 0.5) * diag;
    const l = len[0] + r() * (len[1] - len[0]);
    const s = ((r() * 2 - 1) * diag) / 2 + offset * (0.6 + r() * 0.8);
    const cx = x + w / 2 - dy * p + dx * s;
    const cy = y + h / 2 + dx * p + dy * s;
    const hw = (width[0] + Math.pow(r(), 2) * (width[1] - width[0])) / 2;
    g.moveTo(cx - dx * l * 0.5, cy - dy * l * 0.5);
    g.lineTo(cx - dy * hw, cy + dx * hw);
    g.lineTo(cx + dx * l * 0.5, cy + dy * l * 0.5);
    g.lineTo(cx + dy * hw, cy - dx * hw);
    g.closePath();
  }
  g.fill();
  g.restore();
}

// An ink explosion: a noisy core with spikes, satellite drops and spatter.
export function inkSplash(g, { cx, cy, R, seed = 5, color = INK, spikes = 22, drops = 46, spatter = 160, k = 1, core = 1 }) {
  const r = rng(seed);
  const sp = [];
  for (let i = 0; i < spikes; i++) sp.push({ a: r() * Math.PI * 2, w: 0.04 + r() * 0.1, l: 0.3 + Math.pow(r(), 1.6) * 1.3 });
  g.save();
  g.fillStyle = color;
  if (core > 0) {
    g.beginPath();
    const N = 260;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      let rad = 0.72 + 0.18 * noise1(a * 2.2 + seed) + 0.08 * noise1(a * 9 + seed * 3);
      for (const s of sp) {
        let d = Math.abs(a - s.a);
        d = Math.min(d, Math.PI * 2 - d);
        const q = Math.max(0, 1 - d / s.w);
        rad += s.l * q * q * q * k;
      }
      const x = cx + Math.cos(a) * rad * R * core;
      const y = cy + Math.sin(a) * rad * R * core;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
  }
  // Satellite drops travel outward along their spike.
  for (let i = 0; i < drops; i++) {
    const s = sp[i % sp.length];
    const a = s.a + (r() - 0.5) * s.w * 1.6;
    const d = R * (1.0 + s.l * (0.6 + r() * 1.1)) * (0.35 + 0.65 * k);
    const rr = R * (0.012 + Math.pow(r(), 2) * 0.07) * (1.2 - Math.min(1, d / (R * 3)) * 0.6);
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    g.beginPath();
    g.ellipse(x, y, rr * (1.4 + r()), rr, a, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < spatter; i++) {
    const a = r() * Math.PI * 2;
    const d = R * (0.9 + Math.pow(r(), 0.7) * 2.6) * (0.3 + 0.7 * k);
    const rr = 0.8 + Math.pow(r(), 3) * R * 0.018;
    g.beginPath();
    g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rr, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// Catmull-Rom through control points -> dense polyline.
function spline(pts, M) {
  const out = [];
  const n = pts.length - 1;
  for (let i = 0; i <= M; i++) {
    const u = (i / M) * n;
    const k = Math.min(n - 1, Math.floor(u));
    const f = u - k;
    const p0 = pts[Math.max(0, k - 1)];
    const p1 = pts[k];
    const p2 = pts[k + 1];
    const p3 = pts[Math.min(n, k + 2)];
    const c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f * f + (-a + 3 * b - 3 * cc + d) * f * f * f);
    out.push([c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]);
  }
  return out;
}

// A dry-brush stroke built from individual bristles.
export function brushStroke(g, { pts, width, seed = 9, color = INK, bristles = 90, dry = 0.55, progress = 1, M = 140, taper = 0.35, alpha = 1, core = 0, coreEnd = 0.6, thin = 1 }) {
  const r = rng(seed);
  const path = spline(pts, M);
  const nrm = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
  const wAt = (s) => width * Math.sin((Math.PI / 2) * Math.min(1, s * 6 + 0.15)) * (1 - taper * s);
  const last = Math.floor(progress * M);
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.lineCap = "round";
  // Solid ink body with a ragged edge, under the bristles.
  if (core > 0) {
    const n = Math.min(last, Math.floor(coreEnd * M));
    if (n > 1) {
      g.fillStyle = color;
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const s = i / M;
        const w = (wAt(s) / 2) * core * (1 + 0.05 * noise1(s * 50 + seed) - 0.25 * Math.pow(s / coreEnd, 3));
        const x = path[i][0] + nrm[i][0] * w;
        const y = path[i][1] + nrm[i][1] * w;
        i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      for (let i = n; i >= 0; i--) {
        const s = i / M;
        const w = (wAt(s) / 2) * core * (1 + 0.05 * noise1(s * 50 + seed + 9) - 0.25 * Math.pow(s / coreEnd, 3));
        g.lineTo(path[i][0] - nrm[i][0] * w, path[i][1] - nrm[i][1] * w);
      }
      g.closePath();
      g.fill();
    }
  }
  for (let b = 0; b < bristles; b++) {
    const o = (r() + r() - 1) * 1.0;
    const thick = (width / bristles) * (1.6 + r() * 1.8) * thin;
    const end = 1 - dry * Math.pow(r(), 1.3) * (Math.abs(o) * 0.8 + 0.2);
    const seedB = r() * 100;
    g.lineWidth = thick;
    g.beginPath();
    let pen = false;
    for (let i = 0; i <= Math.min(last, M); i++) {
      const s = i / M;
      if (s > end) break;
      // Dry-brush breaks grow toward the tail.
      const gap = noise1(s * 26 + seedB) > 1.15 - s * dry * 1.4;
      const w = wAt(s) / 2;
      const x = path[i][0] + nrm[i][0] * o * w;
      const y = path[i][1] + nrm[i][1] * o * w;
      if (gap) {
        pen = false;
        continue;
      }
      if (!pen) {
        g.moveTo(x, y);
        pen = true;
      } else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
}

// Halftone screentone; f(x, y) returns ink coverage 0..1.
export function halftone(g, { x = 0, y = 0, w = 1080, h = 1920, cell = 16, angle = Math.PI / 4, f, color = INK, alpha = 1 }) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const R = Math.hypot(w, h) / 2 + cell;
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  for (let v = -R; v <= R; v += cell) {
    for (let u = -R; u <= R; u += cell) {
      const px = cx + u * ca - v * sa;
      const py = cy + u * sa + v * ca;
      if (px < x - cell || px > x + w + cell || py < y - cell || py > y + h + cell) continue;
      const c = f(px, py);
      if (c <= 0.01) continue;
      const rad = cell * 0.5 * Math.sqrt(Math.min(1, c)) * 1.18;
      g.moveTo(px + rad, py);
      g.arc(px, py, rad, 0, Math.PI * 2);
    }
  }
  g.fill();
  g.restore();
}

// Spiky starburst polygon.
export function starburst(g, { cx, cy, rin, rout, n = 28, seed = 11, color = "#fff" }) {
  const r = rng(seed);
  g.save();
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + (r() - 0.5) * 0.08;
    const rad = i % 2 === 0 ? rout * (0.55 + r() * 0.45) : rin * (0.8 + r() * 0.3);
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  g.restore();
}

// Split a convex polygon by a line through p with direction d.
function splitPoly(poly, p, d) {
  const side = (q) => (q[0] - p[0]) * d[1] - (q[1] - p[1]) * d[0];
  const a = [];
  const b = [];
  for (let i = 0; i < poly.length; i++) {
    const q = poly[i];
    const r2 = poly[(i + 1) % poly.length];
    const s1 = side(q);
    const s2 = side(r2);
    (s1 >= 0 ? a : b).push(q);
    if (s1 * s2 < 0) {
      const t = s1 / (s1 - s2);
      const x = [q[0] + (r2[0] - q[0]) * t, q[1] + (r2[1] - q[1]) * t];
      a.push(x);
      b.push(x);
    }
  }
  return [a, b].filter((pp) => pp.length >= 3);
}
// Fracture a polygon into shards by recursive random cuts.
export function fracture(poly, seed, depth = 4, bias = null) {
  const r = rng(seed);
  let parts = [poly];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const pp of parts) {
      const c = centroid(pp);
      const a = bias != null ? bias + (r() - 0.5) * 1.4 : r() * Math.PI;
      const p = [c[0] + (r() - 0.5) * 40, c[1] + (r() - 0.5) * 40];
      next.push(...splitPoly(pp, p, [Math.cos(a), Math.sin(a)]));
    }
    parts = next;
  }
  return parts;
}
export function centroid(poly) {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p[0];
    y += p[1];
  }
  return [x / poly.length, y / poly.length];
}
export function polyPath(g, poly, tx = 0, ty = 0, rot = 0, sc = 1, pivot = null) {
  const c = pivot || centroid(poly);
  const ca = Math.cos(rot);
  const sa = Math.sin(rot);
  g.beginPath();
  poly.forEach((p, i) => {
    const x = (p[0] - c[0]) * sc;
    const y = (p[1] - c[1]) * sc;
    const X = c[0] + x * ca - y * sa + tx;
    const Y = c[1] + x * sa + y * ca + ty;
    i === 0 ? g.moveTo(X, Y) : g.lineTo(X, Y);
  });
  g.closePath();
}
export function shrinkPoly(poly, amt) {
  const c = centroid(poly);
  return poly.map((p) => {
    const dx = p[0] - c[0];
    const dy = p[1] - c[1];
    const l = Math.hypot(dx, dy) || 1;
    return [p[0] - (dx / l) * amt, p[1] - (dy / l) * amt];
  });
}

// The brand motif drawn as ink: a crimson crescent (cached per radius).
const crescentCache = new Map();
export function crescent(g, { cx, cy, r, color = CRIMSON, alpha = 1, rot = 0 }) {
  const key = `${Math.round(r)}|${color}`;
  let cv = crescentCache.get(key);
  if (!cv) {
    cv = document.createElement("canvas");
    const s = Math.ceil(r * 2 + 8);
    cv.width = s;
    cv.height = s;
    const c = cv.getContext("2d");
    c.fillStyle = color;
    c.beginPath();
    c.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = "destination-out";
    c.beginPath();
    c.arc(s / 2 + r * 0.36, s / 2 - r * 0.12, r * 0.84, 0, Math.PI * 2);
    c.fill();
    crescentCache.set(key, cv);
  }
  g.save();
  g.globalAlpha = alpha;
  g.translate(cx, cy);
  g.rotate(rot);
  g.drawImage(cv, -cv.width / 2, -cv.height / 2);
  g.restore();
}

// An ensō: a single brush circle with a dry tail.
export function enso(g, { cx, cy, r, width = 60, seed = 21, color = INK, progress = 1, start = -2.2, sweep = 5.7, bristles = 110 }) {
  const pts = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * sweep;
    const rr = r * (1 + 0.025 * Math.sin(i * 1.7 + seed));
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  brushStroke(g, { pts, width, seed, color, bristles, dry: 0.7, progress, taper: 0.45, M: 220 });
}

// Torn paper edge: a jagged polyline between two points, with fibre fringe.
export function tornEdgePoly(a, b, seed, rough = 18, steps = 60) {
  const r = rng(seed);
  const pts = [];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  const nx = -dy / l;
  const ny = dx / l;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const o = (noise1(s * 9 + seed) * 0.6 + (r() - 0.5) * 0.8) * rough;
    pts.push([a[0] + dx * s + nx * o, a[1] + dy * s + ny * o]);
  }
  return pts;
}

// Thick ink panel border with slightly irregular corners.
export function panelBorder(g, poly, { width = 10, color = INK } = {}) {
  g.save();
  g.lineJoin = "miter";
  g.strokeStyle = color;
  g.lineWidth = width;
  polyPath(g, poly, 0, 0, 0, 1, [0, 0]);
  g.stroke();
  g.restore();
}
