// Builds the welcome film's demo scenes through the app's real flows on a
// LOCAL demo-mode server (embedded database; nothing touches production) and
// captures phone (1080x2338) and desktop (2160x1350) screenshots.
//
//   welcome/capture/server.sh            # fresh demo server on :3200
//   node welcome/capture/capture.mjs     # -> welcome/assets/screens/
//
// The demo cast is fictional and drawn in code (assets/avatars, assets/art).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.YORU_BASE || "http://localhost:3200";
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error("Captures only run against a local demo server.");
const OUT = path.join(ROOT, "assets", "screens");
fs.mkdirSync(OUT, { recursive: true });

const PHONE = { viewport: { width: 400, height: 866 }, deviceScaleFactor: 2.7, isMobile: true, hasTouch: true };
const DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 };

const CAST = [
  { key: "rei", name: "REI", user: "rei_underground", status: "3am. city lights. headphones on.", bio: "Night walks, loud guitars and too much ramen. 夜は長い。",
    interests: ["jrock", "music", "anime", "vocaloid"], creator: "musician", locale: null },
  { key: "kuro", name: "Kuro", user: "kuro_ink", status: "inking chapter 12 tonight", bio: "Black ink, white paper. One short manga a month.",
    interests: ["anime", "jrock", "music", "manga", "art"], creator: "artist", locale: "ja" },
  { key: "mio", name: "Mio", user: "mio_studio", status: "sketchbook + tea", bio: "less, but better.",
    interests: ["anime", "music", "vocaloid", "art", "cosplay"], creator: "artist", locale: "fr" },
  { key: "gremlin", name: "GREMLIN.EXE", user: "gremlin_exe", status: "touching grass (failed)", bio: "professional lurker. certified hot-take dispenser.",
    interests: ["anime", "vocaloid", "gaming", "memes", "vtubers"], creator: null, locale: "es" },
];

const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
let ip = 60;
async function context(opts = PHONE) {
  const ctx = await browser.newContext({ ...opts, colorScheme: "dark" });
  await ctx.setExtraHTTPHeaders({ "x-forwarded-for": `10.8.0.${ip++}` });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("yoru-release-seen", "2.0");
      localStorage.setItem("yoru-welcome-seen", "999");
    } catch {}
    const add = () => {
      const s = document.createElement("style");
      // The local demo server shows a "DEMO MODE" strip that production never shows.
      s.textContent = 'div:has(> a[href="/setup"]){display:none !important}';
      (document.head || document.documentElement).appendChild(s);
    };
    if (document.documentElement) add();
    else document.addEventListener("DOMContentLoaded", add, { once: true });
  });
  return ctx;
}
const settle = (page, ms = 900) => page.waitForTimeout(ms);
async function rpc(page, fn, args = {}) {
  return page.evaluate(
    async ([fn, args]) => {
      const r = await fetch(`/api/rpc/${fn}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args) });
      const j = await r.json().catch(() => null);
      if (!r.ok) throw new Error(`${fn}: ${JSON.stringify(j?.error ?? j)}`);
      return j?.data;
    },
    [fn, args],
  );
}

async function join(page, c) {
  await page.goto(`${BASE}/join/welcome`);
  await page.getByLabel("Display name").fill(c.name);
  await page.getByLabel("Username").fill(c.user);
  await page.getByLabel("Email").fill(`${c.user}@example.com`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Join YORU" }).click();
  await page.waitForURL(`${BASE}/`);
  await settle(page, 800);
}

async function editProfile(page, c) {
  await page.goto(`${BASE}/u/${c.user}`);
  await page.getByRole("button", { name: "Edit" }).click();
  await page.locator('input[type="file"]').first().setInputFiles(path.join(ROOT, "assets", "avatars", `${c.key}.png`));
  await page.getByRole("button", { name: "Change avatar" }).locator("img").first().waitFor();
  await page.getByLabel("Status").fill(c.status);
  await page.getByLabel("Bio").fill(c.bio);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached" }).catch(() => {});
  await settle(page, 600);
}

async function imagePost(page, text, art) {
  await page.goto(`${BASE}/`);
  await page.locator('input[type=file][accept^="image"]').first().setInputFiles(path.join(ROOT, "assets", "art", `${art}.png`));
  await page.getByAltText("Upload preview").waitFor();
  await page.getByLabel("Post text").fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await page.locator("article", { hasText: text.slice(0, 30) }).first().waitFor();
  await settle(page, 500);
}

// ------------------------------------------------------------------ setup
const pages = {};
for (const c of CAST) {
  const ctx = await context();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${c.key} page error]`, e.message));
  await join(page, c);
  await editProfile(page, c);
  await rpc(page, "update_my_identity", { p: { interests: c.interests, ...(c.locale ? { locale: c.locale } : {}) } });
  if (c.creator) {
    await rpc(page, "apply_creator", {
      p_category: c.creator,
      p_portfolio_url: `https://example.com/${c.user}`,
      p_statement: "Original work posted every week, all made by me.",
    });
  }
  c.id = (await rpc(page, "get_me")).id;
  pages[c.key] = page;
  console.log("joined", c.user);
}

// Owner (seeded demo account) approves creators and grants REI complimentary Pro.
{
  const ctx = await context();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /Ari/ }).first().click();
  await page.waitForURL(`${BASE}/`);
  for (const a of await rpc(page, "admin_creator_queue", { p_status: "pending" })) {
    await rpc(page, "admin_review_creator", { p_application_id: a.id, p_approve: true, p_note: "" });
  }
  await rpc(page, "admin_grant_pro", { p_user: CAST[0].id, p_days: 30, p_note: "welcome film" });
  await ctx.close();
  console.log("creators approved, Pro granted");
}

