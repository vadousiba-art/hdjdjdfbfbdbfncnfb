import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { applyMigrations } from "@/lib/database/migrations";
import { ALL_ITEMS, JESSE } from "@/lib/pro/catalog";
import { BEGIN, END, MEMBER_BEGIN, MEMBER_END, STAFF_BEGIN, STAFF_END, catalogSql, memberStaffSql, staffSql } from "@/lib/pro/catalog-sql";

// Pro Universe (migration 0009), from the database's point of view:
// ownership, previews, expiry, earned milestones, privacy of drafts and
// visits, honest analytics, scheduling and feed filters.

let db: PGlite;
const root = path.resolve(__dirname, "../..");
const u: Record<string, string> = {};

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
async function sqlAs(uid: string, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await tx.exec("set local role authenticated");
    return (await tx.query<Record<string, unknown>>(sql, params)).rows;
  });
}
async function signup(name: string) {
  const r = await db.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [
    `${name}@pro.test`,
    JSON.stringify({ username: name, display_name: name }),
  ]);
  return r.rows[0].id;
}
const post = (uid: string, body: string, media?: string) =>
  as<string>(uid, "create_post", { p_body: body, p_media_url: media ?? null, p_media_type: media ? "image" : null });
const publishDue = async () => (await db.query<{ r: { published: number } }>("select public.pro_publish_due(50, 'test') as r")).rows[0].r;
type MyPro = {
  membership: { pro: boolean; status: string };
  milestones: Record<string, string>;
  progress: Record<string, number>;
  equips: Record<string, { item: string; active: boolean }>;
  wishlist: string[];
  scheduler: { running: boolean };
};

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await applyMigrations(db, { root });
  u.owner = await signup("pro_owner");
  u.ann = await signup("pro_ann");
  u.ben = await signup("pro_ben");
  u.cy = await signup("pro_cy");
});

describe("catalog", () => {
  it("the migration holds exactly the generated catalog", () => {
    const sql = fs.readFileSync(path.join(root, "supabase/migrations/0009_pro_universe.sql"), "utf8");
    const block = sql.slice(sql.indexOf(BEGIN) + BEGIN.length, sql.indexOf(END)).trim();
    expect(block).toBe(catalogSql().trim());
  });

  it("migration 0010 holds exactly the generated staff items", () => {
    const sql = fs.readFileSync(path.join(root, "supabase/migrations/0010_staff_cosmetics.sql"), "utf8");
    const block = sql.slice(sql.indexOf(STAFF_BEGIN) + STAFF_BEGIN.length, sql.indexOf(STAFF_END)).trim();
    expect(block).toBe(staffSql().trim());
  });

  it("migration 0012 holds exactly the generated personal staff items", () => {
    const sql = fs.readFileSync(path.join(root, "supabase/migrations/0012_cofounder_cosmetics.sql"), "utf8");
    const block = sql.slice(sql.indexOf(MEMBER_BEGIN) + MEMBER_BEGIN.length, sql.indexOf(MEMBER_END)).trim();
    expect(block).toBe(memberStaffSql().trim());
  });

  it("has the same 400 member items plus 24 staff items, with the app's ids and rules", async () => {
    const rows = (await db.query<{ id: string; cat: string; unlock: string; status: string }>("select id, cat, unlock, status from public.pro_catalog order by id")).rows;
    expect(rows).toHaveLength(424);
    const app = [...ALL_ITEMS].sort((a, b) => (a.id < b.id ? -1 : 1)).map((i) => ({ id: i.id, cat: i.cat, unlock: i.unlock, status: i.status }));
    expect(rows).toEqual(app);
  });

  it("is readable by members, not by visitors, and not writable by anyone but the server", async () => {
    expect((await sqlAs(u.ann, "select count(*)::int as n from public.pro_catalog"))[0].n).toBe(424);
    await expect(sqlAs(u.ann, "update public.pro_catalog set unlock = 'free'")).rejects.toThrow(/permission denied/);
    await expect(as(null, "get_my_pro")).rejects.toThrow(/permission denied/);
  });
});

