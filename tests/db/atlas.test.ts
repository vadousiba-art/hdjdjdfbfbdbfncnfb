import { beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { applyMigrations } from "@/lib/database/migrations";

// Atlas's storage (migration 0013): each member's conversation and settings,
// private to them, capped, clearable.

let db: PGlite;
const root = path.resolve(__dirname, "../..");
const u: Record<string, string> = {};

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
async function sqlAs(uid: string, sql: string) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid, role: "authenticated" })]);
    await tx.exec("set local role authenticated");
    return (await tx.query<Record<string, unknown>>(sql)).rows;
  });
}
async function signup(name: string) {
  const r = await db.query<{ id: string }>("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [
    `${name}@atlas.test`,
    JSON.stringify({ username: name, display_name: name }),
  ]);
  return r.rows[0].id;
}
type Atlas = { model: string; speak: boolean; history: { role: string; content: string; model: string | null; attachments: string[] }[] };

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm } });
  await applyMigrations(db, { root });
  u.ann = await signup("atlas_ann");
  u.ben = await signup("atlas_ben");
});

describe("Atlas storage", () => {
  it("starts empty with Gemini and voice off", async () => {
    expect(await as<Atlas>(u.ann, "get_atlas")).toEqual({ model: "gemini", speak: false, history: [] });
  });

  it("saves exchanges in order, with the model and what was attached (never the files)", async () => {
    await as(u.ann, "atlas_save_exchange", { p_user_text: "what's this?", p_ai_text: "A cat.", p_model: "gemini-3.6-flash", p_attachments: ["image", "nonsense"] });
    const h = (await as<Atlas>(u.ann, "get_atlas")).history;
    expect(h.map((m) => [m.role, m.content])).toEqual([["user", "what's this?"], ["assistant", "A cat."]]);
    expect(h[0].attachments).toEqual(["image"]);
    expect(h[1].model).toBe("gemini-3.6-flash");
  });

  it("keeps only the latest 200 messages", async () => {
    for (let i = 0; i < 105; i++) await as(u.ben, "atlas_save_exchange", { p_user_text: `q${i}`, p_ai_text: `a${i}`, p_model: "m" });
    const n = (await db.query<{ n: number }>("select count(*)::int as n from public.atlas_messages where user_id = $1", [u.ben])).rows[0].n;
    expect(n).toBe(200);
    const h = (await as<Atlas>(u.ben, "get_atlas", { p_limit: 200 })).history;
    expect(h[0].content).toBe("q5");
    expect(h[h.length - 1].content).toBe("a104");
  });

  it("is private: members only ever see their own conversation", async () => {
    expect((await sqlAs(u.ann, "select count(*)::int as n from public.atlas_messages"))[0].n).toBe(2);
    await expect(sqlAs(u.ann, `insert into public.atlas_messages (user_id, role, content) values ('${u.ben}', 'user', 'x')`)).rejects.toThrow(/permission denied/);
    await expect(sqlAs(u.ann, "delete from public.atlas_messages")).rejects.toThrow(/permission denied/);
    await expect(as(null, "get_atlas")).rejects.toThrow(/permission denied/);
  });

  it("saves the chosen model and voice setting, and rejects odd model names", async () => {
    expect(await as(u.ann, "atlas_set_prefs", { p_model: "acme/vision-2:free" })).toEqual({ model: "acme/vision-2:free", speak: false });
    expect(await as(u.ann, "atlas_set_prefs", { p_speak: true })).toEqual({ model: "acme/vision-2:free", speak: true });
    await expect(as(u.ann, "atlas_set_prefs", { p_model: "x'; drop table" })).rejects.toThrow(/INVALID/);
    expect((await as<Atlas>(u.ben, "get_atlas")).model).toBe("gemini");
  });

  it("clears only your own conversation", async () => {
    await as(u.ann, "atlas_clear");
    expect((await as<Atlas>(u.ann, "get_atlas")).history).toEqual([]);
    expect((await as<Atlas>(u.ben, "get_atlas", { p_limit: 1 })).history).toHaveLength(1);
  });

  it("shares only the member's own basics with Atlas", async () => {
    const c = await as<Record<string, unknown>>(u.ann, "get_atlas_context");
    expect(Object.keys(c).sort()).toEqual(["bio", "display_name", "role", "status", "username"]);
    expect(c.username).toBe("atlas_ann");
  });
});
