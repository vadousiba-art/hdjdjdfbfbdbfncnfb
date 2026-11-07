import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { serviceRpc } from "@/lib/server/db";
import { AppError, errorResponse } from "@/lib/server/errors";
import { sweep } from "@/lib/server/moderation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Night Watch housekeeping: screens content that skipped the AI check and
// deletes closed cases older than a year. Call with
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
    let screened = 0;
    for (let i = 0; i < 6; i++) {
      const n = await sweep(10);
      screened += n;
      if (n < 10) break;
    }
    const purged = await serviceRpc("nw_purge");
    return NextResponse.json({ ok: true, screened, purged });
  } catch (err) {
    return errorResponse(err);
  }
}
