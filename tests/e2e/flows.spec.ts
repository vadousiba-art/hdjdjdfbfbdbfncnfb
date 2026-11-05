import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import cues from "../../src/lib/welcome/cues.json";
import { CURRENT_RELEASE } from "../../src/lib/releases";

// The login route allows 10 attempts per IP per minute; give each test login
// its own address so the suite does not trip that limit.
let ipSeq = 1;
// The welcome film opens once per member; answer "already seen" so it does
// not cover the flows below. Its own tests run without this.
async function quiet(ctx: BrowserContext) {
  await ctx.route("**/api/rpc/get_welcome_state", (r) => r.fulfill({ json: { data: { seen: cues.version, account_age_hours: 9999 } } }));
}
async function loginAs(page: Page, name: RegExp, { welcome = false } = {}) {
  if (!welcome) await quiet(page.context());
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.0.0.${ipSeq++}` });
  await page.goto("/login");
  await page.getByRole("button", { name }).first().click();
  await page.waitForURL("**/");
  await expect(page.getByRole("tablist", { name: "Feed" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("logged-out visitors are sent to login", async ({ page }) => {
  await page.goto("/chat");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Choose an account" })).toBeVisible();
});

test("home feed matches the seeded mockup", async ({ page }) => {
  await loginAs(page, /Ari/);
  const first = page.locator("article").first();
  await expect(first).toContainText("Alberta version of a war criminal");
  await expect(first).toContainText("47");
  await expect(page.locator("article").nth(1)).toContainText("ROAST OF THE DAY");
  await expect(page.getByRole("button", { name: "Add to your story" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Activity, 3 unread/ })).toBeVisible();
});

test("create a post, like it, comment on it", async ({ page }) => {
  await loginAs(page, /Ari/);
  const text = `e2e post ${Date.now()} #testing`;
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Post text").fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const card = page.locator("article", { hasText: text });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: /^Like/ }).click();
  await expect(card.getByRole("button", { name: "Unlike" })).toContainText("1");
  await page.reload();
  await expect(page.locator("article", { hasText: text }).getByRole("button", { name: "Unlike" })).toContainText("1");

  await page.locator("article", { hasText: text }).getByRole("button", { name: /comments/ }).click();
  await page.waitForURL("**/post/**");
  await page.getByLabel("Add a comment...").fill("first comment from e2e");
  await page.getByRole("button", { name: "Send comment" }).click();
  await expect(page.getByText("first comment from e2e")).toBeVisible();
});

test("image uploads are validated, stored and served to members", async ({ page }) => {
  await loginAs(page, /Ari/);
  // 1x1 transparent PNG
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.locator('input[type=file][accept^="image"]').first().setInputFiles({ name: "evidence.png", mimeType: "image/png", buffer: png });
  await expect(page.getByAltText("Upload preview")).toBeVisible();
  const caption = `photo post ${Date.now()}`;
  await page.getByLabel("Post text").fill(caption);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const img = page.locator("article", { hasText: caption }).locator('img[src^="/api/media/"]');
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);

  // A fake "image" (HTML bytes) is rejected by the server-side signature check.
  const slot = await page.request.post("/api/upload/sign", { data: { type: "image/png", size: 20 } });
  const { data } = await slot.json();
  const res = await page.request.put(data.uploadUrl, { data: Buffer.from("<html><script>x</script>"), headers: { "Content-Type": "image/png" } });
  expect(res.status()).toBe(400);
});

test("polls can be created and voted on", async ({ page }) => {
  await loginAs(page, /Ari/);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("button", { name: "Poll", exact: true }).click();
  const q = `Which is worse? ${Date.now()}`;
  await page.getByLabel("Post text").fill(q);
  await page.getByLabel("Poll option 1").fill("Mondays");
  await page.getByLabel("Poll option 2").fill("Ohio");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const card = page.locator("article", { hasText: q });
  await card.getByRole("button", { name: "Ohio" }).click();
  await expect(card.getByText("1 vote")).toBeVisible();
  await expect(card.getByText("100%")).toBeVisible();
});

