import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { applyMigrations } from "@/lib/database/migrations";

// Push notifications (migration 0014): devices are private, follow the
// signed-in member, and only members with a device queue pushes, which mirror
// notifications (so notification settings and blocks apply).

let db: PGlite;
const root = path.resolve(__dirname, "../..");
const u: Record<string, string> = {};
const key = (n: number) => `B${String(n).padStart(3, "0")}${"x".repeat(83)}`;
const sub = (n: number) => ({ p_endpoint: `https://push.example/${n}`, p_p256dh: key(n), p_auth: "authsecret-1234", p_device: `Chrome ${n}` });

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
async function signup(name: string) {
  const r = await db.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [
    `${name}@push.test`,
    JSON.stringify({ username: name, display_name: name }),
  ]);
  return r.rows[0].id;
}
// pushes wait 30 seconds (migration 0017); `claim` is the server's drain once they're due
const due = () => db.query("update public.push_outbox set due_at = now() - interval '1 second'");
const claimNow = async () => (await db.query<{ r: { kind: string }[] }>("select public.push_claim(100) as r")).rows[0].r;
const claim = async () => (await due(), (await db.query<{ r: { kind: string; actor: { name: string } | null; unread: number; devices: { endpoint: string }[] }[] }>("select public.push_claim(100) as r")).rows[0].r);
const queued = async () => (await db.query<{ n: number }>("select count(*)::int as n from public.push_outbox")).rows[0].n;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await applyMigrations(db, { root });
  u.ari = await signup("push_ari");
  u.zed = await signup("push_zed");
  u.mo = await signup("push_mo");
  u.post = await as<string>(u.ari, "create_post", { p_body: "night walk" });
});

