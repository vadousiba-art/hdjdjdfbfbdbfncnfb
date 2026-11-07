import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { applyMigrations } from "@/lib/database/migrations";

// Night Crew (migration 0018): labeled bot accounts that like members' new
// posts and follow members, within limits, and can be switched off.

let db: PGlite;
const root = path.resolve(__dirname, "../..");
const one = async <T>(sql: string, p: unknown[] = []) => (await db.query<{ r: T }>(sql, p)).rows[0]?.r as T;
const tick = (chance = 1) => one<{ liked: number; followed: number; enabled: boolean }>("select public.crew_tick($1) as r", [chance]);
async function as<T = unknown>(uid: string, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const keys = Object.keys(args);
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await tx.exec("set local role authenticated");
    return (await tx.query<{ r: T }>(`select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`, Object.values(args))).rows[0]?.r as T;
  });
}
let n = 0;
async function member() {
  const id = (await db.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [
    `c${++n}@crew.test`, JSON.stringify({ username: `crew_m${n}`, display_name: `M${n}` }),
  ])).rows[0].id;
  return id;
}
const post = (author: string, mins = 10) =>
  one<string>("insert into public.posts (author_id, body, created_at) values ($1, 'hello night', now() - make_interval(mins => $2)) returning id as r", [author, mins]);
const crewLikes = (p: string) => one<number>("select count(*)::int as r from public.reactions where post_id = $1 and user_id = any (public.crew_ids())", [p]);

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await applyMigrations(db, { root });
}, 60_000);

