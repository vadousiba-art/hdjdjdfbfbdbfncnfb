import "server-only";
import { cookies } from "next/headers";
import { appMode, configProblems, dataBackend } from "@/lib/config";
import { AppError, toAppError } from "./errors";
import { supabaseAdmin, supabaseForRequest } from "./supabase";
import { demoDb, demoRpc } from "./demo/pglite";
import { pgQuery, pgRpc } from "./postgres";
import { ensureDemoSeeded } from "./demo/seed";
import { READ_RPCS, type RpcName } from "./rpc-registry";
import { scheduleDrain } from "./realtime/outbox";
import { mayNotify, schedulePush } from "./push";

// Server-side functions that write (and so may produce live events).
const SERVICE_WRITES = /^(bot_|nw_|delete_account$|submit_support$|pro_publish_due$)/;

export const DEMO_COOKIE = "itn_demo_uid";

// One interface over every backend. Every call runs a Postgres function from
// supabase/migrations: through PostgREST on Supabase, through a pooled
// connection on Neon, or inside the embedded PGlite database in demo mode.
// RLS and the function's own checks apply in all three.
export interface Db {
  userId: string;
  rpc<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T>;
}

export function requireConfigured() {
  if (appMode() === "unconfigured") {
    throw new AppError("NOT_CONFIGURED", "This server has no database configured. See the setup page.", 503);
  }
  const problems = configProblems();
  if (problems.length) throw new AppError("NOT_CONFIGURED", `Server configuration incomplete: ${problems[0]}`, 503);
}

// Fixed, parameterized SQL with server privileges, for the plain-Postgres
// backends only (demo login, identity mirror, realtime routing). Supabase is
// reached through RPCs and the admin API instead.
export async function serviceQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
  requireConfigured();
  const backend = dataBackend();
  try {
    await ensureDemoSeeded();
    if (backend === "pglite") return await (await demoDb()).query<T>(sql, params);
    if (backend === "postgres") return await pgQuery<T>(sql, params);
  } catch (err) {
    throw toAppError(err);
  }
  throw new AppError("INTERNAL", "Direct queries are not available with the Supabase backend.", 500);
}

async function currentDemoUser(): Promise<string | null> {
  const store = await cookies();
  const uid = store.get(DEMO_COOKIE)?.value;
  if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) return null;
  const r = await serviceQuery<{ id: string }>(
    "select id from public.profiles where id = $1 and not banned and not is_bot",
    [uid],
  );
  return r.rows[0]?.id ?? null;
}

// Neon with Supabase Auth: copy a new Supabase Auth identity into the Neon
// auth.users mirror (id, email, sign-up metadata only; passwords stay in
// Supabase). The handle_new_user trigger then checks the invite and creates the
// profile atomically, exactly as it does on Supabase.
export async function mirrorAuthUser(user: { id: string; email?: string | null; created_at?: string }, meta: Record<string, unknown>) {
  await serviceQuery(
    "insert into auth.users (id, email, raw_user_meta_data, created_at) values ($1, $2, $3, coalesce($4::timestamptz, now()))",
    [user.id, user.email?.toLowerCase() ?? null, JSON.stringify(meta), user.created_at ?? null],
  );
}

export async function getUserId(): Promise<string | null> {
  const mode = appMode();
  if (mode === "demo") return currentDemoUser();
  if (mode === "supabase") {
    const sb = await supabaseForRequest();
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  }
  return null;
}

function rpcVia(userId: string, call: (fn: string, args: Record<string, unknown>) => Promise<unknown>): Db {
  return {
    userId,
    rpc: async <T,>(fn: string, args?: Record<string, unknown>) => {
      try {
        const out = (await call(fn, args ?? {})) as T;
        // A write may have created notifications: send any pushes in the background.
        if (!READ_RPCS.has(fn as RpcName) && mayNotify(fn)) schedulePush();
        return out;
      } catch (err) {
        throw toAppError(err);
      }
    },
  };
}

export async function getUserDb(): Promise<Db> {
  requireConfigured();
  const backend = dataBackend();
  if (appMode() === "demo") {
    const uid = await currentDemoUser();
    if (!uid) throw new AppError("UNAUTHENTICATED", "Please log in first.", 401);
    return rpcVia(uid, (fn, args) => (backend === "postgres" ? pgRpc(uid, fn, args) : demoRpc(uid, fn, args)));
  }
  // Supabase Auth verifies the session server-side (getUser hits the Auth
  // server; the cookie alone is never trusted).
  const sb = await supabaseForRequest();
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new AppError("UNAUTHENTICATED", "Please log in first.", 401);
  const uid = data.user.id;
  if (backend === "postgres") return rpcVia(uid, (fn, args) => pgRpc(uid, fn, args));
  return rpcVia(uid, async (fn, args) => {
    const { data: out, error } = await sb.rpc(fn, args);
    if (error) throw error;
    if (!READ_RPCS.has(fn as RpcName)) scheduleDrain();
    return out;
  });
}

// Service-level calls (bot posts, invite checks). Never exposed to clients.
export async function serviceRpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  requireConfigured();
  try {
    const backend = dataBackend();
    const pushAfter = SERVICE_WRITES.test(fn) && !fn.startsWith("push_");
    if (backend === "pglite" || backend === "postgres") {
      const out = backend === "pglite" ? await demoRpc<T>(null, fn, args) : await pgRpc<T>(null, fn, args);
      if (pushAfter) schedulePush();
      return out;
    }
    const { data, error } = await supabaseAdmin().rpc(fn, args);
    if (error) throw error;
    if (SERVICE_WRITES.test(fn)) scheduleDrain();
    if (pushAfter) schedulePush();
    return data as T;
  } catch (err) {
    throw toAppError(err);
  }
}
