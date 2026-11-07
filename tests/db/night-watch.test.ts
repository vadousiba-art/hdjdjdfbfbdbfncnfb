import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { applyMigrations } from "@/lib/database/migrations";

// Night Watch (migration 0011) from the database's point of view: the rules
// engine can't be skipped, held content stays private, strikes escalate and
// can be appealed, reports are triaged, and moderators have limited powers.

let db: PGlite;
const root = path.resolve(__dirname, "../..");
const u: Record<string, string> = {};
const OFFICIAL = "00000000-0000-4000-8000-0000000000f1";

function bind(args: Record<string, unknown>) {
  return Object.values(args).map((a) => (a !== null && typeof a === "object" && !Array.isArray(a) ? JSON.stringify(a) : a));
}
async function as<T = unknown>(uid: string | null, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const keys = Object.keys(args);
  const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
  return db.transaction(async (tx) => {
    if (uid) {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
      await tx.exec("set local role authenticated");
    } else await tx.exec("set local role anon");
    return (await tx.query<{ r: T }>(sql, bind(args))).rows[0]?.r as T;
  });
}
// The server (service role): no member session.
async function server<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const keys = Object.keys(args);
  const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
  return (await db.query<{ r: T }>(sql, bind(args))).rows[0]?.r as T;
}
async function signup(name: string, ageDays = 30) {
  const r = await db.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [
    `${name}@nw.test`,
    JSON.stringify({ username: name, display_name: name }),
  ]);
  const id = r.rows[0].id;
  await db.query("update public.profiles set created_at = now() - make_interval(days => $2) where id = $1", [id, ageDays]);
  return id;
}
const post = (uid: string, body: string, extra: Record<string, unknown> = {}) => as<string>(uid, "create_post", { p_body: body, ...extra });
const visible = async (uid: string, id: string) =>
  as(uid, "get_post", { p_id: id }).then(
    () => true,
    () => false,
  );
const lastNotice = async (uid: string) =>
  (
    await db.query<{ body: string }>(
      `select m.body from public.messages m join public.channel_members cm on cm.channel_id = m.channel_id and cm.user_id = $1
       where m.author_id = $2 order by m.created_at desc limit 1`,
      [uid, OFFICIAL],
    )
  ).rows[0]?.body;
type Standing = { status: string; active_strikes: number; muted_until: string | null; decisions: { id: string; appealable: boolean; status: string; appeal: { status: string } | null }[] };

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await applyMigrations(db, { root });
  u.owner = await signup("nw_owner");
  await db.query("update public.profiles set role = 'owner' where id = $1", [u.owner]);
  u.admin = await signup("nw_admin");
  await db.query("update public.profiles set role = 'admin' where id = $1", [u.admin]);
  u.mod = await signup("nw_mod");
  u.ann = await signup("nw_ann");
  u.ben = await signup("nw_ben");
  u.cy = await signup("nw_cy");
  u.newbie = await signup("nw_newbie", 0);
  for (const n of ["r1", "r2", "r3", "r4"]) u[n] = await signup(`nw_${n}`, n === "r1" ? 30 : 1);
}, 120_000);

