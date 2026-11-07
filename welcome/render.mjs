// Renders the welcome film frame by frame in headless Chromium and encodes it
// with ffmpeg.
//
//   node render.mjs --o land|port --cut full|short           master MP4 -> out/
//   node render.mjs --o port --cut full --stills 3,9.5,40     PNG stills -> out/stills/
//   node render.mjs ... --scale 0.5                           half-size preview
//
// The timeline is ../src/lib/welcome/cues.json (shared with the app's captions).

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CUES = path.resolve(ROOT, "..", "src", "lib", "welcome", "cues.json");
const OUT = path.join(ROOT, "out");
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const orient = opt("--o", "land");
const cut = opt("--cut", "full");
const stills = opt("--stills", null);
const scale = Number(opt("--scale", 1));
const from = Number(opt("--from", 0));
const cues = JSON.parse(fs.readFileSync(CUES, "utf8"));
const fps = cues.fps;
const duration = cues.cuts[cut].duration;
const to = Number(opt("--to", duration));
const W = orient === "port" ? 1080 : 1920;
const H = orient === "port" ? 1920 : 1080;

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const p = url === "/cues.json" ? CUES : path.join(ROOT, url);
  if (!(p === CUES || p.startsWith(ROOT)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined,
  args: ["--font-render-hinting=none", "--disable-gpu-vsync"],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
page.on("console", (m) => m.type() === "error" && console.log("[page]", m.text()));
page.on("pageerror", (e) => console.log("[page error]", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/index.html?o=${orient}&cut=${cut}`);
await page.waitForFunction(() => window.ready === true || window.filmError, null, { timeout: 180000 });
const err = await page.evaluate(() => window.filmError);
if (err) throw new Error(err);
const shot = () => page.screenshot({ type: "png", clip: { x: 0, y: 0, width: W, height: H } });

if (stills) {
  const dir = path.join(OUT, "stills");
  fs.mkdirSync(dir, { recursive: true });
  for (const t of stills.split(",").map(Number)) {
    await page.evaluate((x) => window.renderFrame(x), t);
    const f = path.join(dir, `${cut}-${orient}-t${t.toFixed(2)}.png`);
    fs.writeFileSync(f, await shot());
    console.log("still", f);
  }
} else {
  const audio = path.join(ROOT, "audio", `welcome-${cut}.wav`);
  const name = path.join(OUT, `yoru-welcome-${cut}-${orient}${scale !== 1 ? "-preview" : ""}.mp4`);
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
  const withAudio = fs.existsSync(audio) && f0 === 0 && f1 === Math.round(duration * fps);
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(fps), "-i", "-",
    ...(withAudio ? ["-i", audio] : []),
    "-vf", `scale=${Math.round(W * scale)}:${Math.round(H * scale)}:flags=lanczos,format=yuv420p`,
    "-c:v", "libx264", "-preset", "slow", "-crf", scale !== 1 ? "24" : "14", "-tune", "film",
    ...(withAudio ? ["-c:a", "aac", "-b:a", "256k", "-shortest"] : []),
    "-movflags", "+faststart", name,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await page.evaluate((x) => window.renderFrame(x), f / fps);
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 150 === 0) console.log(`frame ${f}/${f1} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("wrote", name, withAudio ? "(with audio)" : "(no audio)");
}
await browser.close();
server.close();