test("group chat messages arrive in realtime for other members", async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const pa = await a.newPage();
  const pb = await b.newPage();
  await loginAs(pa, /Ethan/);
  await loginAs(pb, /Lucas/);
  await pa.goto("/chat/00000000-0000-4000-8000-0000000c0001");
  await pb.goto("/chat/00000000-0000-4000-8000-0000000c0001");
  await expect(pa.getByText("who leaked my school nickname")).toBeVisible();
  const msg = `realtime check ${Date.now()}`;
  await pb.getByLabel("Message", { exact: true }).fill(msg);
  await pb.getByRole("button", { name: "Send" }).click();
  await expect(pb.getByText(msg)).toBeVisible();
  await expect(pa.getByText(msg)).toBeVisible({ timeout: 15_000 });
  await a.close();
  await b.close();
});

test("chaos tools work without an API key (Menace Lite)", async ({ page }) => {
  await loginAs(page, /Ari/);
  await page.goto("/chaos");
  await page.getByPlaceholder("Cereal is a soup").fill("cereal is a soup");
  await page.getByRole("button", { name: "Rate it" }).click();
  await expect(page.getByText("/10").first()).toBeVisible();
  await expect(page.getByText(/Menace Lite/).first()).toBeVisible();
});

test("admin invites a new member who can join and post", async ({ page, browser }) => {
  await loginAs(page, /Ari/);
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Invites" }).click();
  await expect(page.locator("code")).toHaveCount(1); // the revoked seed invite
  await page.getByRole("button", { name: "Create & copy link" }).click();
  await expect(page.locator("code")).toHaveCount(2);
  const code = (await page.locator("code").first().textContent())!.trim();
  expect(code).toMatch(/^[a-z0-9]{10}$/);

  const ctx = await browser.newContext();
  await quiet(ctx);
  const guest = await ctx.newPage();
  await guest.goto(`/join/${code}`);
  await expect(guest.getByRole("heading", { name: "You're invited" })).toBeVisible();
  const handle = `Newbie${Date.now() % 100000}`;
  await guest.getByLabel("Display name").fill("Newbie");
  await guest.getByLabel("Username").fill(handle);
  await guest.getByLabel("Email").fill(`${handle.toLowerCase()}@example.com`);
  await guest.getByRole("checkbox").check();
  await guest.getByRole("button", { name: "Join YORU" }).click();
  await guest.waitForURL("**/");
  await expect(guest.getByRole("tablist", { name: "Feed" })).toBeVisible();
  await guest.goto(`/u/${handle}`);
  await expect(guest.getByRole("heading", { name: /Newbie/ })).toBeVisible();
  await ctx.close();

  await page.reload();
  await page.getByRole("tab", { name: "Invites" }).click();
  await expect(page.getByText("1/5 used")).toBeVisible();
});

test("nightly check-in grows the streak and XP", async ({ page }) => {
  await loginAs(page, /Lucas/);
  await page.getByRole("button", { name: "Check in for tonight" }).click();
  await expect(page.getByText(/Night 1 · \+20 XP/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Checked in, 1 night streak/ })).toBeDisabled();
});

test("spoilers stay hidden until tapped", async ({ page }) => {
  await loginAs(page, /Zach/);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Post text").fill(`ending recap ||the villain wins ${Date.now()}||`);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const spoiler = page.getByRole("button", { name: "Spoiler, tap to reveal" }).first();
  await expect(spoiler).toBeVisible();
  await spoiler.click();
  await expect(page.locator(".spoiler[data-open=true]").first()).toContainText("the villain wins");
});

