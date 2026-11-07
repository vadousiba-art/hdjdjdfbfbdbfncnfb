import { NextRequest } from "next/server";
import { z } from "zod";
import { appMode, supabaseAnonKey, supabaseUrl, uploadConfig } from "@/lib/config";
import { getUserDb } from "@/lib/server/db";
import { AppError, assertWritable, handle } from "@/lib/server/errors";
import { newMediaLocation, storageFor } from "@/lib/server/storage";
import { maxBytesFor, mediaKind, newUploadPath, signDemoUpload } from "@/lib/server/uploads";

const Req = z.object({ type: z.string().max(60), size: z.number().int().positive() });

// Step 1 of an upload: validate type/size + per-user quota, then hand out a
// one-time upload target. Supabase: a signed upload URL for the private
// bucket (which also enforces type/size). Demo: an HMAC-signed local URL.
export async function POST(req: NextRequest) {
  return handle(async () => {
    assertWritable();
    const parsed = Req.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) throw new AppError("INVALID", "Bad upload request.", 400);
    const { type, size } = parsed.data;
    const kind = mediaKind(type);
    if (!kind) {
      throw new AppError("INVALID", "Only JPG, PNG, WEBP, GIF, MP4, WEBM or MOV. No .exe memes.", 400);
    }
    if (size > maxBytesFor(type)) {
      const mb = Math.round(maxBytesFor(type) / 1024 / 1024);
      throw new AppError("INVALID", `That file is too large. Max ${mb}MB.`, 400);
    }
    const db = await getUserDb();
    const quota = await db.rpc<{ allowed: boolean }>("consume_quota", {
      p_bucket: "upload",
      p_max: uploadConfig.perHour,
      p_window_seconds: 3600,
    });
    if (!quota.allowed) throw new AppError("RATE_LIMIT", "Upload limit reached. Your camera roll needs a break.", 429);

    const path = newUploadPath(db.userId, type);
    if (appMode() === "supabase") {
      // New uploads are spread over the Supabase projects that accept them.
      const where = newMediaLocation(path);
      const { bucket, objectPath } = storageFor(where.path);
      const { data, error } = await bucket.createSignedUploadUrl(objectPath);
      if (error || !data) throw new AppError("INTERNAL", "Storage refused the upload. Is the media bucket set up?", 500);
      // signedUrl/apikey let the Android app upload with a plain PUT (the
      // browser uses supabase-js with the same token).
      const base = where.project ? where.project.url : supabaseUrl()!;
      return {
        mode: "supabase",
        path: where.path,
        objectPath,
        token: data.token,
        kind,
        project: where.project ? { n: where.project.n, url: where.project.url, key: where.project.publishableKey } : null,
        signedUrl: `${base.replace(/\/$/, "")}/storage/v1/object/upload/sign/media/${objectPath}?token=${encodeURIComponent(data.token)}`,
        apikey: where.project ? where.project.publishableKey : supabaseAnonKey(),
      };
    }
    const exp = Date.now() + 10 * 60_000;
    const sig = signDemoUpload(path, type, exp);
    const q = new URLSearchParams({ path, type, exp: String(exp), sig });
    return { mode: "demo", path, uploadUrl: `/api/upload/demo?${q}`, kind };
  });
}