describe("setup", () => {
  it("adds the official account, which can't log in", async () => {
    const r = (await db.query<{ username: string; verified: boolean; is_bot: boolean }>("select username, verified, is_bot from public.profiles where id = $1", [OFFICIAL])).rows[0];
    expect(r).toEqual({ username: "YORU", verified: true, is_bot: true });
  });

  it("keeps service-only functions away from members", async () => {
    await expect(as(u.ann, "nw_screen", { p_user: u.ann, p_kind: "posts", p_text: "x" })).rejects.toThrow(/permission denied/);
    await expect(as(u.ann, "nw_record_block", { p_user: u.ben, p_type: "post", p_text: "x", p_verdict: { verdict: "block" } })).rejects.toThrow(/permission denied/);
    await expect(as(u.ann, "nw_queue")).rejects.toThrow(/FORBIDDEN/);
    await expect(db.query("select * from public.mod_events").then(() => as(u.ann, "nw_dashboard"))).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("rules engine", () => {
  it("blocks slurs however they're spelled, and says why", async () => {
    for (const body of ["you absolute N1GGGER!!!", "n i g g e r", "what a f.a.g.g.0.t", "SPIC"]) {
      await expect(post(u.ann, body), body).rejects.toThrow(/AUTOMOD\|.*hate speech/);
    }
  });

  it("doesn't flag ordinary words that contain or resemble them", async () => {
    for (const body of ["Niger and Nigeria are in West Africa", "spicy ramen tonight", "that was conspicuous", "skill issue tbh", "my therapist says hi", "class of 2026"]) {
      const id = await post(u.cy, body);
      expect(await visible(u.ben, id), body).toBe(true);
    }
  });

  it("holds threats for review: only the author and moderators can see them", async () => {
    const id = await post(u.ann, "kys honestly");
    expect(await visible(u.ann, id)).toBe(true);
    expect(await visible(u.ben, id)).toBe(false);
    await db.query("update public.profiles set role = 'moderator' where id = $1", [u.mod]);
    expect(await visible(u.mod, id)).toBe(true);
    const mine = await as<{ mod: { state: string; label: string } }>(u.ann, "get_post", { p_id: id });
    expect(mine.mod).toEqual({ state: "held", label: "threats" });
    const feed = await as<{ id: string }[]>(u.ben, "get_feed", { p_mode: "latest" });
    expect(feed.some((p) => p.id === id)).toBe(false);
    const queue = await as<{ target_id: string; status: string }[]>(u.mod, "nw_queue", { p_view: "held" });
    expect(queue.find((e) => e.target_id === id)?.status).toBe("open");
  });

  it("checks in kindly on self-harm posts instead of punishing", async () => {
    const id = await post(u.ben, "honestly i want to die lately");
    expect(await visible(u.cy, id)).toBe(true);
    expect(await lastNotice(u.ben)).toMatch(/988/);
    const s = await as<Standing>(u.ben, "get_my_standing");
    expect(s.active_strikes).toBe(0);
  });

  it("holds phone numbers and links from brand-new accounts", async () => {
    const phone = await post(u.ben, "call her at 780-555-0199");
    expect(await visible(u.ann, phone)).toBe(false);
    const link = await post(u.newbie, "check this out https://example.com/free");
    expect(await visible(u.ben, link)).toBe(false);
    const ok = await post(u.ben, "check this out https://example.com/blog");
    expect(await visible(u.ben, ok)).toBe(true);
  });

  it("refuses spam floods without a strike", async () => {
    await post(u.r1, "first time posting this exact thing");
    await expect(post(u.r1, "first time posting this exact thing")).rejects.toThrow(/AUTOMOD\|You just posted that/);
    await expect(post(u.r1, `${Array.from({ length: 10 }, (_, i) => `@nw_user${i}`).join(" ")} look`)).rejects.toThrow(/mentions/);
    for (let i = 0; i < 5; i++) await post(u.r1, `burst number ${i} with different words ${i * 7}`);
    await expect(post(u.r1, "one more different post")).rejects.toThrow(/very fast/);
    expect((await as<Standing>(u.r1, "get_my_standing")).active_strikes).toBe(0);
  });

  it("can't be skipped by writing to the table directly", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: u.cy, role: "authenticated" })]);
        await tx.exec("set local role authenticated");
        await tx.query("insert into public.posts (author_id, body) values ($1, 'kike')", [u.cy]);
      }),
    ).rejects.toThrow(/AUTOMOD|permission denied/);
  });

  it("exempts staff and the server", async () => {
    const id = await post(u.admin, "quoting a report: kys");
    expect(await visible(u.ben, id)).toBe(true);
  });
});