const P = Object.fromEntries(CAST.map((c) => [c.key, pages[c.key]]));
await imagePost(P.mio, "Slow Sunday. Tea, sketchbook, one circle at a time. #art", "enso");
await rpc(P.gremlin, "create_post", { p_body: "3am and the group chat is still going. this is the place.", p_poll_options: null });
await rpc(P.rei, "create_post", { p_body: "Night playlist check: what are you looping right now? #music", p_poll_options: ["Vocaloid", "City pop", "J-rock", "Lo-fi beats"] });
await imagePost(P.rei, "Walked home the long way tonight. The city looks better after dark. #photography", "city");
await imagePost(P.kuro, "Splash page for chapter 12 is done. Pure ink, one red. #manga", "moon");

// Reactions, comments and a vote, so the feed looks lived in.
const feed = await rpc(P.rei, "get_feed", { p_mode: "latest", p_limit: 10 });
const byText = (t) => feed.find((p) => (p.body || "").includes(t));
const kuroPost = byText("chapter 12"), reiPost = byText("long way"), mioPost = byText("Slow Sunday"), poll = byText("Night playlist");
for (const [who, post, kind] of [["rei", kuroPost, "fire"], ["mio", kuroPost, "heart"], ["gremlin", kuroPost, "skull"], ["kuro", reiPost, "heart"], ["mio", reiPost, "fire"], ["rei", mioPost, "heart"], ["kuro", mioPost, "heart"]]) {
  await rpc(P[who], "toggle_reaction", { p_post_id: post.id, p_kind: kind }).catch((e) => console.log("react", e.message));
}
await rpc(P.rei, "add_comment", { p_post_id: kuroPost.id, p_body: "that red moon goes so hard" });
await rpc(P.mio, "add_comment", { p_post_id: kuroPost.id, p_body: "the halftone sky!! framing this" });
for (const [who, opt] of [["kuro", 0], ["mio", 1], ["gremlin", 0], ["rei", 2]]) {
  await rpc(P[who], "vote_poll", { p_post_id: poll.id, p_option_id: poll.poll.options[opt].id }).catch((e) => console.log("vote", e.message));
}

// A group chat for the four of them.
const chan = await rpc(P.rei, "create_channel", { p_name: "Night Owls", p_emoji: "🌙", p_description: "for the 3am crowd", p_is_private: false, p_member_ids: CAST.slice(1).map((c) => c.id) });
const chanId = chan?.id ?? chan;
for (const [who, msg] of [
  ["kuro", "chapter 12 is up, be honest"],
  ["mio", "the splash page?? instant favourite"],
  ["gremlin", "ok who's still awake"],
  ["rei", "always. new playlist dropping in 10"],
  ["kuro", "drop it in here first 🎧"],
]) {
  await rpc(P[who], "send_message", { p_channel_id: chanId, p_body: msg });
  await settle(P[who], 150);
}

