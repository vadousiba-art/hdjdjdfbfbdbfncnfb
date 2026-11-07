import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { applyMigrations } from "@/lib/database/migrations";

// Following, notifications, and Moonrise (migration 0017, docs/MOONRISE.md).
// The "No mistakes" list in the design doc maps onto the tests below.

let db: PGlite;
const root = path.resolve(__dirname, "../..");
let n = 0;

type Post = { id: string; lane?: string; why?: string; moon?: number | null; author: { id: string } };
type Status = { phase: number; name: string; round: number; state: string; target: number; shown: number; loved: number; rate: number | null; score: number; bar: number; history: { phase: number; round: number; result: string }[] };

async function as<T = unknown>(uid: string | null, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const keys = Object.keys(args);
  const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
  return db.transaction(async (tx) => {
    if (uid) {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
      await tx.exec("set local role authenticated");
    } else await tx.exec("set local role anon");
    return (await tx.query<{ r: T }>(sql, Object.values(args))).rows[0]?.r as T;
  });
}
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<{ r: T }>(sql, params)).rows[0]?.r as T;

/** A member with these interests, whose account is `ageDays` old. */
async function member(interests: string[] = [], ageDays = 3) {
  const name = `m${++n}`;
  const id = (await db.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [
    `${name}@moon.test`,
    JSON.stringify({ username: `moon_${name}`, display_name: `Moon ${name}` }),
  ])).rows[0].id;
  await db.query("update public.profiles set interests = $2, created_at = now() - make_interval(days => $3) where id = $1", [id, interests, ageDays]);
  return id;
}
const crowd = async (k: number, interests: string[] = ["anime"]) => Promise.all(Array.from({ length: k }, () => member(interests)));
/** A post written straight into the table (no per-user post rate limit), triggers and all. */
const rawPost = async (author: string, body: string) => one<string>("insert into public.posts (author_id, body) values ($1, $2) returning id as r", [author, body]);
const forYou = (uid: string, seen: string[] = [], hour = 22) => as<Post[]>(uid, "get_for_you", { p_seen: `{${seen.join(",")}}`, p_limit: 15, p_hour: hour });
/** Every post a viewer meets in a Moonrise test while scrolling a few pages. */
async function moonPicks(uid: string, seen: string[] = [], hour = 22, pages = 6) {
  const picks: string[] = [];
  const ids = [...seen];
  for (let i = 0; i < pages; i++) {
    const page = await forYou(uid, ids, hour);
    if (!page.length) break;
    ids.push(...page.map((p) => p.id));
    picks.push(...page.filter((p) => p.lane === "moonrise").map((p) => p.id));
  }
  return picks;
}
const tick = () => one<{ decided: number; moved_up: number; erased: number }>("select public.moon_tick(500) as r");
const row = (post: string) => db.query<{ phase: number; round: number; state: string; shown: number; target: number; tags: string[] }>("select phase, round, state, shown, target, tags from public.moon_posts where post_id = $1", [post]).then((r) => r.rows[0]);
const status = (uid: string, post: string) => as<Status>(uid, "get_moon_status", { p_post: post });
/** Show `post` to these viewers as part of its current test (what the Moonrise lane records). */
const show = (post: string, viewers: string[], weight = 1) =>
  db.query(
    `insert into public.moon_shown (post_id, viewer_id, phase, round, weight)
     select mp.post_id, v, mp.phase, mp.round, $3 from public.moon_posts mp, unnest($2::uuid[]) v where mp.post_id = $1`,
    [post, `{${viewers.join(",")}}`, weight],
  );
const love = (uid: string, post: string, kind = "heart") => as(uid, "toggle_reaction", { p_post_id: post, p_kind: kind });
/** Its test window (12 hours) has passed. */
const age = (post: string, hours = 13) =>
  db.query("update public.moon_posts set phase_started_at = now() - make_interval(hours => $2), not_before = now() - make_interval(hours => $2) where post_id = $1", [post, hours]);