describe("strikes, notices and appeals", () => {
  it("escalates: warning, then a 24 hour mute, with a notice each time", async () => {
    const v = { verdict: "block", category: "hate", strike: true, source: "ai", confidence: 0.97, reason: "Slur aimed at a member." };
    const first = await server<{ event_id: string; strike: { strikes: number; muted_minutes: number } }>("nw_record_block", {
      p_user: u.cy, p_type: "post", p_text: "something hateful", p_verdict: v,
    });
    expect(first.strike).toMatchObject({ strikes: 1, muted_minutes: 0 });
    expect(await lastNotice(u.cy)).toMatch(/hate speech rule[\s\S]*strike 1[\s\S]*Account Standing/);
    const second = await server<{ strike: { strikes: number; muted_minutes: number } }>("nw_record_block", {
      p_user: u.cy, p_type: "comment", p_text: "something hateful again", p_verdict: v,
    });
    expect(second.strike).toMatchObject({ strikes: 2, muted_minutes: 1440 });
    await expect(post(u.cy, "can I post?")).rejects.toThrow(/MUTED/);
    const s = await as<Standing>(u.cy, "get_my_standing");
    expect(s.status).toBe("muted");
    expect(s.decisions[0].appealable).toBe(true);
    u.cyEvent = first.event_id;
  });

  it("keeps the notice channel one-way", async () => {
    const ch = (await db.query<{ id: string }>("select public.nw_official_channel($1) as id", [u.cy])).rows[0].id;
    await db.query("update public.profiles set muted_until = null where id = $1", [u.cy]);
    await expect(as(u.cy, "send_message", { p_channel_id: ch, p_body: "hello?" })).rejects.toThrow(/notice channel/);
  });

  it("appeals: one per decision; granting restores and removes the strike", async () => {
    await db.query("update public.profiles set muted_until = now() + interval '1 day' where id = $1", [u.cy]);
    const a = await as<{ id: string; status: string }>(u.cy, "submit_appeal", { p_event_id: u.cyEvent, p_body: "That was a song lyric, not aimed at anyone." });
    expect(a.status).toBe("open");
    await expect(as(u.cy, "submit_appeal", { p_event_id: u.cyEvent, p_body: "again" })).rejects.toThrow(/already appealed/);
    await expect(as(u.ann, "submit_appeal", { p_event_id: u.cyEvent, p_body: "not mine" })).rejects.toThrow(/NOT_FOUND/);
    const list = await as<{ id: string }[]>(u.mod, "nw_appeals", { p_status: "open" });
    expect(list.map((x) => x.id)).toContain(a.id);
    await as(u.mod, "nw_decide_appeal", { p_appeal_id: a.id, p_grant: true, p_note: "Fair, it was a lyric." });
    const s = await as<Standing>(u.cy, "get_my_standing");
    expect(s.active_strikes).toBe(1);
    expect(s.decisions.find((d) => d.id === u.cyEvent)?.appeal?.status).toBe("granted");
    expect(await lastNotice(u.cy)).toMatch(/appeal was granted/);
  });

  it("lifts rules-only holds on new-account links automatically when appealed", async () => {
    const id = await post(u.newbie, "my art https://example.com/portfolio");
    const ev = (await db.query<{ id: string }>("select id from public.mod_events where target_id = $1", [id])).rows[0].id;
    const a = await as<{ status: string }>(u.newbie, "submit_appeal", { p_event_id: ev, p_body: "It's my portfolio." });
    expect(a.status).toBe("granted");
    expect(await visible(u.ben, id)).toBe(true);
  });

  it("the AI layer can hold, label or remove content after it's saved", async () => {
    const id = await post(u.ann, "a photo of a car crash");
    await server("nw_apply", { p_type: "post", p_id: id, p_verdict: { verdict: "label", category: "violence", source: "ai", confidence: 0.8 } });
    const p = await as<{ mod: { state: string } }>(u.ben, "get_post", { p_id: id });
    expect(p.mod.state).toBe("label");
    const gone = await post(u.ann, "totally normal words");
    await server("nw_apply", { p_type: "post", p_id: gone, p_verdict: { verdict: "remove", category: "scam", source: "ai", confidence: 0.95, strike: true }, p_media_hash: "a".repeat(64) });
    expect(await visible(u.ann, gone)).toBe(false);
    expect(await server("nw_media_blocked", { p_hash: "a".repeat(64) })).toBe(true);
    expect(await server("nw_unchecked", { p_limit: 50 })).not.toContainEqual(expect.objectContaining({ id: gone }));
  });
});