test("admins run announcements and quiet mode from site controls", async ({ page, browser }) => {
  await loginAs(page, /Ari/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Watchtower" })).toBeVisible();
  await expect(page.getByText("Night Watch is on")).toBeVisible();
  await page.getByRole("tab", { name: "Stats" }).click();
  await expect(page.getByText("Active today")).toBeVisible();
  await page.getByRole("tab", { name: "Controls" }).click();
  await page.getByLabel("Announcement text").fill("Movie night Friday 9pm");
  await page.getByRole("button", { name: "event" }).click();
  await page.getByRole("button", { name: "Publish banner" }).click();
  await expect(page.getByText("Announcement is live.")).toBeVisible();
  await page.getByRole("switch", { name: /Quiet mode/ }).click();
  await expect(page.getByText("Quiet mode on. Only admins can post.")).toBeVisible();

  const ctx = await browser.newContext();
  const member = await ctx.newPage();
  await loginAs(member, /Tyler/);
  await expect(member.getByRole("status").filter({ hasText: "Movie night Friday 9pm" })).toBeVisible();
  await expect(member.getByText(/Quiet mode: only admins can post/)).toBeVisible();
  await member.getByRole("button", { name: "Create", exact: true }).click();
  await member.getByLabel("Post text").fill("can I post?");
  await member.getByRole("button", { name: "Post", exact: true }).click();
  await expect(member.getByText(/YORU is in quiet mode right now/)).toBeVisible();
  await ctx.close();

  await page.getByRole("switch", { name: /Quiet mode/ }).click();
  await expect(page.getByText("Quiet mode off.")).toBeVisible();
  await page.getByRole("tab", { name: "Audit log" }).click();
  await expect(page.getByText("changed quiet mode").first()).toBeVisible();
});

test("the color slider recolors the whole app and is remembered", async ({ page }) => {
  await loginAs(page, /Ethan/);
  const brand = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--brand").trim());
  const before = await brand();
  await page.goto("/settings");
  await page.getByLabel("App color").fill("200");
  await expect.poll(brand).not.toBe(before);
  await page.waitForTimeout(900); // saved shortly after the slider stops
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--accent-h"))).toBe("200");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect.poll(brand).toBe(before);
});

test("command palette jumps anywhere", async ({ page }) => {
  await loginAs(page, /Ari/);
  await page.keyboard.press("Control+k");
  await page.getByLabel("Search commands").fill("Leader");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/leaderboard");
  await expect(page.getByRole("button", { name: /Top Levels/ })).toBeVisible();
});

test("anyone can sign up without an invite, and can delete their account", async ({ page }) => {
  await quiet(page.context());
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.0.1.${ipSeq++}` });
  await page.goto("/join/definitely-not-real");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  const handle = `Walkin${Date.now() % 100000}`;
  await page.getByLabel("Display name").fill("Walk In");
  await page.getByLabel("Username").fill(handle);
  await page.getByLabel("Email").fill(`${handle.toLowerCase()}@example.com`);
  await expect(page.getByRole("button", { name: "Join YORU" })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Join YORU" }).click();
  await page.waitForURL("**/");
  await expect(page.getByRole("tablist", { name: "Feed" })).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.getByLabel("Type your username to confirm").fill(handle);
  await page.getByRole("button", { name: "Delete forever" }).click();
  await page.waitForURL("**/about?deleted=1");
  await expect(page.getByText("Your account has been deleted.")).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/about/);
});

test("public pages work signed out and the contact form reaches the admin inbox", async ({ page }) => {
  for (const [path, heading] of [
    ["/about", /Find your people/],
    ["/privacy", "Privacy Policy"],
    ["/terms", "Terms of Service"],
    ["/faq", "Frequently asked questions"],
    ["/delete-account", "Delete your YORU account"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
  }
  await page.goto("/support");
  await page.getByLabel("What do you need help with?").selectOption("bug");
  await page.getByLabel("Your email").fill("tester@example.com");
  await page.getByLabel("Message").fill("The sakura effect is too pretty.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText("Message sent.")).toBeVisible();

  await loginAs(page, /Ari/);
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Support" }).click();
  await expect(page.getByText("The sakura effect is too pretty.")).toBeVisible();
});

// ---------------------------------------------------------------- Open Gates

async function signUp(page: Page, prefix: string) {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `10.0.2.${ipSeq++}` });
  await page.goto("/join/welcome-test");
  const handle = `${prefix}${Date.now() % 100000}`;
  await page.getByLabel("Display name").fill(prefix);
  await page.getByLabel("Username").fill(handle);
  await page.getByLabel("Email").fill(`${handle.toLowerCase()}@example.com`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Join YORU" }).click();
  await page.waitForURL("**/");
  return handle;
}

test("a new member sees the welcome film once, and can skip and replay it", async ({ page }) => {
  await signUp(page, "Newcomer");
  const film = page.getByRole("dialog", { name: "Enter the Night" });
  await expect(film).toBeVisible();
  // Starts muted with a visible sound control; playback really starts.
  const sound = film.getByRole("button", { name: "Unmute" });
  await expect(sound).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => film.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.5);
  await sound.click();
  await expect(film.getByRole("button", { name: "Mute" })).toHaveAttribute("aria-pressed", "true");
  await film.getByRole("button", { name: "Skip intro" }).click();
  await expect(film).toBeHidden();

  // Remembered: not shown again after a reload.
  await page.reload();
  await expect(page.getByRole("tablist", { name: "Feed" })).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(page.getByRole("dialog", { name: "Enter the Night" })).toBeHidden();

  // Replay from Settings: the hub offers the film, the short cut and the notes.
  await page.goto("/settings");
  await page.getByRole("button", { name: "Replay" }).click();
  const hub = page.getByRole("dialog", { name: "Explore YORU" });
  await hub.getByRole("button", { name: /Watch the short update/ }).click();
  const short = page.getByRole("dialog", { name: "Tonight on YORU" });
  await expect(short).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(short).toBeHidden();
  await page.getByRole("button", { name: "Replay" }).click();
  await page.getByRole("dialog", { name: "Explore YORU" }).getByRole("button", { name: /Read what's new instead/ }).click();
  await expect(page.getByRole("dialog").filter({ hasText: `Version ${CURRENT_RELEASE.version}` })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("if the film can't load, the welcome falls back to readable highlights", async ({ page }) => {
  await page.context().route("**/welcome/v*/**", (r) => r.abort());
  await signUp(page, "Offline");
  const film = page.getByRole("dialog", { name: "Enter the Night" });
  await expect(film.getByRole("alert")).toContainText("Welcome to YORU");
  await expect(film.getByRole("alert")).toContainText("YORU Pro is in development");
  await film.getByRole("button", { name: /Enter YORU/ }).click();
  await expect(film).toBeHidden();
  await expect(page.getByRole("tablist", { name: "Feed" })).toBeVisible();
});

test("captions follow the member's language", async ({ page }) => {
  await loginAs(page, /Tyler/);
  await page.goto("/settings");
  await page.locator("#language").selectOption("ja");
  await page.getByRole("button", { name: "もう一度見る" }).click();
  await page.getByRole("button", { name: /短いアップデートを見る/ }).click();
  await expect(page.getByText("夜のインターネット。")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await page.locator("#language").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("visitors can watch the intro from the landing page before joining", async ({ page }) => {
  await page.goto("/about");
  await page.getByRole("button", { name: /Watch the 80-second intro/ }).click();
  const film = page.getByRole("dialog", { name: "Enter the Night" });
  await expect(film).toBeVisible();
  await expect(film.getByRole("button", { name: /Join YORU/ })).toBeVisible();
  // The film files are public: they really play for a signed-out visitor.
  await expect.poll(() => film.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime), { timeout: 15_000 }).toBeGreaterThan(0.5);
  for (const f of ["poster-land.jpg", "og.jpg", "full-land.webm"]) {
    const res = await page.request.get(`/welcome/v${cues.version}/${f}`, { maxRedirects: 0 });
    expect(res.status(), f).toBe(200);
  }
  await film.getByRole("button", { name: "Close" }).click();
  await expect(film).toBeHidden();
});

test("switching to Arabic translates the app, flips it right-to-left and is remembered", async ({ page }) => {
  await loginAs(page, /Tyler/);
  await page.goto("/settings");
  await page.locator("#language").selectOption("ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { name: "الإعدادات", level: 1 })).toBeVisible();
  await expect(page.getByText(/مترجمة آليًا/)).toBeVisible(); // machine-translation notice
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.locator("#language").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
});

test("Ghost Mode hides the online dot from other members", async ({ page, browser }) => {
  await loginAs(page, /Ethan/);
  const ctx = await browser.newContext();
  const viewer = await ctx.newPage();
  await loginAs(viewer, /Lucas/);
  await viewer.goto("/u/EthanLang");
  await expect(viewer.getByLabel("online").first()).toBeVisible();

  await page.goto("/settings");
  const ghost = page.getByRole("switch", { name: "Ghost Mode" });
  await ghost.click();
  await expect(ghost).toHaveAttribute("aria-checked", "true");
  await viewer.reload();
  await expect(viewer.getByRole("heading", { name: /Ethan/ })).toBeVisible();
  await expect(viewer.getByLabel("online")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("switch", { name: "Ghost Mode" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("switch", { name: "Ghost Mode" }).click();
  await expect(page.getByRole("switch", { name: "Ghost Mode" })).toHaveAttribute("aria-checked", "false");
  await ctx.close();
});

test("posts can be saved into a named collection", async ({ page }) => {
  await loginAs(page, /Zach/);
  const card = page.locator("article").first();
  const snippet = ((await card.locator("p").first().textContent()) ?? "").trim().slice(0, 24);
  await card.getByRole("button", { name: "More options" }).click();
  await page.getByRole("menuitem", { name: "Add to collection" }).click();
  const name = `Best of ${Date.now() % 10000}`;
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Create and add" }).click();
  await expect(page.getByText(`Added to ${name}`)).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/collections");
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
  if (snippet) await expect(page.locator("article").first()).toContainText(snippet);
});

test("a member applies to the Creator Showcase and an admin approves them", async ({ page, browser }) => {
  await loginAs(page, /Zach/);
  await page.goto("/creators");
  await page.getByRole("button", { name: "Apply to be a creator" }).click();
  await page.getByLabel("What you create").selectOption("artist");
  await page.getByLabel("Link to your work").fill("https://example.com/zach-art");
  await page.getByLabel("Tell us about your work").fill("Ink drawings of my friends as anime villains, posted weekly.");
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByText("Your application is waiting for review.")).toBeVisible();

  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await loginAs(admin, /Ari/);
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: "Creators" }).click();
  await expect(admin.getByText("Ink drawings of my friends")).toBeVisible();
  await admin.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("No creator applications waiting.")).toBeVisible();
  await ctx.close();

  await page.reload();
  await expect(page.getByText("You're an approved creator: Artist.")).toBeVisible();
  await page.goto("/u/ZachAttack");
  await expect(page.getByText(/Creator · Artist/)).toBeVisible();
});

test("an admin grants complimentary Pro and the member sees it", async ({ page, browser }) => {
  await loginAs(page, /Ari/);
  await page.goto("/pro"); // paid Pro goes through the e-Transfer checkout
  await expect(page.getByRole("link", { name: /Get Pro/ }).first()).toHaveAttribute("href", "/pro/checkout");
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Pro" }).click();
  await page.getByPlaceholder("@username").fill("LucasSZN");
  await page.getByRole("button", { name: "Grant Pro" }).click();
  await expect(page.getByText("Pro granted to @LucasSZN for 30 days.")).toBeVisible();

  const ctx = await browser.newContext();
  const member = await ctx.newPage();
  await loginAs(member, /Lucas/);
  await member.goto("/pro");
  await expect(member.getByText(/You have YORU Pro until/)).toBeVisible();
  await ctx.close();
});

test("the Trust Center is public", async ({ page }) => {
  await page.goto("/trust");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/trust/);
});

// ---------------------------------------------------------------------------
// YORU Pro Universe (migration 0009)
// ---------------------------------------------------------------------------

test("the Pro landing page is honest about price and checkout", async ({ page }) => {
  await loginAs(page, /Zach/);
  await page.goto("/pro");
  await expect(page.getByRole("heading", { name: /YOUR PROFILE\.\s*YOUR UNIVERSE\./ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore YORU Pro" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Preview the cosmetics" }).first()).toBeVisible();
  await expect(page.getByText("One month per payment by Interac e-Transfer. Nothing renews by itself.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Get Pro/ }).first()).toHaveAttribute("href", "/pro/checkout");
  await expect(page.getByRole("link", { name: "Donate" })).toHaveAttribute("href", "/pro/checkout?for=donate");
});

test("Pro and donations check out by Interac e-Transfer", async ({ page }) => {
  await loginAs(page, /Zach/);
  await page.goto("/pro/checkout");
  await page.getByRole("button", { name: /Pay \$5\.99 by Interac e-Transfer/ }).click();
  await expect(page.getByText("nextyoru@gmail.com")).toBeVisible();
  await expect(page.getByText(/^YORU-[A-Z0-9]{5}$/)).toBeVisible();
  await expect(page.getByText(/^\$5\.\d\d$/).first()).toBeVisible();
  await page.getByRole("button", { name: /I.ve sent it/ }).click();
  await expect(page.getByText("Payment sent. Pro is on its way.")).toBeVisible();

  await page.getByRole("tab", { name: /Donate/ }).click();
  await page.getByRole("radio", { name: "Custom" }).click();
  await page.locator("#donation-custom").fill("501");
  await expect(page.getByRole("button", { name: /^Donate/ })).toBeDisabled();
  await page.locator("#donation-custom").fill("12.50");
  await page.getByRole("button", { name: "Donate $12.50" }).click();
  await expect(page.getByText("Send your donation")).toBeVisible();
});

test("trying on never unlocks; free items equip and show on posts; crafted requests are refused", async ({ page }) => {
  await loginAs(page, /Zach/);
  await page.goto("/pro/shop");
  await expect(page.getByText("400 items", { exact: true })).toBeVisible();

  // A Pro item: try-on only, no Equip, and the server refuses a hand-made request.
  await page.getByLabel("Search the catalog").fill("Crimson Eclipse");
  await page.getByRole("button", { name: /Crimson Eclipse/ }).first().click();
  const sheet = page.getByRole("dialog", { name: "Crimson Eclipse" });
  await expect(sheet.getByRole("button", { name: "Equip" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Try on" }).click();
  await expect(page.getByText("Trying on: only you can see this, nothing is saved.")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "End try-on" }).click();
  const forged = await page.request.post("/api/rpc/pro_equip", { data: { p_slot: "ring", p_item: "ring.crimson_eclipse" } });
  expect(forged.status()).toBe(403);

  // A free item equips and shows on the member's posts.
  await page.getByLabel("Search the catalog").fill("Void Halo");
  await page.getByRole("button", { name: /Void Halo/ }).first().click();
  await page.getByRole("dialog", { name: "Void Halo" }).getByRole("button", { name: "Equip" }).click();
  await expect(page.getByText("Void Halo equipped.")).toBeVisible();
  const me = await (await page.request.post("/api/rpc/get_my_pro", { data: {} })).json();
  expect(me.data.equips.ring).toEqual({ item: "ring.void_halo", active: true });
  await page.goto("/u/ZachAttack");
  await expect(page.locator("svg.pointer-events-none.absolute").first()).toBeVisible();
});

test("a Pro member wears a signature look and other members see it", async ({ page, browser }) => {
  await loginAs(page, /Lucas/); // granted complimentary Pro by an earlier test
  await page.goto("/pro/shop?view=sets");
  await page.locator("div", { hasText: /^CRIMSON REQUIEM/ }).first();
  const card = page.locator("div.overflow-hidden.rounded-2xl", { hasText: "CRIMSON REQUIEM" }).first();
  await card.getByRole("button", { name: "Wear what I own" }).click();
  await expect(page.getByText("Look equipped.")).toBeVisible();

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await loginAs(other, /Zach/);
  await other.goto("/u/LucasSZN");
  await expect(other.locator('[data-banner="crimson_rain"]')).toBeVisible();
  await expect(other.getByText("Crimson Phantom")).toBeVisible();
  await ctx.close();
});

test("drafts are private, post on demand, and schedules can be cancelled", async ({ page }) => {
  await loginAs(page, /Zach/);
  await page.goto("/pro/studio");
  await page.getByRole("button", { name: "New", exact: true }).click();
  const text = `draft from e2e ${Date.now()}`;
  await page.getByLabel("Draft text").fill(text);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Draft saved.")).toBeVisible();

  // The demo server runs the scheduler, so scheduling is available.
  await expect(page.getByText(/Scheduling is running/)).toBeVisible();
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await expect(page.getByText(/Scheduled for/).first()).toBeVisible();
  await page.getByRole("button", { name: "Cancel schedule" }).click();
  await expect(page.getByText("Schedule cancelled. It's a draft again.")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Post now" }).click();
  await expect(page.getByText("Posted.")).toBeVisible();
  await page.goto("/");
  await expect(page.locator("article", { hasText: text })).toBeVisible();
});

test("analytics show real zeros for a brand-new member, never sample numbers", async ({ page }) => {
  await quiet(page.context());
  await signUp(page, "Fresh");
  await page.goto("/pro/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  await expect(page.getByText("No reactions or comments from others yet.")).toBeVisible();
  await expect(page.getByText("Total posts: 0")).toBeVisible();
});

test("the Lab, hub, hubs and feed presets load", async ({ page }) => {
  await loginAs(page, /Zach/);
  await page.goto("/pro/lab");
  await expect(page.getByRole("heading", { name: /Preview Lab/ })).toBeVisible();
  await page.goto("/pro/hub");
  await expect(page.getByRole("heading", { name: "Membership hub" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Billing Information" })).toBeVisible();
  await page.goto("/pro/hubs/hub.anime_central");
  await expect(page.getByRole("heading", { name: /Anime Central/ })).toBeVisible();
  await page.goto("/pro/feeds?preset=feed.image_focus");
  await expect(page.getByText("Previewing the first 5 posts. Using this preset is part of YORU Pro.")).toBeVisible();
});

// ---------------------------------------------------------------- Night Watch

async function postAs(page: Page, text: string) {
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByLabel("Post text").fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
}

test("Night Watch refuses slurs however they're spelled, and the member can appeal from Account Standing", async ({ page }) => {
  await loginAs(page, /Zach/);
  await postAs(page, "you absolute f4gg0t");
  await expect(page.getByText(/breaks our hate speech rule/)).toBeVisible();
  await page.goto("/standing");
  await expect(page.getByText("One active strike. Nothing is limited.")).toBeVisible();
  await page.getByRole("button", { name: "Appeal" }).first().click();
  await page.getByPlaceholder("Why should this be reversed?").fill("I was quoting someone who said it to me.");
  await page.getByRole("button", { name: "Send appeal" }).click();
  await expect(page.getByText(/Appeal (in review|granted|denied)/)).toBeVisible();

  // The notice arrives from the official account, which can't be replied to.
  await page.goto("/chat");
  await page.getByRole("link", { name: /YORU.*Official/ }).click();
  await expect(page.getByText(/breaks? our hate speech rule|broke our hate speech rule/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Account Standing" })).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveCount(0);
});

test("held posts stay private until a moderator reviews them in Watchtower", async ({ page, browser }) => {
  await loginAs(page, /Lucas/);
  const text = `kys bro ${Date.now()}`;
  await postAs(page, text);
  await expect(page.locator("article", { hasText: text }).getByText("Under review.")).toBeVisible();

  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await loginAs(admin, /Ari/);
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: "Queue" }).click();
  await admin.getByRole("button", { name: new RegExp(text) }).click();
  await admin.getByRole("button", { name: /Restore/ }).click();
  await expect(admin.getByText("Restored and the member was told.")).toBeVisible();
  await ctx.close();

  await page.reload();
  await expect(page.locator("article", { hasText: text }).getByText("Under review.")).toHaveCount(0);
});

test("Watch opens full screen and explains when there are no videos yet", async ({ page }) => {
  await loginAs(page, /Ari/);
  await page.goto("/watch");
  await expect(page.getByRole("tab", { name: "For You" })).toBeVisible();
  await expect(page.getByText("No videos yet")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("tablist", { name: "Feed" })).toBeVisible();
});