describe("ownership and equipping", () => {
  it("equips free items for anyone and shows them on posts", async () => {
    const e = await as<Record<string, { item: string }>>(u.ann, "pro_equip", { p_slot: "ring", p_item: "ring.void_halo" });
    expect(e.ring.item).toBe("ring.void_halo");
    const id = await post(u.ann, "ring check");
    const p = await as<{ author: { look: { ring: string } } }>(u.ben, "get_post", { p_id: id });
    expect(p.author.look.ring).toBe("ring.void_halo");
  });

  it("refuses Pro items without Pro, even when the request is crafted by hand", async () => {
    await expect(as(u.ann, "pro_equip", { p_slot: "ring", p_item: "ring.crimson_eclipse" })).rejects.toThrow(/FORBIDDEN/);
    await expect(sqlAs(u.ann, "insert into public.pro_equips (user_id, slot, item_id) values (auth.uid(), 'ring', 'ring.crimson_eclipse')")).rejects.toThrow(/permission denied/);
    await expect(sqlAs(u.ann, "insert into public.entitlements (user_id, source) values (auth.uid(), 'comp')")).rejects.toThrow(/permission denied/);
    await expect(as(u.ann, "pro_owns", { p_user: u.ann, p_item: "ring.crimson_eclipse" })).rejects.toThrow(/permission denied/);
  });

  it("refuses wrong slots and unknown items", async () => {
    await expect(as(u.ann, "pro_equip", { p_slot: "ring", p_item: "banner.after_dark" })).rejects.toThrow(/INVALID/);
    await expect(as(u.ann, "pro_equip", { p_slot: "ring", p_item: "ring.nope" })).rejects.toThrow(/NOT_FOUND/);
    await expect(as(u.ann, "pro_equip", { p_slot: "crown", p_item: "ring.void_halo" })).rejects.toThrow(/INVALID/);
  });

  it("Pro unlocks Pro items; expiry falls back to the default but keeps the choice", async () => {
    await as(u.owner, "admin_grant_pro", { p_user: u.ben, p_days: 30 });
    await as(u.ben, "pro_equip", { p_slot: "ring", p_item: "ring.crimson_eclipse" });
    await as(u.ben, "pro_equip", { p_slot: "banner", p_item: "banner.neon_tokyo" });
    let idn = await as<{ look: { ring?: string; banner?: string } }>(u.cy, "get_profile_identity", { p_username: "pro_ben" });
    expect(idn.look.ring).toBe("ring.crimson_eclipse");
    await db.query("update public.entitlements set ends_at = now() - interval '1 minute' where user_id = $1", [u.ben]);
    idn = await as(u.cy, "get_profile_identity", { p_username: "pro_ben" });
    expect(idn.look.ring).toBeUndefined();
    expect(idn.look.banner).toBeUndefined();
    const mine = await as<MyPro>(u.ben, "get_my_pro");
    expect(mine.membership.status).toBe("expired");
    expect(mine.equips.ring).toEqual({ item: "ring.crimson_eclipse", active: false });
    // renewing brings it back
    await as(u.owner, "admin_grant_pro", { p_user: u.ben, p_days: 30 });
    idn = await as(u.cy, "get_profile_identity", { p_username: "pro_ben" });
    expect(idn.look.ring).toBe("ring.crimson_eclipse");
    expect((await as<MyPro>(u.ben, "get_my_pro")).membership.status).toBe("comp");
  });

  it("testers (complimentary Pro) can use milestone cosmetics, but not unearned milestones", async () => {
    await as(u.ben, "pro_equip", { p_slot: "ring", p_item: "ring.celestial_orbit" });
    await expect(as(u.ben, "pro_equip", { p_slot: "milestone", p_item: "milestone.eternal_night" })).rejects.toThrow(/Earn this one/);
    await as(u.ben, "pro_equip", { p_slot: "ring", p_item: "ring.crimson_eclipse" });
  });

  it("bundles equip only what you own and report the rest", async () => {
    const r = await as<{ skipped: string[] }>(u.cy, "pro_equip_many", {
      p: { ring: "ring.silver_moon", banner: "banner.moonlit_shrine", theme: "theme.silver_eclipse" },
    });
    expect(r.skipped.sort()).toEqual(["banner.moonlit_shrine", "theme.silver_eclipse"]);
    expect((await as<MyPro>(u.cy, "get_my_pro")).equips.ring.item).toBe("ring.silver_moon");
  });

  it("experimental items need the Lab switch, and the switch needs Pro", async () => {
    const s = await as<{ labs: string[] }>(u.cy, "pro_save_settings", { p: { labs: ["lab.experimental_effects", "lab.live_ring_preview"] } });
    expect(s.labs).toEqual(["lab.live_ring_preview"]);
    await expect(as(u.ben, "pro_equip", { p_slot: "effect", p_item: "effect.void_distortion" })).rejects.toThrow(/Experimental/);
    await as(u.ben, "pro_save_settings", { p: { labs: ["lab.experimental_effects"] } });
    await as(u.ben, "pro_equip", { p_slot: "effect", p_item: "effect.void_distortion" });
  });

  it("unequip and reset", async () => {
    await as(u.cy, "pro_equip", { p_slot: "ring" });
    expect((await as<MyPro>(u.cy, "get_my_pro")).equips.ring).toBeUndefined();
    await as(u.ben, "pro_reset_look");
    expect((await as<MyPro>(u.ben, "get_my_pro")).equips).toEqual({});
  });
});

