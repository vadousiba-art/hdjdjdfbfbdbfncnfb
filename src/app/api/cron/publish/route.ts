import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { serviceRpc } from "@/lib/server/db";
import { AppError, errorResponse } from "@/lib/server/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Post Planner: publishes scheduled drafts whose time has come. On Supabase
// pg_cron already runs this every minute (migration 0009); this route is the
// fallback for databases without pg_cron. Call it every minute with
// "Authorization: Bearer $CRON_SECRET". Running it twice is harmless.
function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  try {
    if (!authorized(req)) throw new AppError("NOT_FOUND", "Not found.", 404);
    const r = await serviceRpc<{ published: number; retrying_or_failed: number }>("pro_publish_due", { p_limit: 100, p_runner: "http" });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return errorResponse(err);
  }
}