/** A post in New Moon whose 12 hours are up: shown to `shown` strangers, `loved` of whom loved it. */
async function scenario(shown: number, loved: number, tag = "anime") {
  const author = await member([tag]);
  const post = await rawPost(author, `test post #${tag}`);
  const people = await crowd(shown, [tag]);
  await show(post, people);
  for (const p of people.slice(0, loved)) await love(p, post);
  await age(post);
  return { author, post, people };
}
/** The score the database ranks by: the love rate as if 20 more people had seen it and 2 (10%) had loved it. */
const score = (k: number, total: number) => (k + 2) / (total + 20);

let admin: string;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await applyMigrations(db, { root });
  admin = await member();
  await db.query("update public.profiles set role = 'admin' where id = $1", [admin]);
}, 60_000);

describe("following", () => {
  it("follows and unfollows, with counts, and tells the person once", async () => {
    const [a, b] = [await member(), await member()];
    expect(await as(a, "follow_user", { p_user: b })).toEqual({ followers: 1, following: 0, i_follow: true, follows_me: false });
    await as(a, "follow_user", { p_user: b }); // again: nothing changes, no second notification
    expect(await as(b, "get_follow_state", { p_user: a })).toEqual({ followers: 0, following: 1, i_follow: false, follows_me: true });
    expect(await one<number>("select count(*)::int as r from public.notifications where user_id = $1 and kind = 'follow'", [b])).toBe(1);
    const list = await as<{ id: string }[]>(b, "list_follows", { p_user: b, p_kind: "followers" });
    expect(list.map((x) => x.id)).toEqual([a]);
    expect(await as(a, "unfollow_user", { p_user: b })).toMatchObject({ followers: 0, i_follow: false });
  });

  it("refuses following yourself, and visitors can't see or change follows", async () => {
    const a = await member();
    await expect(as(a, "follow_user", { p_user: a })).rejects.toThrow(/INVALID/);
    await expect(as(null, "follow_user", { p_user: a })).rejects.toThrow(/permission denied/);
    await expect(as(a, "list_follows", { p_user: a, p_kind: "everyone" })).rejects.toThrow(/INVALID/);
    await expect(db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: a, role: "authenticated" })]);
      await tx.exec("set local role authenticated");
      return tx.query("select * from public.follows");
    })).rejects.toThrow(/permission denied/);
  });

  it("blocking ends following both ways, and blocked accounts can't follow", async () => {
    const [a, b] = [await member(), await member()];
    await as(a, "follow_user", { p_user: b });
    await as(b, "follow_user", { p_user: a });
    await as(a, "toggle_block", { p_user_id: b });
    expect(await one<number>("select count(*)::int as r from public.follows where $1 in (follower_id, followee_id)", [a])).toBe(0);
    await expect(as(b, "follow_user", { p_user: a })).rejects.toThrow(/FORBIDDEN/);
  });
});

describe("notifications", () => {
  it("new posts notify followers only, unless they turned it off", async () => {
    const [author, fan, quietFan, stranger] = [await member(), await member(), await member(), await member()];
    await as(fan, "follow_user", { p_user: author });
    await as(quietFan, "follow_user", { p_user: author });
    await as(quietFan, "set_notification_prefs", { p: JSON.stringify({ following_posts: false }) });
    await db.query("update public.profiles set notification_prefs = notification_prefs || '{\"friend_posts\": true}' where id = $1", [stranger]);
    const post = await as<string>(author, "create_post", { p_body: "first night out" });
    const got = (await db.query<{ user_id: string }>("select user_id from public.notifications where post_id = $1 and kind = 'new_post'", [post])).rows.map((r) => r.user_id);
    expect(got).toEqual([fan]); // not the quiet follower, not a stranger who had "every post" on
    expect(await one<number>("select count(*)::int as r from public.notifications where post_id = $1 and kind = 'friend_post'", [post])).toBe(0);
  });

  it("settings take the new switches and ignore anything else", async () => {
    const a = await member();
    const prefs = await as<Record<string, unknown>>(a, "set_notification_prefs", { p: JSON.stringify({ follows: false, top_posts: false, moonrise: true, admin: true, likes: "no" }) });
    expect(prefs).toMatchObject({ follows: false, top_posts: false, moonrise: true });
    expect(prefs).not.toHaveProperty("admin");
    expect(prefs.likes).not.toBe("no");
    const b = await member();
    await as(b, "follow_user", { p_user: a });
    expect(await one<number>("select count(*)::int as r from public.notifications where user_id = $1 and kind = 'follow'", [a])).toBe(0);
  });

  it("reading a chat reads its message notifications, so they're never pushed", async () => {
    const [a, b] = [await member(), await member()];
    const dm = await as<string>(a, "start_dm", { p_user_id: b });
    await as(a, "send_message", { p_channel_id: dm, p_body: "you up?" });
    const unread = () => one<number>("select count(*)::int as r from public.notifications where user_id = $1 and kind = 'message' and read_at is null", [b]);
    expect(await unread()).toBe(1);
    await as(b, "mark_channel_read", { p_channel_id: dm });
    expect(await unread()).toBe(0);
  });
});