describe("staff cosmetics", () => {
  it("only the founder wears founder items; admins wear admin items; Pro testers get neither", async () => {
    await as(u.owner, "pro_equip", { p_slot: "ring", p_item: "ring.founders_eclipse" });
    await as(u.owner, "pro_equip", { p_slot: "banner", p_item: "banner.the_night_watch" }); // the founder may wear admin items too
    expect((await as<{ role: string }>(u.owner, "get_my_pro")).role).toBe("owner");
    // ben has complimentary Pro (a tester), which never includes staff items
    await expect(as(u.ben, "pro_equip", { p_slot: "ring", p_item: "ring.sentinel" })).rejects.toThrow(/reserved for YORU staff/);
    await expect(as(u.ben, "pro_equip", { p_slot: "ring", p_item: "ring.founders_eclipse" })).rejects.toThrow(/reserved for YORU staff/);
    await db.query("update public.profiles set role = 'admin' where id = $1", [u.ann]);
    await as(u.ann, "pro_equip", { p_slot: "ring", p_item: "ring.sentinel" });
    await expect(as(u.ann, "pro_equip", { p_slot: "nameplate", p_item: "nameplate.founder" })).rejects.toThrow(/reserved for YORU staff/);
  });

  it("the co-founder's set is Jesse's alone: not other admins, not the founder, and only while he is staff", async () => {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      JESSE, "jesse@pro.test", JSON.stringify({ username: "pro_jesse", display_name: "Jesse" }),
    ]);
    const other = await signup("pro_admin2");
    await db.query("update public.profiles set role = 'admin' where id = $1", [other]);
    // Not staff yet: locked, like any member.
    await expect(as(JESSE, "pro_equip", { p_slot: "ring", p_item: "ring.live_wire" })).rejects.toThrow(/reserved for YORU staff/);
    await db.query("update public.profiles set role = 'admin' where id = $1", [JESSE]);
    await as(JESSE, "pro_equip", { p_slot: "ring", p_item: "ring.live_wire" });
    const mine = await as<{ id: string; role: string; equips: Record<string, { item: string; active: boolean }> }>(JESSE, "get_my_pro");
    expect(mine.id).toBe(JESSE);
    expect(mine.equips.ring).toEqual({ item: "ring.live_wire", active: true });
    await expect(as(other, "pro_equip", { p_slot: "ring", p_item: "ring.live_wire" })).rejects.toThrow(/reserved for YORU staff/);
    await expect(as(u.owner, "pro_equip", { p_slot: "banner", p_item: "banner.high_voltage" })).rejects.toThrow(/reserved for YORU staff/);
    // He doesn't get the founder's items either.
    await expect(as(JESSE, "pro_equip", { p_slot: "nameplate", p_item: "nameplate.founder" })).rejects.toThrow(/reserved for YORU staff/);
    const idn = await as<{ look: { ring?: string } }>(u.cy, "get_profile_identity", { p_username: "pro_jesse" });
    expect(idn.look.ring).toBe("ring.live_wire");
  });

  it("migration 0012 puts the set on Jesse's profile without replacing anything he chose", async () => {
    const freeBanner = ALL_ITEMS.find((i) => i.cat === "banner" && i.unlock === "free")!.id;
    await as(JESSE, "pro_equip", { p_slot: "banner", p_item: freeBanner });
    const sql = fs.readFileSync(path.join(root, "supabase/migrations/0012_cofounder_cosmetics.sql"), "utf8");
    await db.exec(sql.slice(sql.indexOf("insert into public.pro_equips")));
    const eq = (await as<{ equips: Record<string, { item: string; active: boolean }> }>(JESSE, "get_my_pro")).equips;
    expect(eq.banner.item).toBe(freeBanner); // his own choice stays
    expect(Object.fromEntries(Object.entries(eq).map(([k, v]) => [k, v.item]))).toMatchObject({
      ring: "ring.live_wire", nameplate: "nameplate.co_founder", badge: "badge.co_founders_chip", theme: "theme.circuit_night",
      effect: "effect.static_charge", reaction: "reaction.overload", chat: "chat.server_room",
    });
    expect(Object.values(eq).every((v) => v.active)).toBe(true);
    // Losing the staff role takes it all off by itself (the free banner stays).
    await db.query("update public.profiles set role = 'member' where id = $1", [JESSE]);
    const after = (await as<{ equips: Record<string, { item: string; active: boolean }> }>(JESSE, "get_my_pro")).equips;
    expect(after.ring.active).toBe(false);
    expect(after.banner.active).toBe(true);
    await db.query("update public.profiles set role = 'admin' where id = $1", [JESSE]);
  });

  it("a removed role takes the item off by itself, keeping the stored choice", async () => {
    let idn = await as<{ look: { ring?: string } }>(u.cy, "get_profile_identity", { p_username: "pro_ann" });
    expect(idn.look.ring).toBe("ring.sentinel");
    await db.query("update public.profiles set role = 'member' where id = $1", [u.ann]);
    idn = await as(u.cy, "get_profile_identity", { p_username: "pro_ann" });
    expect(idn.look.ring).toBeUndefined();
    expect((await as<{ equips: Record<string, { item: string; active: boolean }> }>(u.ann, "get_my_pro")).equips.ring).toEqual({ item: "ring.sentinel", active: false });
    await as(u.ann, "pro_equip", { p_slot: "ring", p_item: "ring.void_halo" });
  });
});