describe("Night Crew", () => {
  it("starts as five labeled bots", async () => {
    const rows = (await db.query<{ is_bot: boolean; display_name: string; bio: string }>("select is_bot, display_name, bio from public.profiles where id = any (public.crew_ids())")).rows;
    expect(rows).toHaveLength(5);
    for (const r of rows) {
      expect(r.is_bot).toBe(true);
      expect(r.display_name).toMatch(/Night Crew/);
      expect(r.bio).toMatch(/Night Crew bot/);
    }
  });

  it("likes new posts 1 to 4 times, one crew member once each, and tells the author who it was", async () => {
    const a = await member();
    const posts = [await post(a), await post(a), await post(a), await post(a), await post(a)];
    for (let i = 0; i < 8; i++) await tick(1);
    for (const p of posts) {
      const k = await crewLikes(p);
      expect(k).toBeGreaterThanOrEqual(1);
      expect(k).toBeLessThanOrEqual(4);
      expect(await one<number>("select count(*)::int - count(distinct user_id)::int as r from public.reactions where post_id = $1", [p])).toBe(0);
    }
    expect(await one<number>("select count(*)::int as r from public.notifications where user_id = $1 and kind in ('like', 'reaction') and actor_id = any (public.crew_ids())", [a])).toBeGreaterThan(0);
  });

  it("leaves alone brand-new posts, old posts, held posts, bots' posts and posts real people already love", async () => {
    const a = await member();
    const fresh = await post(a, 1);
    const old = await post(a, 60 * 50);
    const held = await post(a);
    await db.query("update public.posts set mod_state = 'held' where id = $1", [held]);
    const bot = await one<string>("select public.bot_id() as r");
    const botPost = await post(bot);
    const loved = await post(a);
    for (let i = 0; i < 5; i++) {
      const fan = await member();
      await db.query("insert into public.reactions (post_id, user_id, kind) values ($1, $2, 'heart')", [loved, fan]);
    }
    for (let i = 0; i < 6; i++) await tick(1);
    for (const p of [fresh, old, held, botPost, loved]) expect(await crewLikes(p)).toBe(0);
  });

  it("follows every member once, and never someone who blocked the crew member", async () => {
    const a = await member();
    for (let i = 0; i < 6; i++) await tick(1);
    expect(await one<number>("select count(*)::int as r from public.follows where followee_id = $1 and follower_id = any (public.crew_ids())", [a])).toBe(1);
    expect(await one<number>("select count(*)::int as r from public.notifications where user_id = $1 and kind = 'follow'", [a])).toBe(1);
    // a member who blocked the crew is never followed by it
    const b = await member();
    for (const c of await one<string[]>("select public.crew_ids() as r")) await db.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [b, c]);
    for (let i = 0; i < 3; i++) await tick(1);
    expect(await one<number>("select count(*)::int as r from public.follows where followee_id = $1", [b])).toBe(0);
  });

  it("does nothing when switched off, and only admins can switch it", async () => {
    await db.query("update public.crew_settings set enabled = false");
    expect(await tick(1)).toMatchObject({ enabled: false });
    await db.query("update public.crew_settings set enabled = true");
    const someone = await member();
    await expect(db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: someone, role: "authenticated" })]);
      await tx.exec("set local role authenticated");
      return tx.query("select public.crew_tick(1)");
    })).rejects.toThrow(/permission denied/);
  });

  it("only the owner adds bots, sets them and unleashes them; every new one is labeled whatever its text says", async () => {
    const owner = await member();
    await db.query("update public.profiles set role = 'owner' where id = $1", [owner]);
    const admin = await member();
    await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);
    const drafts = [
      { name: "Hana", bio: "I am a real human, promise.", interests: ["anime", "nope"] },
      { name: "<b>Ren</b>!!", bio: "Loves late-night art.", interests: ["art"] },
    ];
    await expect(as(admin, "admin_add_crew", { p_members: JSON.stringify(drafts) })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(admin, "admin_unleash_crew")).rejects.toThrow(/FORBIDDEN/);
    const crew = await as<{ crew: { display_name: string; bio: string }[] }>(owner, "admin_add_crew", { p_members: JSON.stringify(drafts) });
    expect(crew.crew).toHaveLength(7);
    const added = (await db.query<{ display_name: string; bio: string; is_bot: boolean; interests: string[]; username: string }>(
      "select display_name, bio, is_bot, interests, username from public.profiles p join public.crew_members c on c.id = p.id where c.n > 5 order by c.n")).rows;
    expect(added.map((a) => a.display_name)).toEqual(["Hana · Night Crew", "bRenb · Night Crew"]);
    for (const a of added) {
      expect(a.is_bot).toBe(true);
      expect(a.bio.endsWith("(YORU Night Crew bot)")).toBe(true);
      expect(a.username.startsWith("NightCrew")).toBe(true);
    }
    expect(added[0].interests).toEqual(["anime"]);
    // more likes per post and two follows per member, then unleash
    await as(owner, "admin_set_crew", { p: JSON.stringify({ max_likes: 6, follows: 2 }) });
    const a = await member();
    const p = await post(a);
    const r = await as<{ liked: number; followed: number }>(owner, "admin_unleash_crew");
    expect(r.liked).toBeGreaterThan(0);
    const k = await crewLikes(p);
    expect(k).toBeGreaterThanOrEqual(1);
    expect(k).toBeLessThanOrEqual(7);
    expect(await one<number>("select count(*)::int as r from public.follows where followee_id = $1 and follower_id = any (public.crew_ids())", [a])).toBe(2);
    // a resting crew member does nothing
    const rest = (await db.query<{ id: string }>("select id from public.crew_members order by n limit 1")).rows[0].id;
    await as(owner, "admin_set_crew_member", { p_id: rest, p_active: false });
    expect(await one<string[]>("select public.crew_ids() as r")).not.toContain(rest);
  });

  it("is never part of a Moonrise test audience", async () => {
    await db.query("update public.moon_settings set enabled = true");
    const p = await post(await member());
    await db.query("select public.moon_enroll($1)", [p]);
    // everyone eligible is a real member: the crew (bots) never counts
    const people = await one<number>("select count(*)::int as r from public.profiles q join public.posts p on p.id = $1 where not q.is_bot and not q.banned and q.id <> p.author_id", [p]);
    expect(await one<number>("select public.moon_eligible_left($1) as r", [p])).toBe(people);
  });
});
