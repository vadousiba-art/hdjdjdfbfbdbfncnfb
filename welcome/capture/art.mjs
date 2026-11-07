// Draws original artwork for the demo cast's posts (no third-party art).
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": p.endsWith(".js") ? "text/javascript" : "text/html" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
fs.writeFileSync(path.join(ROOT, "capture", "art.html"), `<!doctype html><meta charset="utf-8"><script type="module">
import * as M from "/manga.js";
const W = 1080, H = 1350;
const make = (fn) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); fn(g); return c.toDataURL("image/png"); };
window.out = {
  // Kuro: an ink splash page — a lone figure under a crimson moon.
  moon: make((g) => {
    g.fillStyle = M.PAPER; g.fillRect(0, 0, W, H);
    M.halftone(g, { w: W, h: H, cell: 14, f: (x, y) => 0.6 * M.clamp(1 - y / 900) });
    M.crescent(g, { cx: 700, cy: 380, r: 230, rot: -0.4 });
    M.motionLines(g, { angle: -0.08, n: 40, area: [0, 760, W, 300], width: [1, 4], seed: 12, alpha: 0.55 });
    g.fillStyle = M.INK;
    g.beginPath(); g.moveTo(0, 1100); g.lineTo(260, 1040); g.lineTo(520, 1080); g.lineTo(820, 1010); g.lineTo(W, 1060); g.lineTo(W, H); g.lineTo(0, H); g.fill();
    g.beginPath(); g.ellipse(430, 980, 26, 30, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(400, 1010); g.lineTo(462, 1010); g.lineTo(492, 1150); g.lineTo(372, 1150); g.fill();
    M.brushStroke(g, { pts: [[120, 1230], [520, 1200], [980, 1250]], width: 46, seed: 31, bristles: 120 });
    M.panelBorder(g, [[24, 24], [W - 24, 24], [W - 24, H - 24], [24, H - 24]], { width: 14 });
  }),
  // REI: a night street rendered as a manga panel with speed lines.
  city: make((g) => {
    g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, W, H);
    M.radialLines(g, { cx: 540, cy: 560, n: 180, rIn: [180, 420], width: [1, 10], color: "#262626", seed: 8 });
    const rnd = M.rng(4);
    for (let i = 0; i < 16; i++) {
      const x = i * 72 - 20, h = 380 + rnd() * 520, w = 64 + rnd() * 30;
      g.fillStyle = i % 5 === 2 ? "#1a0408" : "#141414"; g.fillRect(x, H - h, w, h);
      g.fillStyle = "rgba(244,242,238,0.55)";
      for (let y = H - h + 24; y < H - 40; y += 38) for (let k = 0; k < 3; k++) if (rnd() > 0.55) g.fillRect(x + 10 + k * 18, y, 8, 14);
    }
    g.fillStyle = M.CRIMSON; g.fillRect(0, 980, W, 6);
    M.brushStroke(g, { pts: [[80, 300], [560, 250], [1010, 330]], width: 60, seed: 44, color: M.CRIMSON, bristles: 140 });
    M.panelBorder(g, [[24, 24], [W - 24, 24], [W - 24, H - 24], [24, H - 24]], { width: 14, color: "#f4f2ee" });
  }),
  // Mio: a quiet sketchbook enso on paper.
  enso: make((g) => {
    g.fillStyle = "#f6f3ef"; g.fillRect(0, 0, W, H);
    M.enso(g, { cx: 540, cy: 640, r: 340, width: 96, seed: 7, bristles: 180 });
    g.fillStyle = M.CRIMSON; g.fillRect(860, 1080, 90, 90);
    g.fillStyle = "#f6f3ef"; g.font = "bold 58px serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("夜", 905, 1128);
  }),
};
window.done = true;
</script>`);
const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("[page error]", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/capture/art.html`);
await page.waitForFunction(() => window.done === true);
const out = await page.evaluate(() => window.out);
for (const [k, v] of Object.entries(out)) fs.writeFileSync(path.join(ROOT, "assets", "art", `${k}.png`), Buffer.from(v.split(",")[1], "base64"));
console.log("art:", Object.keys(out).join(", "));
await browser.close();
server.close();