describe("milestones", () => {
  it("are earned by doing, never granted early", async () => {
    let me = await as<MyPro>(u.cy, "get_my_pro");
    expect(me.milestones.first_night).toBeUndefined();
    await expect(as(u.cy, "pro_equip", { p_slot: "ring", p_item: "ring.celestial_orbit" })).rejects.toThrow(/Earn this one/);
    await post(u.cy, "first night #anime");
    me = await as<MyPro>(u.cy, "get_my_pro");
    expect(me.milestones.first_night).toBeTruthy();
    expect(me.milestones.personal_archive).toBeUndefined();
    await as(u.cy, "pro_equip", { p_slot: "ring", p_item: "ring.celestial_orbit" });
  });

  it("show on the profile timeline unless hidden, and can't be inserted by hand", async () => {
    let idn = await as<{ timeline: { key: string }[] }>(u.ann, "get_profile_identity", { p_username: "pro_cy" });
    expect(idn.timeline.map((t) => t.key)).toContain("first_night");
    await as(u.cy, "pro_save_settings", { p: { show_timeline: false } });
    idn = await as(u.ann, "get_profile_identity", { p_username: "pro_cy" });
    expect(idn.timeline).toEqual([]);
    await expect(sqlAs(u.ann, "insert into public.pro_milestones (user_id, key) values (auth.uid(), 'eternal_night')")).rejects.toThrow(/permission denied/);
  });
});