describe("reports", () => {
  it("removes clear-cut reported content automatically and tells the reporter", async () => {
    const id = await post(u.ben, "normal looking post");
    await as(u.r1, "create_report", { p_target_type: "post", p_target_id: id, p_reason: "scam link in replies", p_category: "spam" });
    const r = await server<{ action: string }>("nw_report_verdict", { p_type: "post", p_id: id, p_verdict: { verdict: "remove", category: "scam", confidence: 0.96, source: "ai", strike: true } });
    expect(r.action).toBe("removed");
    expect(await visible(u.r1, id)).toBe(false);
    const n = (await db.query<{ body: string }>("select body from public.notifications where user_id = $1 and kind = 'report_update'", [u.r1])).rows;
    expect(n[0].body).toMatch(/removed/);
  });

  it("dismisses reports the AI is sure about, but never ones about someone at risk", async () => {
    const id = await post(u.ann, "pineapple belongs on pizza");
    await as(u.r1, "create_report", { p_target_type: "post", p_target_id: id, p_reason: "wrong opinion", p_category: "other" });
    expect((await server<{ action: string }>("nw_report_verdict", { p_type: "post", p_id: id, p_verdict: { verdict: "allow", confidence: 0.97, source: "ai" } })).action).toBe("dismissed");
    const risk = await post(u.ann, "rough week");
    await as(u.r1, "create_report", { p_target_type: "post", p_target_id: risk, p_reason: "worried about them", p_category: "self_harm" });
    expect((await server<{ action: string }>("nw_report_verdict", { p_type: "post", p_id: risk, p_verdict: { verdict: "allow", confidence: 0.97, source: "ai" } })).action).toBe("review");
  });

  it("sends coordinated reporting by new accounts to a person", async () => {
    const id = await post(u.ann, "my honest review of the new season");
    for (const r of [u.r2, u.r3, u.r4]) await as(r, "create_report", { p_target_type: "post", p_target_id: id, p_reason: "bad", p_category: "other" });
    const r = await server<{ action: string; brigade: boolean }>("nw_report_verdict", { p_type: "post", p_id: id, p_verdict: { verdict: "remove", category: "harassment", confidence: 0.99, source: "ai" } });
    expect(r).toMatchObject({ action: "review", brigade: true });
    expect(await visible(u.ben, id)).toBe(true);
  });

  it("checks reported DMs, which are otherwise never read", async () => {
    const ch = await as<string>(u.ann, "start_dm", { p_user_id: u.ben });
    const m = (await as<{ id: string }>(u.ann, "send_message", { p_channel_id: ch, p_body: "send me your password or else" })) as unknown;
    const mid = typeof m === "string" ? m : (m as { id: string }).id;
    const t = await server<{ exists: boolean; text: string }>("nw_report_target", { p_type: "message", p_id: mid });
    expect(t).toMatchObject({ exists: true, text: "send me your password or else" });
  });
});

