// Renders a talking-head reel (reel/edit.js) in headless Chromium and encodes
// it with ffmpeg, with reel/<project>/audio/reel.wav.
//
//   node reel/render.mjs <project>                -> out/<project>-reel.mp4
//   node reel/render.mjs <project> --stills 2,30  -> out/<project>-stills/
//   node reel/render.mjs <project> --preview      -> out/<project>-reel-preview.mp4 (540x960)

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const OUT = path.join(ROOT, "out");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const PROJECT = args[0] && !args[0].startsWith("--") ? args[0] : "part3";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined,
  args: ["--font-render-hinting=none"],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[page error]", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/reel/index.html?p=${PROJECT}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 180000 });
const shot = () => page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1080, height: 1920 } });

if (opt("--stills", null)) {
  const dir = path.join(OUT, `${PROJECT}-stills`);
  fs.mkdirSync(dir, { recursive: true });
  for (const t of opt("--stills").split(",").map(Number)) {
    await page.evaluate((x) => window.renderFrame(x), t);
    fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.png`), await shot());
  }
  console.log("stills done");
} else {
  const preview = flag("--preview");
  const fps = 30;
  const total = Math.round((await page.evaluate(() => window.duration)) * fps);
  const audio = path.join(HERE, PROJECT, "audio", "reel.wav");
  if (!fs.existsSync(audio) && !preview) throw new Error(`make ${audio} first (python3 reel/audio.py ${PROJECT})`);
  const name = `${PROJECT}-reel${preview ? "-preview" : ""}.mp4`;
  fs.mkdirSync(OUT, { recursive: true });
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    ...(fs.existsSync(audio) ? ["-i", audio] : []),
    ...(preview ? ["-vf", "scale=540:960:flags=lanczos"] : []),
    "-c:v", "libx264", "-preset", preview ? "veryfast" : "slow", "-crf", preview ? "23" : "18",
    ...(preview ? [] : ["-maxrate", "12M", "-bufsize", "24M"]),
    "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(fps),
    ...(fs.existsSync(audio) ? ["-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest"] : []),
    "-movflags", "+faststart", path.join(OUT, name),
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const started = Date.now();
  for (let f = 0; f < total; f++) {
    await page.evaluate((x) => window.renderFrame(x), f / fps);
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`frame ${f}/${total} ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("wrote", path.join(OUT, name));
}
await browser.close();
server.close();
