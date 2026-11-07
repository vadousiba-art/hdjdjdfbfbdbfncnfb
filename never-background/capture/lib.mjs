// Shared Playwright helpers for capturing the real app (local demo mode only).
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const { chromium } = require("playwright");
export const BASE = process.env.YORU_BASE || "http://localhost:3200";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("Captures only run against a local demo server.");
// A modern phone: 400x866 CSS px at 2.7x = 1080x2338 (19.5:9).
export const PHONE = { viewport: { width: 400, height: 866 }, deviceScaleFactor: 2.7, isMobile: true, hasTouch: true };
let ip = 40;
export async function launch() {
  return chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
}
export async function newCtx(browser) {
  const ctx = await browser.newContext({ ...PHONE, colorScheme: "dark" });
  await ctx.setExtraHTTPHeaders({ "x-forwarded-for": `10.9.0.${ip++}` });
  return ctx;
}
export const settle = (page, ms = 900) => page.waitForTimeout(ms);
