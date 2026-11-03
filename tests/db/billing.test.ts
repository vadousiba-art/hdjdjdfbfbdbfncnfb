import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { applyMigrations } from "@/lib/database/migrations";

// PayPal subscriptions (migration 0015): only the server can write them, Pro
// follows the subscription's state, and a subscription belongs to one member.

let db: PGlite;
const root = path.resolve(__dirname, "../..");
const u: Record<string, string> = {};
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

type Out = { known: boolean; pro: boolean; until: string | null };
async function sync(args: Record<string, unknown>, role: "service_role" | "authenticated" = "service_role") {
  const keys = Object.keys(args);
  const sql = `select public.billing_paypal_sync(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
  return db.transaction(async (tx) => {
    if (role === "authenticated") {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: u.ari, role: "authenticated" })]);
    }
    await tx.exec(`set local role ${role}`);
    return (await tx.query<{ r: Out }>(sql, Object.values(args))).rows[0].r;
  });
}
const isPro = async (id: string) => (await db.query<{ r: boolean }>("select public.is_pro($1) as r", [id])).rows[0].r;
async function signup(name: string) {
  const r = await db.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [
    `${name}@billing.test`,
    JSON.stringify({ username: name, display_name: name }),
  ]);
  return r.rows[0].id;
}

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await applyMigrations(db, { root });
  u.ari = await signup("bill_ari");
  u.zed = await signup("bill_zed");
});

describe("PayPal billing", () => {
  it("members can't call it", async () => {
    await expect(sync({ p_user: u.ari, p_subscription: "I-AAAAAAAA01", p_active: true, p_ends_at: day(30) }, "authenticated")).rejects.toThrow(
      /permission denied/,
    );
    expect(await isPro(u.ari)).toBe(false);
  });

  it("an active subscription gives Pro, and renewals only move the end date forward", async () => {
    const out = await sync({ p_user: u.ari, p_subscription: "I-AAAAAAAA01", p_active: true, p_ends_at: day(30) });
    expect(out.pro).toBe(true);
    expect(await isPro(u.ari)).toBe(true);
    await sync({ p_user: u.ari, p_subscription: "I-AAAAAAAA01", p_active: true, p_ends_at: day(10) });
    const e = await db.query<{ n: number; ends: string; source: string }>(
      "select count(*)::int as n, max(ends_at)::text as ends, max(source) as source from public.entitlements where external_id = 'I-AAAAAAAA01'",
    );
    expect(e.rows[0].n).toBe(1);
    expect(e.rows[0].source).toBe("paypal");
    expect(new Date(e.rows[0].ends).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
  });

  it("a subscription stays with the member who made it", async () => {
    await expect(sync({ p_user: u.zed, p_subscription: "I-AAAAAAAA01", p_active: true, p_ends_at: day(30) })).rejects.toThrow(/FORBIDDEN/);
    expect(await isPro(u.zed)).toBe(false);
  });

  it("cancelling keeps Pro to the end of the paid period; ending it stops Pro now", async () => {
    await sync({ p_user: u.ari, p_subscription: "I-AAAAAAAA01", p_active: false, p_ends_at: null });
    expect(await isPro(u.ari)).toBe(true);
    await sync({ p_user: u.ari, p_subscription: "I-AAAAAAAA01", p_active: false, p_ends_at: new Date().toISOString() });
    expect(await isPro(u.ari)).toBe(false);
    // PayPal can re-activate a suspended subscription
    await sync({ p_user: u.ari, p_subscription: "I-AAAAAAAA01", p_active: true, p_ends_at: day(30) });
    expect(await isPro(u.ari)).toBe(true);
  });

  it("records each webhook event once", async () => {
    const ev = {
      p_user: u.zed,
      p_subscription: "I-ZZZZZZZZ02",
      p_active: true,
      p_ends_at: day(30),
      p_event_id: "WH-1",
      p_event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
      p_payload: { status: "ACTIVE" },
    };
    await sync(ev);
    await sync(ev);
    const r = await db.query<{ n: number; done: boolean }>(
      "select count(*)::int as n, bool_and(processed_at is not null) as done from public.payment_events where provider = 'paypal' and event_id = 'WH-1'",
    );
    expect(r.rows[0]).toEqual({ n: 1, done: true });
    expect(await isPro(u.zed)).toBe(true);
  });

  it("ignores events for subscriptions it never saw, and rejects bad input", async () => {
    const out = await sync({ p_user: null, p_subscription: "I-UNKNOWN0003", p_active: false, p_ends_at: null });
    expect(out.known).toBe(false);
    await expect(sync({ p_user: u.ari, p_subscription: "not-an-id", p_active: true, p_ends_at: day(30) })).rejects.toThrow(/INVALID/);
    await expect(sync({ p_user: u.ari, p_subscription: "I-BBBBBBBB04", p_active: true, p_ends_at: day(-1) })).rejects.toThrow(/INVALID/);
  });
});
