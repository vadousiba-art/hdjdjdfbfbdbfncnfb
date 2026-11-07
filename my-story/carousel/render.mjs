// Renders the carousel slides (PNG, 1080x1440) and the video version
// (1080x1920 MP4 with carousel/audio/song.wav) in headless Chromium.
//
//   node carousel/render.mjs --slides          -> out/carousel/01.png …
//   node carousel/render.mjs                   -> out/story-slides.mp4
//   node carousel/render.mjs --stills 3,40.5   -> out/carousel-stills/
//   node carousel/render.mjs --preview         -> out/story-slides-preview.mp4 (540x960, no audio needed)
//   add --set slides-part2 to any of these for another story (carousel/slides-part2.json):
//   out/carousel-part2/, out/story-slides-part2.mp4, carousel/audio/song-part2.wav

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
const SET = opt("--set", "slides");
const TAG = SET === "slides" ? "" : `-${SET.replace(/^slides-/, "")}`;

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
await page.goto(`http://127.0.0.1:${server.address().port}/carousel/index.html?set=${SET}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
const shot = (h) => page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1080, height: h } });

if (flag("--slides")) {
  const dir = path.join(OUT, `carousel${TAG}`);
  fs.mkdirSync(dir, { recursive: true });
  const n = await page.evaluate(() => window.slideCount);
  for (let i = 0; i < n; i++) {
    await page.evaluate((x) => window.renderSlide(x), i);
    fs.writeFileSync(path.join(dir, `${String(i + 1).padStart(2, "0")}.png`), await shot(1440));
  }
  console.log(`wrote ${n} slides to out/carousel${TAG}/`);
} else if (opt("--stills", null)) {
  const dir = path.join(OUT, `carousel${TAG}-stills`);
  fs.mkdirSync(dir, { recursive: true });
  for (const t of opt("--stills").split(",").map(Number)) {
    await page.evaluate((x) => window.renderFrame(x), t);
    fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.png`), await shot(1920));
  }
  console.log("stills done");
} else {
  const preview = flag("--preview");
  const fps = 30;
  const dur = await page.evaluate(() => window.duration);
  const total = Math.round(dur * fps);
  const audio = path.join(HERE, "audio", `song${TAG}.wav`);
  const withAudio = fs.existsSync(audio);
  if (!withAudio && !preview) throw new Error(`make carousel/audio/song${TAG}.wav first`);
  const name = `story-slides${TAG}${preview ? "-preview" : ""}.mp4`;
  fs.mkdirSync(OUT, { recursive: true });
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    ...(withAudio ? ["-i", audio] : []),
    ...(preview ? ["-vf", "scale=540:960:flags=lanczos"] : []),
    "-c:v", "libx264", "-preset", preview ? "veryfast" : "slow", "-crf", preview ? "23" : "18",
    ...(preview ? [] : ["-maxrate", "12M", "-bufsize", "24M"]),
    "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(fps),
    ...(withAudio ? ["-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest"] : []),
    "-movflags", "+faststart", path.join(OUT, name),
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const started = Date.now();
  for (let f = 0; f < total; f++) {
    await page.evaluate((x) => window.renderFrame(x), f / fps);
    const buf = await shot(1920);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`frame ${f}/${total} ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("wrote", path.join(OUT, name), withAudio ? "(with audio)" : "(no audio)");
}
await browser.close();
server.close();
