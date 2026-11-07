// Renders the feed pop-out edit to out/yoru-feed-popout.png (1080x2424).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return res.writeHead(404).end();
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream", "Cache-Control": "no-store" });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
const page = await browser.newPage({ viewport: { width: 1080, height: 2424 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("[page error]", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/poster/feed.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });
const out = path.join(ROOT, "out", "yoru-feed-popout.png");
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1080, height: 2424 } });
console.log("wrote", out);
await browser.close();
server.close();