// REI's collections and saved looks.
const ink = await rpc(P.rei, "save_collection", { p_name: "Ink inspiration", p_emoji: "🖋️", p_description: "pages that stopped me scrolling", p_visibility: "members" });
const nights = await rpc(P.rei, "save_collection", { p_name: "Night walks", p_emoji: "🌙", p_description: "", p_visibility: "members" });
await rpc(P.rei, "save_collection", { p_name: "Cosplay refs", p_emoji: "🎭", p_description: "", p_visibility: "private" });
for (const [c, post] of [[ink, kuroPost], [ink, mioPost], [nights, reiPost]]) await rpc(P.rei, "set_collection_item", { p_collection_id: c.id, p_post_id: post.id, p_in: true });
await rpc(P.rei, "save_theme", { p_name: "Crimson", p_accent_hue: 351, p_theme: "dark", p_ambience: "stars" });
await rpc(P.rei, "save_theme", { p_name: "Ice", p_accent_hue: 200, p_theme: "dark", p_ambience: "rain" });
await rpc(P.rei, "save_theme", { p_name: "Sakura", p_accent_hue: 330, p_theme: "dark", p_ambience: "sakura" });
await rpc(P.rei, "update_my_identity", { p: { banner_style: "crimson_moon", avatar_frame: "neon" } });
console.log("scene data ready");
for (const p of Object.values(P)) await p.context().close();

// ------------------------------------------------------------------ shots
// REI is the point-of-view member for every shot.
async function rei(opts) {
  const ctx = await context(opts);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[shot page error]", e.message));
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /REI/ }).first().click();
  await page.waitForURL(`${BASE}/`);
  await settle(page, 1200);
  return page;
}
async function shot(page, name, { wait = 1100, full = false } = {}) {
  await settle(page, wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: full });
  console.log("shot", name);
}
async function scrollTo(page, text) {
  await page.getByText(text, { exact: false }).first().evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -70));
}

for (const [prefix, opts] of [["p", PHONE], ["d", DESK]]) {
  const page = await rei(opts);
  const go = async (url) => {
    await page.goto(`${BASE}${url}`);
    await settle(page, 1200);
  };
  await go("/");
  await shot(page, `${prefix}-home`);
  if (prefix === "p") await shot(page, `${prefix}-home-tall`, { full: true });
  await go("/explore?tab=discover");
  await page.getByRole("tab", { name: "Discover" }).click().catch(() => {});
  await shot(page, `${prefix}-discover`, { wait: 1600 });
  for (const banner of ["aurora", "ink", "sakura_night", "crimson_moon", "manga_panel"]) {
    await rpc(page, "update_my_identity", { p: { banner_style: banner, avatar_frame: banner === "ink" ? "hanko" : banner === "aurora" ? "ring" : "neon" } });
    await go("/u/rei_underground");
    await shot(page, `${prefix}-profile-${banner}`);
  }
  await rpc(page, "update_my_identity", { p: { banner_style: "crimson_moon", avatar_frame: "neon" } });
  for (const hue of [351, 200, 140, 280, 45]) {
    await rpc(page, "update_my_style", { p: { accent_hue: hue } });
    await go("/");
    await shot(page, `${prefix}-hue-${hue}`);
  }
  await rpc(page, "update_my_style", { p: { accent_hue: 351 } });
  await go(`/chat/${chanId}`);
  await shot(page, `${prefix}-chat`);
  await go("/collections");
  await shot(page, `${prefix}-collections`);
  await go("/creators");
  await shot(page, `${prefix}-creators`);
  await go("/pro");
  await shot(page, `${prefix}-pro`);
  await go("/settings");
  await scrollTo(page, "Profile look");
  await shot(page, `${prefix}-settings-look`);
  await scrollTo(page, "Saved looks");
  await shot(page, `${prefix}-settings-themes`);
  await scrollTo(page, "Privacy");
  await shot(page, `${prefix}-ghost-off`);
  await page.getByRole("switch", { name: "Ghost Mode" }).click();
  await shot(page, `${prefix}-ghost-on`, { wait: 900 });
  await page.getByRole("switch", { name: "Ghost Mode" }).click();
  await settle(page, 600);
  for (const lang of ["ja", "ar", "en"]) {
    await go("/settings");
    await page.locator("#language").selectOption(lang);
    await settle(page, 1200);
    if (lang !== "en") {
      await go("/");
      await shot(page, `${prefix}-lang-${lang}-home`);
      await go("/settings");
      await shot(page, `${prefix}-lang-${lang}-settings`);
    }
  }
  await page.context().close();
}

await browser.close();
console.log("done");
