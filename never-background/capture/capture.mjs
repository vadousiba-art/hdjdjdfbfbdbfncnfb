// Captures the real YORU screens used in "You were never a background
// character": someone shares what they're listening to and two people reply.
// Runs only against a LOCAL demo-mode server with a throwaway embedded
// database (nothing touches production). The three accounts are fictional
// demo users; the film labels these screens "REAL YORU SCREENS · DEMO ACCOUNTS".
//
//   bash capture/server.sh      (fresh local demo server on :3200, normal logo)
//   node capture/capture.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, launch, newCtx, settle } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHOTS = path.join(ROOT, "assets", "screens");
fs.mkdirSync(SHOTS, { recursive: true });

const IDS = {
  rei: {
    name: "REI", user: "rei_underground", status: "3am. city lights. headphones on.",
    bio: "Night walks, loud guitars and too much ramen. 夜は長い。", jokes: ["last train gang", "ramen at 2am"],
    currently: ["listening", "Tokyo night drive mix"],
  },
  kuro: { name: "Kuro", user: "kuro_ink", status: "inking chapter 12 tonight", bio: "Black ink, white paper.", jokes: ["the 4am panel"], currently: ["reading", "Vagabond"] },
  mio: { name: "Mio", user: "mio_studio", status: "", bio: "less, but better.", jokes: [], currently: ["watching", "Frieren"] },
};
const POST = "3am, headphones on, Tokyo night drive mix on repeat 🎧 what do you play when the city goes quiet?";
const REPLIES = [
  ["kuro", "same mix, different city. I ink to it every night"],
  ["mio", "rain sounds + lo-fi. sending you my playlist ✨"],
];

const browser = await launch();
const top = (page) => page.evaluate(() => window.scrollTo(0, 0));

async function session(key) {
  const ctx = await newCtx(browser);
  // The local demo server adds a "DEMO MODE" strip that production never shows.
  await ctx.addInitScript(() => {
    const add = () => {
      const s = document.createElement("style");
      s.textContent = 'div:has(> a[href="/setup"]){display:none !important}';
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.documentElement) add();
    else document.addEventListener("DOMContentLoaded", add, { once: true });
  });
  // Same clock shift as the server (capture/server.sh), so the page renders
  // the normal logo, not the seasonal one.
  await ctx.addInitScript((shift) => {
    const Real = Date;
    class Shifted extends Real {
      constructor(...a) { if (a.length === 0) super(Real.now() + shift); else super(...a); }
      static now() { return Real.now() + shift; }
    }
    Shifted.parse = Real.parse;
    Shifted.UTC = Real.UTC;
    window.Date = Shifted;
  }, 25 * 24 * 3600 * 1000);
  // The welcome film opens once per member; answer "already seen".
  await ctx.route("**/api/rpc/get_welcome_state", (r) => r.fulfill({ json: { data: { seen: 999, account_age_hours: 9999 } } }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${key} page error]`, e.message));
  return page;
}

async function join(page, id) {
  await page.goto(`${BASE}/join/promo`);
  await page.getByLabel("Display name").fill(id.name);
  await page.getByLabel("Username").fill(id.user);
  await page.getByLabel("Email").fill(`${id.user}@example.com`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Join YORU" }).click();
  await page.waitForURL(`${BASE}/`);
  await settle(page, 1200);
}

async function profile(page, key) {
  const id = IDS[key];
  await page.goto(`${BASE}/u/${id.user}`);
  await page.getByRole("button", { name: "Edit" }).click();
  await page.locator('input[type="file"]').setInputFiles(path.join(ROOT, "assets", "avatars", `${key}.png`));
  await page.getByRole("button", { name: "Change avatar" }).locator("img").first().waitFor();
  if (id.status) await page.getByLabel("Status").fill(id.status);
  await page.getByLabel("Bio").fill(id.bio);
  for (const j of id.jokes) {
    await page.getByPlaceholder("the Costco incident").fill(j);
    await page.getByRole("button", { name: "Add", exact: true }).click();
  }
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" }).catch(() => {});
  await page.goto(`${BASE}/settings`);
  await page.getByLabel("App color").waitFor();
  await settle(page, 1800);
  const form = page.locator("form", { has: page.locator(`select[aria-label="Activity"]`) });
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("main").getByLabel("Activity", { exact: true }).selectOption(id.currently[0]);
    await page.getByLabel("Title", { exact: true }).fill(id.currently[1]);
    await form.getByRole("button", { name: "Save" }).click();
    await settle(page, 1500);
    await page.reload();
    await page.getByLabel("App color").waitFor();
    await settle(page, 1500);
    if ((await page.getByLabel("Title", { exact: true }).inputValue()) === id.currently[1]) break;
  }
}

const pages = {};
for (const key of Object.keys(IDS)) {
  pages[key] = await session(key);
  await join(pages[key], IDS[key]);
  await profile(pages[key], key);
  console.log("ready", key);
}

// REI shares what they're listening to.
const rei = pages.rei;
await rei.goto(`${BASE}/`);
await rei.getByRole("button", { name: "Check in for tonight" }).click().catch(() => {});
await settle(rei, 1200);
await rei.getByRole("button", { name: "Create", exact: true }).click();
await rei.getByLabel("Post text").fill(POST);
await rei.getByRole("button", { name: "Post", exact: true }).click();
await settle(rei, 2000);
await rei.goto(`${BASE}/u/${IDS.rei.user}`);
const article = rei.locator("article", { hasText: POST.slice(0, 20) }).first();
await article.waitFor();
await article.getByText(POST.slice(0, 20)).first().click();
await rei.waitForURL(/\/post\//);
const href = new URL(rei.url()).pathname;
console.log("post", href);

await rei.goto(`${BASE}/u/${IDS.rei.user}`);
await top(rei);
await settle(rei, 1800);
await rei.screenshot({ path: path.join(SHOTS, "profile-rei.png") });

// The post page as replies arrive (REI's view).
const shotPost = async (n) => {
  await rei.goto(`${BASE}${href}`);
  await rei.getByPlaceholder("Add a comment...").waitFor();
  await top(rei);
  await settle(rei, 1600);
  await rei.screenshot({ path: path.join(SHOTS, `post-${n}.png`) });
};
await shotPost(0);
for (let i = 0; i < REPLIES.length; i++) {
  const [key, text] = REPLIES[i];
  const p = pages[key];
  await p.goto(`${BASE}${href}`);
  const box = p.getByPlaceholder("Add a comment...");
  await box.fill(text);
  await box.press("Enter");
  await p.getByText(text).first().waitFor();
  await settle(p, 800);
  await shotPost(i + 1);
}
console.log("done");
await browser.close();