describe("wishlist and settings", () => {
  it("toggles and stays private", async () => {
    expect((await as<{ wished: boolean }>(u.ann, "pro_wishlist_toggle", { p_item: "banner.neon_tokyo" })).wished).toBe(true);
    expect((await as<MyPro>(u.ann, "get_my_pro")).wishlist).toEqual(["banner.neon_tokyo"]);
    expect(await sqlAs(u.ben, "select * from public.pro_wishlist")).toEqual([]);
    expect((await as<{ wished: boolean }>(u.ann, "pro_wishlist_toggle", { p_item: "banner.neon_tokyo" })).wished).toBe(false);
  });

  it("validates settings", async () => {
    await expect(as(u.ann, "pro_save_settings", { p: { is_pro: true } })).rejects.toThrow(/Unknown setting/);
    const s = await as<Record<string, unknown>>(u.ann, "pro_save_settings", {
      p: { sound_volume: 400, layout_order: ["pinned", "nope", "stats", "pinned"], muted_words: ["Spoiler", " spoiler ", ""] },
    });
    expect(s.sound_volume).toBe(100);
    expect(s.layout_order).toEqual(["pinned", "stats"]);
    expect(s.muted_words).toEqual(["spoiler"]);
  });
});

describe("drafts and scheduling", () => {
  let draft: string;

  it("drafts are private to their owner", async () => {
    const d = await as<{ id: string; status: string }>(u.ann, "pro_save_draft", { p_id: null, p: { body: "hello later #art" } });
    draft = d.id;
    expect(d.status).toBe("draft");
    expect(await sqlAs(u.ben, "select * from public.pro_drafts")).toEqual([]);
    await expect(as(u.ben, "pro_save_draft", { p_id: draft, p: { body: "hijack" } })).rejects.toThrow(/NOT_FOUND/);
    await expect(as(u.ben, "pro_delete_draft", { p_id: draft })).rejects.toThrow(/NOT_FOUND/);
    await expect(as(u.ben, "pro_schedule_draft", { p_id: draft, p_at: new Date(Date.now() + 3600e3).toISOString() })).rejects.toThrow(/NOT_FOUND/);
  });

  it("refuses Pro templates and other people's uploads", async () => {
    await expect(as(u.ann, "pro_save_draft", { p_id: null, p: { template: "draft.music_release", body: "x" } })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(u.ann, "pro_save_draft", { p_id: null, p: { media_url: `u/${u.ben}/pic.jpg`, media_type: "image" } })).rejects.toThrow(/own uploads/);
    await as(u.ann, "pro_save_draft", { p_id: null, p: { template: "draft.question_post", body: "? " } });
  });

  it("won't schedule while no scheduler is running", async () => {
    await expect(as(u.ann, "pro_schedule_draft", { p_id: draft, p_at: new Date(Date.now() + 3600e3).toISOString() })).rejects.toThrow(/UNAVAILABLE/);
  });

  it("publishes due drafts as the author, once, and lets you cancel", async () => {
    await publishDue(); // the scheduler's first heartbeat
    expect((await as<MyPro>(u.ann, "get_my_pro")).scheduler.running).toBe(true);
    await expect(as(u.ann, "pro_schedule_draft", { p_id: draft, p_at: new Date(Date.now() - 1000).toISOString() })).rejects.toThrow(/minute/);
    await as(u.ann, "pro_schedule_draft", { p_id: draft, p_at: new Date(Date.now() + 3600e3).toISOString(), p_timezone: "Asia/Tokyo" });
    const other = await as<{ id: string }>(u.ann, "pro_save_draft", { p_id: null, p: { body: "cancelled one" } });
    await as(u.ann, "pro_schedule_draft", { p_id: other.id, p_at: new Date(Date.now() + 3600e3).toISOString() });
    await as(u.ann, "pro_schedule_draft", { p_id: other.id, p_at: null });
    await db.query("update public.pro_drafts set scheduled_at = now() - interval '1 second' where owner_id = $1", [u.ann]);
    expect((await publishDue()).published).toBe(1);
    const rows = (await db.query<{ status: string; post_id: string | null; body: string }>("select status, post_id, body from public.pro_drafts where owner_id = $1 order by body", [u.ann])).rows;
    expect(rows.find((r) => r.body === "cancelled one")!.status).toBe("draft");
    const pub = rows.find((r) => r.body.startsWith("hello later"))!;
    expect(pub.status).toBe("published");
    const p = (await db.query<{ author_id: string; hashtags: string[] }>("select author_id, hashtags from public.posts where id = $1", [pub.post_id])).rows[0];
    expect(p.author_id).toBe(u.ann);
    expect(p.hashtags).toContain("art");
    expect((await publishDue()).published).toBe(0); // never twice
  });

  it("follows the normal rules: a muted author's post fails after 3 tries, with the reason", async () => {
    const d = await as<{ id: string }>(u.ben, "pro_save_draft", { p_id: null, p: { body: "while muted" } });
    await as(u.ben, "pro_schedule_draft", { p_id: d.id, p_at: new Date(Date.now() + 120e3).toISOString() });
    await db.query("update public.profiles set muted_until = now() + interval '1 day' where id = $1", [u.ben]);
    for (let i = 0; i < 3; i++) {
      await db.query("update public.pro_drafts set scheduled_at = now() - interval '1 second' where id = $1", [d.id]);
      await publishDue();
    }
    const row = (await db.query<{ status: string; error: string; attempts: number }>("select status, error, attempts from public.pro_drafts where id = $1", [d.id])).rows[0];
    expect(row).toMatchObject({ status: "failed", attempts: 3 });
    expect(row.error).toMatch(/muted/i);
    expect((await db.query("select 1 from public.posts where body = 'while muted'")).rows).toHaveLength(0);
    await db.query("update public.profiles set muted_until = null where id = $1", [u.ben]);
  });

  it("members can't run the publisher themselves", async () => {
    await expect(as(u.ann, "pro_publish_due", { p_limit: 5, p_runner: "me" })).rejects.toThrow(/permission denied/);
  });
});

