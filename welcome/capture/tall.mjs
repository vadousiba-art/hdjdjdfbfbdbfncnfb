// Re-captures the scrolling home feed without its fixed header and bottom bar
// (the film draws those from p-home on top, like the app while scrolling).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "http://localhost:3200";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 400, height: 866 }, deviceScaleFactor: 2.7, isMobile: true, hasTouch: true, colorScheme: "dark" });
await ctx.setExtraHTTPHeaders({ "x-forwarded-for": "10.8.1.9" });
await ctx.addInitScript(() => {
  try { localStorage.setItem("yoru-release-seen", "2.0"); localStorage.setItem("yoru-welcome-seen", "999"); } catch {}
  const add = () => {
    const s = document.createElement("style");
    s.textContent = 'div:has(> a[href="/setup"]){display:none !important}';
    (document.head || document.documentElement).appendChild(s);
  };
  if (document.documentElement) add(); else document.addEventListener("DOMContentLoaded", add, { once: true });
});
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.getByRole("button", { name: /REI/ }).first().click();
await page.waitForURL(`${BASE}/`);
await page.waitForTimeout(1800);
const bars = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.position === "sticky") {
      const r = el.getBoundingClientRect();
      if (r.width > 300 && r.height > 20) out.push({ top: Math.round(r.top), h: Math.round(r.height), pos: cs.position });
      el.style.visibility = "hidden";
    }
  }
  return out;
});
console.log("fixed/sticky bars (css px):", JSON.stringify(bars));
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(ROOT, "assets", "screens", "p-home-tall.png"), fullPage: true });
fs.writeFileSync(path.join(ROOT, "assets", "screens", "p-home-bars.json"), JSON.stringify({ dpr: 2.7, bars }));
await browser.close();