describe("Moonrise", () => {
  it("is off by default: nothing enters it and For You still works", async () => {
    expect(await as(admin, "get_moonrise")).toMatchObject({ enabled: false });
    const [author, viewer] = [await member(["anime"]), await member(["anime"])];
    const post = await rawPost(author, "off #anime");
    expect(await row(post)).toBeUndefined();
    const page = await forYou(viewer);
    expect(page.some((p) => p.id === post)).toBe(true);
    expect(page.every((p) => p.lane !== "moonrise")).toBe(true);
    expect(await tick()).toEqual({ enabled: false });
  });

  it("only admins switch it on; switching on brings in the last day's posts", async () => {
    const author = await member(["gaming"]);
    const post = await rawPost(author, "before the switch #gaming");
    await expect(as(author, "admin_set_moonrise", { p: JSON.stringify({ enabled: true }) })).rejects.toThrow(/FORBIDDEN/);
    await expect(as(admin, "admin_set_moonrise", { p: JSON.stringify({ quotas: [0.4, 2, 0.1, 0.05] }) })).rejects.toThrow(/INVALID/);
    await expect(as(admin, "admin_set_moonrise", { p: JSON.stringify({ sizes: [100, 20, 500] }) })).rejects.toThrow(/INVALID/);
    expect(await as(admin, "admin_set_moonrise", { p: JSON.stringify({ enabled: true }) })).toMatchObject({ enabled: true });
    expect(await row(post)).toMatchObject({ phase: 0, round: 1, state: "testing", target: 20, tags: ["gaming"] });
    expect(await one<number>("select count(*)::int as r from public.audit_log where action = 'moonrise_settings'")).toBe(1);
  });

  it("enters every new post (not reposts, bots or the official account), tagged with its fandom", async () => {
    const author = await member(["music", "art"]);
    expect((await row(await rawPost(author, "new #anime and #nightwalk")))?.tags).toEqual(["anime"]); // only real interests
    expect((await row(await rawPost(author, "no tags")))?.tags).toEqual(["art", "music"]); // the author's interests
    expect((await row(await rawPost(await member([]), "nothing at all")))?.tags).toEqual([]); // anyone
    const orig = await rawPost(author, "to repost");
    const fan = await member();
    await as(fan, "toggle_repost", { p_post_id: orig });
    expect(await one<number>("select count(*)::int as r from public.moon_posts mp join public.posts p on p.id = mp.post_id where p.repost_of = $1", [orig])).toBe(0);
    const bot = await one<string>("select public.bot_id() as r");
    expect(await row(await rawPost(bot, "beep #anime"))).toBeUndefined();
  });

  it("tests a post on strangers only: never the author, their circle (both ways), blocks, or another fandom", async () => {
    const author = await member(["anime"]);
    const [follower, followed, reactedToAuthor, authorReacted, commenter, dmFriend, blocked, blocker, otherFandom, stranger, openToAll] = [
      await member(["anime"]), await member(["anime"]), await member(["anime"]), await member(["anime"]), await member(["anime"]),
      await member(["anime"]), await member(["anime"]), await member(["anime"]), await member(["cooking", "food"]), await member(["anime"]), await member([]),
    ];
    await as(follower, "follow_user", { p_user: author });
    await as(author, "follow_user", { p_user: followed });
    const old = await rawPost(author, "older post");
    await love(reactedToAuthor, old);
    await love(author, await rawPost(authorReacted, "theirs"));
    await as(commenter, "add_comment", { p_post_id: old, p_body: "nice" });
    const dm = await as<string>(author, "start_dm", { p_user_id: dmFriend });
    await as(dmFriend, "send_message", { p_channel_id: dm, p_body: "hey" });
    await as(author, "toggle_block", { p_user_id: blocked });
    await as(blocker, "toggle_block", { p_user_id: author });
    const post = await rawPost(author, "the test #anime");

    for (const v of [author, follower, followed, reactedToAuthor, authorReacted, commenter, dmFriend, blocked, blocker, otherFandom]) {
      expect(await moonPicks(v)).not.toContain(post);
    }
    expect(await moonPicks(stranger)).toContain(post);
    expect(await moonPicks(openToAll)).toContain(post); // no interests picked yet: open to everything
    // friends still see it, just not as part of the test
    const followerPage = await forYou(follower);
    expect(followerPage.find((p) => p.id === post)?.lane).toBe("circle");
  });

  it("never shows a post to the same person twice as part of a test", async () => {
    const author = await member(["manga"]);
    const post = await rawPost(author, "once #manga");
    const v = await member(["manga"]);
    expect(await moonPicks(v)).toContain(post);
    expect(await moonPicks(v)).not.toContain(post); // a new scroll: still not again
    expect(await one<number>("select count(*)::int as r from public.moon_shown where post_id = $1 and viewer_id = $2", [post, v])).toBe(1);
    expect((await row(post)).shown).toBe(1);
    // and nobody is in two phases of the same post (one row per person per post, whatever the phase)
    await db.query("update public.moon_posts set phase = 1, shown = 0 where post_id = $1", [post]);
    expect(await moonPicks(v)).not.toContain(post);
  });

  it("counts people, not clicks: 8 reactions from one person are 1; L and Not interested cancel", async () => {
    const author = await member(["cosplay"]);
    const post = await rawPost(author, "fit check #cosplay");
    const [fan, hater, meh, bored, quiet] = await crowd(5, ["cosplay"]);
    await show(post, [fan, hater, meh, bored, quiet]);
    for (const kind of ["heart", "skull", "fire", "clown", "cap", "crying", "salute", "w"]) await love(fan, post, kind);
    await love(hater, post, "l");
    await love(meh, post, "heart");
    await love(meh, post, "l"); // a positive and a negative: the negative wins
    await love(bored, post, "fire");
    await as(bored, "mark_not_interested", { p_post: post });
    await love(author, post, "heart"); // the author's own: nothing
    await as(author, "add_comment", { p_post_id: post, p_body: "bump" });
    const s = await status(author, post);
    expect(s).toMatchObject({ phase: 0, shown: 5, loved: 1 });
    expect(s.rate).toBeCloseTo(0.2);
    await expect(status(fan, post)).rejects.toThrow(/FORBIDDEN/); // only the author sees the numbers
  });

  it("counts comments, reposts, bookmarks, awards and poll votes as loving it", async () => {
    const author = await member(["film"]);
    const post = await as<string>(author, "create_post", { p_body: "best ending? #film", p_poll_options: ["this one", "that one"] });
    const people = await crowd(6, ["film"]);
    await show(post, people);
    const option = await one<string>("select id as r from public.poll_options where post_id = $1 order by position limit 1", [post]);
    await as(people[0], "add_comment", { p_post_id: post, p_body: "this" });
    await as(people[1], "toggle_repost", { p_post_id: post });
    await as(people[2], "toggle_bookmark", { p_post_id: post });
    await db.query("insert into public.awards (post_id, giver_id, kind) values ($1, $2, 'menace')", [post, people[3]]);
    await as(people[4], "vote_poll", { p_post_id: post, p_option_id: option });
    expect((await status(author, post)).loved).toBe(5); // the sixth did nothing
  });

  it("ranks by a small-sample-safe score: 2 of 2 never beats 30 of 100, and a rate beats a total", async () => {
    const lb = (k: number, total: number) => one<number>("select public.moon_score($1, $2) as r", [k, total]);
    expect(await lb(2, 2)).toBeLessThan(await lb(30, 100));
    for (let k = 1; k <= 4; k++) expect(await lb(k, k)).toBeLessThan(await lb(30, 100)); // up to 4 of 4
    expect(await lb(18, 100)).toBeGreaterThan(await lb(300, 10000)); // 18% of 100 beats 3% of 10,000
    expect(await lb(0, 0)).toBeCloseTo(0.1, 6); // no evidence: the 10% starting point
    for (const [k, t] of [[2, 2], [30, 100], [7, 20], [1, 10]]) expect(await lb(k, t)).toBeCloseTo(score(k, t), 6);
  });

  it("moves up the right posts against a known week of results (40% bar = 60th percentile)", async () => {
    // a week of 25 New Moon results with scores 0.01 .. 0.25
    const seeder = await member(["tech"]);
    for (let i = 1; i <= 25; i++) {
      const p = await rawPost(seeder, `seed ${i}`);
      await db.query("delete from public.moon_posts where post_id = $1", [p]);
      await db.query("insert into public.moon_results (post_id, phase, round, shown, shown_w, loved, loved_w, score, bar, result) values ($1, 0, 1, 20, 20, 1, 1, $2, 0.1, 'stay')", [p, i / 100]);
    }
    const bar = await one<number>("select public.moon_bar(0) as r");
    expect(bar).toBeCloseTo(0.154, 5); // so exactly 10 of the 25 (40%) cleared it
    const tests: ({ loved: number } & Awaited<ReturnType<typeof scenario>>)[] = [];
    for (const loved of [0, 2, 4, 6, 8, 10, 12]) tests.push({ loved, ...(await scenario(20, loved, "tech")) });
    await tick();
    for (const t of tests) {
      const r = await row(t.post);
      const up = score(t.loved, 20) >= bar;
      expect([t.loved, r.phase]).toEqual([t.loved, up ? 1 : 0]);
      if (up) expect(r).toMatchObject({ round: 1, state: "testing", target: 100, shown: 0 });
    }
    expect(tests.filter((t) => score(t.loved, 20) >= bar).length).toBe(4); // 6, 8, 10 and 12 of 20
    await db.query("delete from public.moon_results where post_id in (select id from public.posts where author_id = $1)", [seeder]);
  });

  it("uses the starter bar until a phase has 20 results this week", async () => {
    const { author, post } = await scenario(12, 3, "jpop");
    expect((await status(author, post)).bar).toBeCloseTo(0.1, 5);
    await tick();
    expect((await row(post)).phase).toBe(score(3, 12) >= 0.1 ? 1 : 0);
  });

  it("swapping Pro, role, badges, level or account age changes no decision (and decisions repeat exactly)", async () => {
    const posts: Awaited<ReturnType<typeof scenario>>[] = [];
    for (const loved of [1, 3, 5, 9]) posts.push(await scenario(15, loved, "vtubers"));
    const decide = async () => {
      await db.exec("begin");
      try {
        await tick();
        return (await db.query("select post_id, phase, round, state, target, shown from public.moon_posts where post_id = any ($1::uuid[]) order by post_id", [`{${posts.map((p) => p.post).join(",")}}`])).rows;
      } finally {
        await db.exec("rollback");
      }
    };
    const before = await decide();
    expect(await decide()).toEqual(before); // same inputs, same decisions
    for (const p of posts) {
      await db.query("update public.profiles set role = 'admin', verified = true, badge = 'staff', xp = 999999, created_at = now() - interval '5 years' where id = $1", [p.author]);
      await db.query("insert into public.entitlements (user_id, source, status) values ($1, 'comp', 'active')", [p.author]);
    }
    expect(await decide()).toEqual(before);
  });

  it("counts brand-new accounts half", async () => {
    const author = await member(["figures"]);
    const post = await rawPost(author, "new figure #figures");
    const newbie = await member(["figures"], 0);
    const regular = await member(["figures"], 3);
    expect(await moonPicks(newbie)).toContain(post);
    expect(await moonPicks(regular)).toContain(post);
    const w = (await db.query<{ viewer_id: string; weight: number }>("select viewer_id, weight from public.moon_shown where post_id = $1", [post])).rows;
    expect(Object.fromEntries(w.map((x) => [x.viewer_id, x.weight]))).toEqual({ [newbie]: 0.5, [regular]: 1 });
  });

  it("gets every eligible post its New Moon audience, then decides on whoever saw it", async () => {
    const author = await member(["travel"]);
    const post = await rawPost(author, "night train #travel");
    const people = await crowd(12, ["travel"]);
    let shown = 0;
    for (const v of people) if ((await moonPicks(v)).includes(post)) shown++;
    expect(shown).toBe(12); // fewer eligible people than the 20 it asks for: all of them
    await love(people[0], post);
    await love(people[1], post);
    await love(people[2], post);
    await age(post);
    await tick(); // 12 hours on, decided on the 12 who saw it
    const r = await row(post);
    expect(r.phase === 1 || r.round === 2).toBe(true);
  });

  it("Second Night: a post that misses gets one more New Moon, at night, with fresh people, and the better result counts", async () => {
    const { author, post, people } = await scenario(10, 0, "memes");
    await tick();
    expect(await row(post)).toMatchObject({ phase: 0, round: 2, state: "testing", shown: 0 });
    expect((await status(author, post)).history).toEqual([expect.objectContaining({ phase: 0, round: 1, result: "retry" })]);
    const fresh = await member(["memes"]);
    expect(await moonPicks(fresh)).not.toContain(post); // it rests first
    await age(post);
    expect(await moonPicks(fresh, [], 14)).not.toContain(post); // the afternoon: not yet
    expect(await moonPicks(fresh, [], 23)).toContain(post); // the night: yes
    expect(await moonPicks(people[0], [], 23)).not.toContain(post); // never the first night's people
    await love(fresh, post);
    const second = await crowd(9, ["memes"]);
    await show(post, second);
    for (const v of second.slice(0, 4)) await love(v, post);
    await tick();
    expect((await row(post)).phase).toBe(score(5, 10) >= 0.1 ? 1 : 0);
  });

  it("a post that misses its second night is done", async () => {
    const { post } = await scenario(10, 0, "fashion");
    await tick();
    await age(post);
    await show(post, await crowd(10, ["fashion"]));
    await tick();
    expect(await row(post)).toMatchObject({ phase: 0, round: 2, state: "done" });
  });

  it("a test with nobody left to ask ends without counting against the post", async () => {
    const author = await member(["vocaloid"]);
    const post = await rawPost(author, "new cover #vocaloid");
    // everyone who could be asked already knows the author
    const everyone = (await db.query<{ id: string }>("select id from public.profiles where id <> $1 and not is_bot", [author])).rows.map((r) => r.id);
    await db.query("insert into public.follows (follower_id, followee_id) select x, $1 from unnest($2::uuid[]) x on conflict do nothing", [author, `{${everyone.join(",")}}`]);
    await tick();
    expect(await row(post)).toMatchObject({ phase: 0, state: "done" });
    expect(await one<string>("select ended as r from public.moon_posts where post_id = $1", [post])).toBe("exhausted");
    expect(await one<number>("select count(*)::int as r from public.moon_results where post_id = $1", [post])).toBe(0);
    await db.query("delete from public.follows where followee_id = $1", [author]);
    // and a stranger's For You ranks it like any post, not like a failed test
    const failed = await scenario(10, 0, "vocaloid");
    await db.query("update public.moon_posts set state = 'done', ended = 'failed' where post_id = $1", [failed.post]);
    const v = await member(["vocaloid"]);
    const page = await forYou(v);
    const pos = (id: string) => page.findIndex((p) => p.id === id);
    expect(pos(post)).toBeGreaterThanOrEqual(0);
    if (pos(failed.post) >= 0) expect(pos(post)).toBeLessThan(pos(failed.post));
  });

  it("waits for at least 10 people after the 12-hour window", async () => {
    const author = await member(["writing"]);
    const post = await rawPost(author, "chapter one #writing");
    const people = await crowd(25, ["writing"]); // plenty of eligible people, but only 6 opened the app
    await show(post, people.slice(0, 6));
    await age(post);
    await tick();
    expect(await row(post)).toMatchObject({ phase: 0, round: 1, state: "waiting" });
    expect(await moonPicks(people[10])).toContain(post); // still being shown
    await show(post, people.slice(11, 15));
    await tick();
    expect((await row(post)).round === 2 || (await row(post)).phase === 1).toBe(true);
  });

  it("Night Watch wins: a held post stops; a removed post's Moonrise is erased", async () => {
    const held = await scenario(10, 9, "art");
    await db.query("update public.posts set mod_state = 'held' where id = $1", [held.post]);
    expect(await moonPicks(await member(["art"]))).not.toContain(held.post);
    await tick();
    expect(await row(held.post)).toMatchObject({ phase: 0, round: 1 });
    const removed = await scenario(10, 9, "art");
    await tick();
    expect((await row(removed.post)).phase).toBe(1);
    await db.query("update public.posts set deleted_at = now() where id = $1", [removed.post]);
    expect((await tick()).erased).toBeGreaterThanOrEqual(1);
    expect(await row(removed.post)).toBeUndefined();
    for (const t of ["moon_results", "moon_shown"]) expect(await one<number>(`select count(*)::int as r from public.${t} where post_id = $1`, [removed.post])).toBe(0);
  });

  it("forgets who saw what after 7 days", async () => {
    const { post, people } = await scenario(3, 0, "food");
    await db.query("update public.moon_shown set shown_at = now() - interval '8 days' where post_id = $1 and viewer_id = $2", [post, people[0]]);
    await tick();
    expect(await one<number>("select count(*)::int as r from public.moon_shown where shown_at < now() - interval '7 days'")).toBe(0);
    expect(await one<number>("select count(*)::int as r from public.moon_shown where post_id = $1", [post])).toBe(2);
  });

  it("Not interested hides the post for you, and can be undone; not on your own posts", async () => {
    const author = await member(["jrock"]);
    const post = await rawPost(author, "new single #jrock");
    const v = await member(["jrock"]);
    await as(v, "mark_not_interested", { p_post: post });
    expect((await forYou(v)).map((p) => p.id)).not.toContain(post);
    await as(v, "undo_not_interested", { p_post: post });
    expect((await forYou(v)).map((p) => p.id)).toContain(post);
    await expect(as(author, "mark_not_interested", { p_post: post })).rejects.toThrow(/INVALID/);
  });

  it("reaching Full Moon tells the author, badges the post, and tells the fandom (at most once a day each)", async () => {
    const author = await member(["gaming", "anime"]);
    const post = await rawPost(author, "speedrun #gaming");
    const fandom = await crowd(4, ["gaming"]);
    const outsider = await member(["food"]);
    await db.query("update public.moon_posts set phase = 2, target = 10 where post_id = $1", [post]);
    const testers = await crowd(10, ["gaming"]);
    await show(post, testers);
    for (const v of testers.slice(0, 8)) await love(v, post);
    await tick();
    expect((await row(post)).phase).toBe(3);
    expect(await one<string>("select body as r from public.notifications where user_id = $1 and kind = 'moon' and post_id = $2", [author, post])).toBe("Full Moon");
    const told = (await db.query<{ user_id: string }>("select user_id from public.notifications where post_id = $1 and kind = 'top_post'", [post])).rows.map((r) => r.user_id);
    for (const f of fandom) expect(told).toContain(f);
    expect(told).not.toContain(outsider);
    for (const t of testers) expect(told).not.toContain(t); // they've already seen it
    expect((await forYou(fandom[0])).find((p) => p.id === post)?.moon).toBe(3);
    // a second Full Moon the same day doesn't notify them again
    const other = await rawPost(await member(["gaming"]), "another #gaming");
    await db.query("update public.moon_posts set phase = 2, target = 10 where post_id = $1", [other]);
    const more = await crowd(10, ["gaming"]);
    await show(other, more);
    for (const v of more) await love(v, other);
    await tick();
    expect((await row(other)).phase).toBe(3);
    expect(await one<number>("select count(*)::int as r from public.notifications where post_id = $1 and kind = 'top_post' and user_id = $2", [other, fandom[0]])).toBe(0);
  });

  it("puts the Moonrise picks in the 3rd and 8th places, with a reason, and never two from one author in a row", async () => {
    const v = await member(["anime"]);
    const page = await forYou(v);
    const lanes = page.map((p) => p.lane);
    expect(page.length).toBeGreaterThan(8);
    expect(lanes[2]).toBe("moonrise");
    expect(lanes[7]).toBe("moonrise");
    expect(page[2].why).toMatch(/^🌑 New Moon: /);
    for (let i = 1; i < page.length; i++) expect(page[i].author.id === page[i - 1].author.id && i !== 0).toBe(false);
    const ids = page.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const next = await forYou(v, ids);
    expect(next.some((p) => ids.includes(p.id))).toBe(false); // the next page is all new
  });

  it("only members can read For You or a post's climb; nobody can read who saw what", async () => {
    await expect(as(null, "get_for_you", { p_seen: "{}", p_limit: 15, p_hour: 22 })).rejects.toThrow(/permission denied/);
    const a = await member();
    for (const t of ["moon_shown", "moon_posts", "moon_results", "not_interested"]) {
      await expect(db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: a, role: "authenticated" })]);
        await tx.exec("set local role authenticated");
        return tx.query(`select * from public.${t}`);
      })).rejects.toThrow(/permission denied/);
    }
    await expect(as(a, "moon_tick", { p_limit: 1 })).rejects.toThrow(/permission denied/);
  });

  it("builds a page quickly with 10,000 posts", async () => {
    const authors = await crowd(200, ["anime", "gaming"]);
    await db.query(
      `insert into public.posts (author_id, body, created_at)
       select ($1::uuid[])[1 + (g % 200)], 'bulk post ' || g || ' #anime', now() - make_interval(mins => g)
       from generate_series(1, 10000) g`,
      [`{${authors.join(",")}}`],
    );
    await db.query(
      `insert into public.reactions (post_id, user_id, kind)
       select p.id, ($1::uuid[])[1 + (abs(hashtext(p.id::text)) % 200)], 'heart' from public.posts p where p.body like 'bulk post %' and random() < 0.3
       on conflict do nothing`,
      [`{${authors.join(",")}}`],
    );
    await db.exec("analyze"); // what autovacuum does on a real server after a bulk load
    const v = await member(["anime"]);
    await forYou(v); // warm
    const t0 = performance.now();
    const page = await forYou(v);
    const ms = performance.now() - t0;
    console.log(`For You with 10,000 posts: ${ms.toFixed(0)} ms (embedded test database)`);
    expect(page.length).toBe(15);
    // The embedded database is Postgres compiled to WebAssembly, several times
    // slower than a real server; on a local Postgres 16 the same page takes
    // 67-116 ms (docs/MOONRISE.md). This guards against the slow paths coming back.
    expect(ms).toBeLessThan(800);
    const t1 = performance.now();
    await db.query("select public.moon_tick(500)");
    const tickMs = performance.now() - t1;
    console.log(`Deciding 500 open tests: ${tickMs.toFixed(0)} ms (embedded test database)`);
    expect(tickMs).toBeLessThan(20_000);
  }, 120_000);
});