describe("analytics and insights", () => {
  type A = { kpis: Record<string, number>; top: unknown[]; hours: number[] | null; weekly: { reactions: number }[]; reaction_kinds: Record<string, number> };

  it("a brand-new member gets zeros, never sample numbers", async () => {
    const id = await signup("pro_new");
    const a = await as<A>(id, "get_creator_analytics");
    expect(a.kpis).toMatchObject({ posts: 0, reactions: 0, comments: 0, engagers: 0, visits_30d: 0 });
    expect(a.top).toEqual([]);
    expect(a.hours).toBeNull();
    expect(a.weekly.every((w) => w.reactions === 0)).toBe(true);
  });

  it("counts real engagement from other members only", async () => {
    const id = await post(u.cy, "count me");
    await as(u.cy, "toggle_reaction", { p_post_id: id, p_kind: "heart" }); // own: not counted
    await as(u.ann, "toggle_reaction", { p_post_id: id, p_kind: "fire" });
    await as(u.ben, "toggle_reaction", { p_post_id: id, p_kind: "fire" });
    const a = await as<A>(u.cy, "get_creator_analytics");
    expect(a.kpis.reactions).toBe(2);
    expect(a.kpis.engagers).toBe(2);
    expect(a.reaction_kinds).toEqual({ fire: 2 });
  });

  it("profile visits are counted once per visitor per day, never for yourself, and never name the visitor", async () => {
    await as(u.ann, "pro_record_profile_view", { p_username: "pro_cy" });
    await as(u.ann, "pro_record_profile_view", { p_username: "pro_cy" });
    await as(u.ben, "pro_record_profile_view", { p_username: "pro_cy" });
    await as(u.cy, "pro_record_profile_view", { p_username: "pro_cy" });
    expect((await as<A>(u.cy, "get_creator_analytics")).kpis.visits_30d).toBe(2);
    await expect(sqlAs(u.cy, "select * from public.pro_profile_view_seen")).rejects.toThrow(/permission denied/);
    expect(await sqlAs(u.ann, "select * from public.pro_profile_views")).toEqual([]);
    const text = JSON.stringify(await as(u.cy, "get_creator_analytics"));
    expect(text).not.toContain(u.ann);
    expect(text).not.toContain("pro_ann");
  });
});