describe("push notifications", () => {
  it("queues nothing for members without a device", async () => {
    await as(u.zed, "toggle_reaction", { p_post_id: u.post, p_kind: "heart" });
    expect(await queued()).toBe(0);
  });

  it("stores a device privately and queues the next notification for it", async () => {
    expect(await as(u.ari, "push_subscribe", sub(1))).toEqual({ devices: 1 });
    const seen = await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: u.zed, role: "authenticated" })]);
      await tx.exec("set local role authenticated");
      return (await tx.query<{ n: number }>("select count(*)::int as n from public.push_subscriptions")).rows[0].n;
    });
    expect(seen).toBe(0); // Zed can't see Ari's devices
    await as(u.zed, "add_comment", { p_post_id: u.post, p_body: "nice" });
    expect(await queued()).toBe(1);
    const items = await claim();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "comment", actor: { name: "push_zed" } });
    expect(items[0].devices.map((d) => d.endpoint)).toEqual(["https://push.example/1"]);
    expect(await queued()).toBe(0); // claimed means sent once
  });

  it("waits 30 seconds, and never pushes what was read in the app meanwhile", async () => {
    await as(u.zed, "add_comment", { p_post_id: u.post, p_body: "too soon" });
    expect(await queued()).toBe(1);
    expect(await claimNow()).toEqual([]); // not due yet: nothing sent, still queued
    expect(await queued()).toBe(1);
    const wait = (await db.query<{ s: number }>("select public.push_next_due() as s")).rows[0].s;
    expect(wait).toBeGreaterThan(25);
    expect(wait).toBeLessThanOrEqual(30);
    await db.query("update public.notifications set read_at = now() where user_id = $1 and read_at is null", [u.ari]);
    expect(await claim()).toEqual([]); // due, but already read: dropped, not sent
    expect(await queued()).toBe(0);
    expect((await db.query<{ s: number | null }>("select public.push_next_due() as s")).rows[0].s).toBeNull();
  });

  it("follows notification settings and blocks (they decide what's pushed)", async () => {
    await as(u.ari, "update_my_profile", { p: JSON.stringify({ notification_prefs: { comments: false } }) });
    await as(u.zed, "add_comment", { p_post_id: u.post, p_body: "again" });
    expect(await queued()).toBe(0);
    await as(u.ari, "update_my_profile", { p: JSON.stringify({ notification_prefs: { comments: true } }) });
    await db.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [u.ari, u.mo]);
    await as(u.mo, "add_comment", { p_post_id: u.post, p_body: "from mo" }).catch(() => null);
    expect(await queued()).toBe(0);
  });

  it("moves a device to whoever signs in on it, and turning off removes it", async () => {
    await as(u.zed, "push_subscribe", sub(1));
    expect((await db.query("select user_id from public.push_subscriptions where endpoint = 'https://push.example/1'")).rows[0]).toEqual({ user_id: u.zed });
    expect(await as(u.zed, "push_unsubscribe", { p_endpoint: "https://push.example/1" })).toEqual({ devices: 0 });
  });

  it("keeps at most 10 devices per member and drops dead ones", async () => {
    for (let i = 10; i < 22; i++) await as(u.ari, "push_subscribe", sub(i));
    expect((await db.query<{ n: number }>("select count(*)::int as n from public.push_subscriptions where user_id = $1", [u.ari])).rows[0].n).toBe(10);
    await db.query("select public.push_report($1, $2, $3)", [["https://push.example/21"], ["https://push.example/20"], ["https://push.example/19"]]);
    const rows = (await db.query<{ endpoint: string; failures: number; last_ok: string | null }>("select endpoint, failures, last_ok from public.push_subscriptions where user_id = $1", [u.ari])).rows;
    expect(rows.find((r) => r.endpoint.endsWith("/20"))).toBeUndefined(); // gone
    expect(rows.find((r) => r.endpoint.endsWith("/19"))?.failures).toBe(1);
    expect(rows.find((r) => r.endpoint.endsWith("/21"))?.last_ok).not.toBeNull();
    for (let i = 0; i < 4; i++) await db.query("select public.push_report('{}', '{}', $1)", [["https://push.example/19"]]);
    expect(rows.length - 1).toBe((await db.query<{ n: number }>("select count(*)::int as n from public.push_subscriptions where user_id = $1", [u.ari])).rows[0].n);
  });

  it("only the server can claim pushes; visitors can't subscribe; bad addresses are refused", async () => {
    await expect(as(u.ari, "push_claim", { p_limit: 10 })).rejects.toThrow(/permission denied/);
    await expect(as(null, "push_subscribe", sub(99))).rejects.toThrow(/permission denied/);
    await expect(as(u.ari, "push_subscribe", { ...sub(98), p_endpoint: "http://insecure.example/x" })).rejects.toThrow(/INVALID/);
  });

  it("registers the Android app's Firebase token (no keys) and hands it out with its kind", async () => {
    const token = `fcm-token_${"a1:".repeat(50)}`;
    expect(await as(u.mo, "push_subscribe", { p_endpoint: token, p_p256dh: null, p_auth: null, p_device: "YORU app on Android", p_kind: "fcm" })).toEqual({ devices: 1 });
    const post = await as<string>(u.mo, "create_post", { p_body: "moonrise" });
    await as(u.zed, "add_comment", { p_post_id: post, p_body: "wow" });
    const items = await claim();
    expect(items).toHaveLength(1);
    expect(items[0].devices).toEqual([{ kind: "fcm", endpoint: token, p256dh: null, auth: null }]);
    await expect(as(u.mo, "push_subscribe", { p_endpoint: "not a token", p_p256dh: null, p_auth: null, p_device: "", p_kind: "fcm" })).rejects.toThrow(/INVALID/);
    await expect(as(u.mo, "push_subscribe", { p_endpoint: "https://push.example/nokeys", p_p256dh: null, p_auth: null })).rejects.toThrow();
    await expect(as(u.mo, "push_subscribe", { ...sub(97), p_kind: "carrier-pigeon" })).rejects.toThrow(/INVALID/);
  });
});
