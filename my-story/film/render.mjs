// Renders the founder story frame by frame in headless
// Chromium (Canvas 2D) and encodes it with ffmpeg.
//
//   node film/render.mjs                 1080x1920 MP4 -> out/my-story.mp4
//   node film/render.mjs --preview       540x960 MP4 -> out/preview.mp4
//   node film/render.mjs --stills 3,9.5  PNG stills -> out/stills/
//   node film/render.mjs --cover         cover frame -> out/cover.png
//   node film/render.mjs --sheet         character sheet -> out/sheet.png

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const FILM = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(FILM, "..");
const OUT = path.join(ROOT, "out");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);

const preview = flag("--preview");
const stills = opt("--stills", null);
const cuesPath = path.join(FILM, "cues.json");
const cues = fs.existsSync(cuesPath) ? JSON.parse(fs.readFileSync(cuesPath, "utf8")) : { fps: 30, duration: 25 };
const fps = cues.fps;
const total = Math.round(cues.duration * fps);
const from = Number(opt("--from", 0));
const to = Number(opt("--to", cues.duration));

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined,
  args: ["--font-render-hinting=none"],
});
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && console.log(`[page ${m.type()}]`, m.text()));
page.on("pageerror", (e) => console.log("[page error]", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/film/index.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
const shot = () => page.screenshot({ type: "png", clip: { x: 0, y: 0, width: 1080, height: 1920 } });

if (flag("--sheet")) {
  await page.evaluate(() => window.renderSheet());
  fs.writeFileSync(path.join(OUT, "sheet.png"), await shot());
  console.log("wrote out/sheet.png");
} else if (flag("--cover")) {
  await page.evaluate(() => window.renderCover());
  fs.writeFileSync(path.join(OUT, "cover.png"), await shot());
  console.log("wrote out/cover.png");
} else if (stills) {
  const dir = path.join(OUT, "stills");
  fs.mkdirSync(dir, { recursive: true });
  for (const t of stills.split(",").map(Number)) {
    await page.evaluate((x) => window.renderFrame(x), t);
    fs.writeFileSync(path.join(dir, `t${t.toFixed(2)}.png`), await shot());
  }
  console.log("stills", stills);
} else {
  const audio = path.join(FILM, "audio", "story.wav");
  const name = preview ? "preview.mp4" : "my-story.mp4";
  const f0 = Math.round(from * fps);
  const f1 = Math.min(total, Math.round(to * fps));
  const withAudio = fs.existsSync(audio) && f0 === 0 && f1 === total;
  if (!withAudio && !preview) throw new Error("final renders need the full range and the audio (use --preview for parts)");
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    ...(withAudio ? ["-i", audio] : []),
    ...(preview ? ["-vf", "scale=540:960:flags=lanczos"] : []),
    "-c:v", "libx264", "-preset", preview ? "veryfast" : "slow", "-crf", preview ? "22" : "18",
    ...(preview ? [] : ["-maxrate", "14M", "-bufsize", "28M"]),  // film grain is costly; keep the file phone-friendly
    "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", String(fps),
    ...(withAudio ? ["-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-shortest"] : []),
    "-movflags", "+faststart", path.join(OUT, name),
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const started = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate((x) => window.renderFrame(x), f / fps);
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 60 === 0) console.log(`frame ${f}/${f1} ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("wrote", path.join(OUT, name), withAudio ? "(with audio)" : "(no audio)");
}
await browser.close();
server.close();