describe("feed presets and hubs", () => {
  it("free presets filter for real; Pro presets need Pro, except a 5-post preview", async () => {
    await post(u.ann, "pic post #art", `u/${u.ann}/a.jpg`);
    const free = await as<{ hashtags: string[] }[]>(u.cy, "get_feed_preset", { p_preset: "feed.anime_discovery" });
    expect(free.length).toBeGreaterThan(0);
    expect(free.every((p) => p.hashtags.includes("anime"))).toBe(true);
    await expect(as(u.cy, "get_feed_preset", { p_preset: "feed.image_focus" })).rejects.toThrow(/FORBIDDEN/);
    const preview = await as<{ media_type: string }[]>(u.cy, "get_feed_preset", { p_preset: "feed.image_focus", p_preview: true, p_limit: 50 });
    expect(preview.length).toBeLessThanOrEqual(5);
    expect(preview.every((p) => p.media_type === "image")).toBe(true);
  });

  it("muted words hide matching posts", async () => {
    await post(u.ann, "big SPOILER ahead");
    await as(u.ben, "pro_save_settings", { p: { muted_words: ["spoiler"] } });
    const posts = await as<{ body: string }[]>(u.ben, "get_feed_preset", { p_preset: "feed.muted_keywords", p_limit: 50 });
    expect(posts.some((p) => /spoiler/i.test(p.body))).toBe(false);
  });

  it("hubs show real posts and only discoverable members", async () => {
    await as(u.ann, "update_my_identity", { p: { interests: ["anime"] } });
    const h = await as<{ posts: { hashtags: string[] }[]; members: { username: string }[] }>(u.ben, "get_hub", { p_hub: "hub.anime_central" });
    expect(h.posts.every((p) => p.hashtags.some((t) => ["anime", "animerecs"].includes(t)))).toBe(true);
    expect(h.members.map((m) => m.username)).toContain("pro_ann");
    await as(u.ann, "update_my_identity", { p: { discoverable: false } });
    const h2 = await as<{ members: { username: string }[] }>(u.ben, "get_hub", { p_hub: "hub.anime_central" });
    expect(h2.members.map((m) => m.username)).not.toContain("pro_ann");
  });

  it("pinning a Pro hub needs Pro", async () => {
    const s = await as<{ pinned_hubs: string[] }>(u.cy, "pro_save_settings", { p: { pinned_hubs: ["hub.anime_central", "hub.cosplay_corner"] } });
    expect(s.pinned_hubs).toEqual(["hub.anime_central"]);
  });
});

describe("Collections+ styles", () => {
  it("Pro templates need Pro; sort and visibility are respected", async () => {
    const c = await as<{ id: string }>(u.cy, "save_collection", { p_name: "Faves", p_visibility: "private" });
    await expect(as(u.cy, "pro_style_collection", { p_id: c.id, p_template: "collection.vocaloid_vault" })).rejects.toThrow(/FORBIDDEN/);
    const styled = await as<{ template: string; sort: string }>(u.cy, "pro_style_collection", { p_id: c.id, p_template: "collection.anime_watchlist", p_sort: "popular" });
    expect(styled).toMatchObject({ template: "collection.anime_watchlist", sort: "popular" });
    await expect(as(u.ann, "get_collection_page", { p_id: c.id })).rejects.toThrow(/NOT_FOUND/);
    expect((await as<{ template: string | null }>(u.cy, "pro_style_collection", { p_id: c.id, p_template: "" })).template).toBeNull();
    await expect(as(u.ann, "pro_style_collection", { p_id: c.id, p_sort: "added_asc" })).rejects.toThrow(/NOT_FOUND/);
  });
});