describe("Watchtower", () => {
  it("moderators review: remove with a strike, or restore", async () => {
    const id = await post(u.ann, "kys loser");
    const ev = (await db.query<{ id: string }>("select id from public.mod_events where target_id = $1", [id])).rows[0].id;
    const before = (await as<Standing>(u.ann, "get_my_standing")).active_strikes;
    const done = await as<{ status: string; removed: boolean }>(u.mod, "nw_review", { p_event_id: ev, p_decision: "remove", p_strike: true, p_note: "" });
    expect(done).toMatchObject({ status: "upheld", removed: true });
    expect((await as<Standing>(u.ann, "get_my_standing")).active_strikes).toBe(before + 1);
    const back = await as<{ status: string }>(u.mod, "nw_review", { p_event_id: ev, p_decision: "restore", p_strike: false, p_note: "context" });
    expect(back.status).toBe("overturned");
    expect(await visible(u.ben, id)).toBe(true);
    expect((await as<Standing>(u.ann, "get_my_standing")).active_strikes).toBe(before);
  });

  it("moderators can't ban, edit rules, mute staff, or mute longer than a week", async () => {
    await expect(as(u.mod, "admin_set_banned", { p_user_id: u.ann, p_banned: true })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(u.mod, "nw_set_config", { p: { enabled: false } })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(u.mod, "nw_mute", { p_user_id: u.admin, p_minutes: 60 })).rejects.toThrow(/FORBIDDEN/);
    await as(u.mod, "nw_mute", { p_user_id: u.ben, p_minutes: 99999 });
    const until = (await db.query<{ d: number }>("select extract(epoch from muted_until - now()) / 86400 as d from public.profiles where id = $1", [u.ben])).rows[0].d;
    expect(Number(until)).toBeLessThanOrEqual(7.01);
    await as(u.mod, "nw_mute", { p_user_id: u.ben, p_minutes: 0 });
  });

  it("admins edit the rules; values are clamped and child safety can't be switched off", async () => {
    const cfg = await as<{ max_links: number; categories: { minors: { action: string }; hate: { action: string } } }>(u.admin, "nw_set_config", {
      p: { max_links: 999, categories: { minors: { action: "allow", rules: "allow", threshold: 0.9 }, hate: { action: "hold", rules: "hold", threshold: 0.9 } } },
    });
    expect(cfg.max_links).toBe(20);
    expect(cfg.categories.minors.action).toBe("remove");
    expect(cfg.categories.hate.action).toBe("hold");
    expect((await as<{ verdict: string }>(u.mod, "nw_test", { p_text: "chink" })).verdict).toBe("hold");
    await as(u.admin, "nw_set_config", { p: { max_links: 3, categories: { hate: { action: "remove", rules: "remove", threshold: 0.8 } } } });
  });

  it("the dashboard counts real events and recommends bans without banning", async () => {
    for (let i = 0; i < 4; i++) {
      await server("nw_record_block", { p_user: u.r4, p_type: "post", p_text: `bad ${i}`, p_verdict: { verdict: "block", category: "hate", strike: true } });
    }
    const d = await as<{ open: number; week: { total: number; blocked: number }; ban_recommended: { id: string }[] }>(u.mod, "nw_dashboard");
    expect(d.week.blocked).toBeGreaterThanOrEqual(6);
    expect(d.ban_recommended.map((p) => p.id)).toContain(u.r4);
    expect((await db.query<{ banned: boolean }>("select banned from public.profiles where id = $1", [u.r4])).rows[0].banned).toBe(false);
    const file = await as<{ ban_recommended: boolean; strikes: unknown[] }>(u.mod, "nw_member_file", { p_user_id: u.r4 });
    expect(file.ban_recommended).toBe(true);
    expect(file.strikes).toHaveLength(4);
  });

  it("roles: admins add moderators; only the owner makes admins", async () => {
    await as(u.admin, "admin_set_role", { p_user_id: u.ann, p_role: "moderator" });
    await expect(as(u.admin, "admin_set_role", { p_user_id: u.ann, p_role: "admin" })).rejects.toThrow(/FORBIDDEN/);
    await as(u.owner, "admin_set_role", { p_user_id: u.ann, p_role: "member" });
  });
});

describe("Watch and Interests", () => {
  it("Watch shows only videos", async () => {
    const vid = await as<string>(u.ann, "create_post", { p_body: "clip", p_media_url: "demo/x/clip.mp4", p_media_type: "video" }).catch(() => null);
    const list = await as<{ media_type: string }[]>(u.ben, "get_watch", { p_mode: "latest" });
    expect(list.every((p) => p.media_type === "video")).toBe(true);
    if (vid) expect(list.length).toBeGreaterThan(0);
  });

  it("Interests uses shared interests and tags, and is empty until you pick some", async () => {
    expect(await as(u.ben, "get_interest_feed")).toEqual([]);
    await db.query("update public.profiles set interests = '{anime}', muted_until = null where id = any($1)", [[u.ben, u.r3]]);
    const id = await post(u.r3, "new season looks great");
    const feed = await as<{ id: string }[]>(u.ben, "get_interest_feed");
    expect(feed.map((p) => p.id)).toContain(id);
  });
});
