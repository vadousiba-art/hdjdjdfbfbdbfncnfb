import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const STATUS: Record<string, number> = {
  NOT_MEMBER: 401,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  INVALID: 400,
  INVALID_INVITE: 400,
  USERNAME_TAKEN: 409,
  AI_UNAVAILABLE: 503,
  NOT_CONFIGURED: 503,
  MUTED: 403,
  AUTOMOD: 422,
  LOCKDOWN: 403,
  SLOW_MODE: 429,
  DB_UNAVAILABLE: 503,
  DB_TIMEOUT: 503,
  MAINTENANCE: 503,
};

// Cutover switch: MAINTENANCE_READ_ONLY=true keeps reading working and pauses
// every write, so nothing lands in the old database after the final copy.
export function assertWritable() {
  if (process.env.MAINTENANCE_READ_ONLY === "true") {
    throw new AppError("MAINTENANCE", "YORU is moving to a new home. Posting is paused for a few minutes, reading still works.", 503);
  }
}

// Connection-level failures (database waking up, network drop, failover).
// Only the connect step is retried automatically; see postgres.ts.
const TRANSIENT_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN", "57P01", "57P02", "57P03", "53300"]);

export function isTransientDbError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (!e) return false;
  if (e.code && (TRANSIENT_CODES.has(e.code) || e.code.startsWith("08"))) return true;
  return /Connection terminated|connection timeout|timeout exceeded when trying to connect|Client has encountered a connection error/i.test(e.message ?? "");
}

// Postgres functions raise 'CODE|Human message'. Map those (and raw driver
// errors) onto an AppError with a sensible HTTP status.
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError("INVALID", `Invalid input: ${err.issues[0]?.message ?? "nope"}`, 400);
  }
  const e = err as { message?: string; code?: string };
  const msg = e?.message ?? String(err);
  const m = msg.match(/([A-Z_]{3,30})\|([^\n]+)/);
  if (m) return new AppError(m[1], m[2].trim(), STATUS[m[1]] ?? 400);
  if (isTransientDbError(err)) {
    console.warn("[yoru] database unavailable:", e?.code ?? msg);
    return new AppError("DB_UNAVAILABLE", "The database is waking up or unreachable. Please try again in a moment.", 503);
  }
  if (e?.code === "57014") return new AppError("DB_TIMEOUT", "That took too long. Please try again.", 503);
  if (e?.code === "23514" || e?.code === "22P02" || e?.code === "23502" || e?.code === "22001")
    return new AppError("INVALID", "That input is cursed. The database rejected it.", 400);
  if (e?.code === "23505") return new AppError("INVALID", "That already exists.", 409);
  if (e?.code === "23503") return new AppError("NOT_FOUND", "That thing does not exist (anymore).", 404);
  if (e?.code === "42501" || /permission denied/i.test(msg))
    return new AppError("FORBIDDEN", "Access denied. The bouncer said no.", 403);
  console.error("[itn] unexpected error", err);
  return new AppError("INTERNAL", "Something exploded on our end. Probably a skill issue (ours).", 500);
}

export function errorResponse(err: unknown) {
  const e = toAppError(err);
  return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
}

export async function handle<T>(fn: () => Promise<T>) {
  try {
    const data = await fn();
    return NextResponse.json({ data: data ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}
