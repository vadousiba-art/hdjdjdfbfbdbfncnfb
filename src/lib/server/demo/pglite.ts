import "server-only";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { demoDataDir } from "@/lib/config";
import { applyMigrations } from "@/lib/database/migrations";
import { fromNotify, routeChanges, type RoutingLookup } from "../realtime/routing";
import { publish } from "../realtime/publish";
import { seedDemo } from "./seed";

// Demo mode runs the real Supabase migrations inside an embedded Postgres
// (PGlite), persisted to .data/pglite. One instance per server process.

const g = globalThis as unknown as { __yoruDemoDb?: Promise<PGlite> };

async function open(): Promise<PGlite> {
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), demoDataDir(), "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const db = await PGlite.create({ dataDir: dir, extensions: { pg_trgm } });
  await applyMigrations(db);

  // Realtime for the SSE stream: emit_change() pg_notify -> route -> live bus.
  const lookup: RoutingLookup = {
    channels: async (ids) =>
      (await db.query<{ id: string; kind: string; is_private: boolean }>(
        "select id::text, kind, is_private from public.channels where id = any($1::uuid[])",
        [ids],
      )).rows,
    members: async (ids) =>
      (await db.query<{ channel_id: string; user_id: string }>(
        "select channel_id::text, user_id::text from public.channel_members where channel_id = any($1::uuid[])",
        [ids],
      )).rows,
    messageChannels: async (ids) =>
      (await db.query<{ id: string; channel_id: string }>(
        "select id::text, channel_id::text from public.messages where id = any($1::uuid[])",
        [ids],
      )).rows,
  };
  await db.listen("itn_changes", (payload) => {
    let change;
    try {
      change = fromNotify(JSON.parse(payload));
    } catch {
      return; /* oversized payloads are truncated; ignore */
    }
    routeChanges([change], false, lookup)
      .then(publish)
      .catch(() => {});
  });

  // Demo mode has no pg_cron, so this process runs once a minute what pg_cron
  // runs on Supabase: the Post Planner's due drafts and Moonrise's decisions.
  const tick = async () => {
    await db.query("select public.pro_publish_due(50, 'demo')").catch(() => {});
    await db.query("select public.moon_tick(500)").catch(() => {});
    await db.query("select public.crew_tick(0.35)").catch(() => {});
  };
  void tick();
  setInterval(tick, 60_000).unref?.();

  const humans = await db.query<{ n: number }>("select count(*)::int as n from public.profiles where not is_bot");
  if (humans.rows[0].n === 0) {
    await seedDemo(db);
  }
  return db;
}

export function demoDb(): Promise<PGlite> {
  if (!g.__yoruDemoDb) {
    g.__yoruDemoDb = open();
    g.__yoruDemoDb.catch((err) => {
      console.error("[itn] demo database failed to open", err);
      g.__yoruDemoDb = undefined;
    });
  }
  return g.__yoruDemoDb;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;

function toParam(v: unknown) {
  if (v === undefined) return null;
  if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
    return JSON.stringify(v);
  }
  return v;
}

// Call a public.* function. `uid` null = superuser (service role equivalent).
export async function demoRpc<T>(uid: string | null, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!IDENT.test(fn)) throw new Error("bad function name");
  const keys = Object.keys(args).filter((k) => args[k] !== undefined);
  for (const k of keys) if (!IDENT.test(k)) throw new Error("bad argument name");
  const sql = `select public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
  const params = keys.map((k) => toParam(args[k]));
  const db = await demoDb();
  return db.transaction(async (tx) => {
    if (uid) {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: uid, role: "authenticated" }),
      ]);
      await tx.exec("set local role authenticated");
    }
    const res = await tx.query<{ r: T }>(sql, params);
    return res.rows[0]?.r as T;
  });
}
