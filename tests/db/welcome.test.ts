import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { applyMigrations } from "@/lib/database/migrations";

// Welcome film preference (migration 0008).

let db: PGlite;
const root = path.resolve(__dirname, "../..");

async function as<T = unknown>(uid: string | null, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const keys = Object.keys(args);
  const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
  return db.transaction(async (tx) => {
    if (uid) {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
      await tx.exec("set local role authenticated");
    } else {
      await tx.exec("set local role anon");
    }
    return (await tx.query<{ r: T }>(sql, keys.map((k) => args[k]))).rows[0]?.r as T;
  });
}
async function signup(name: string) {
  const r = await db.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [
    `${name}@welcome.test`,
    JSON.stringify({ username: name, display_name: name }),
  ]);
  return r.rows[0].id;
}

let owner: string, fresh: string, old: string;
beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await applyMigrations(db, { root });
  owner = await signup("wel_owner");
  fresh = await signup("wel_fresh");
  old = await signup("wel_old");
  await db.query("update public.profiles set created_at = now() - interval '30 days' where id = $1", [old]);
});

describe("welcome preference", () => {
  it("starts unseen and reports the account's age", async () => {
    const a = await as<{ seen: string | null; account_age_hours: number }>(fresh, "get_welcome_state");
    expect(a.seen).toBeNull();
    expect(a.account_age_hours).toBeLessThan(1);
    const b = await as<{ account_age_hours: number }>(old, "get_welcome_state");
    expect(b.account_age_hours).toBeGreaterThanOrEqual(720);
  });

  it("remembers the version per member", async () => {
    await as(fresh, "mark_welcome_seen", { p_version: "1" });
    expect((await as<{ seen: string }>(fresh, "get_welcome_state")).seen).toBe("1");
    expect((await as<{ seen: string | null }>(old, "get_welcome_state")).seen).toBeNull();
  });

  it("rejects malformed versions and signed-out callers", async () => {
    await expect(as(fresh, "mark_welcome_seen", { p_version: "1; drop table x" })).rejects.toThrow();
    await expect(as(null, "get_welcome_state")).rejects.toThrow(/permission denied/);
    await expect(db.query("update public.profiles set welcome_seen = 'nope' where id = $1", [owner])).rejects.toThrow(/welcome_seen_check/);
  });
});
