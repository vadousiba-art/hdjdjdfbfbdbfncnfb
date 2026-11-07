import { NextRequest, after } from "next/server";
import { appMode } from "@/lib/config";
import { getUserDb } from "@/lib/server/db";
import { AppError, assertWritable, handle } from "@/lib/server/errors";
import { limit } from "@/lib/server/ratelimit";
import { READ_RPCS, RPC_SCHEMAS, isRpcName } from "@/lib/server/rpc-registry";
import { storageFor } from "@/lib/server/storage";
import { uploadPathsIn, verifyUploads } from "@/lib/server/uploads";
import { aiModerationAvailable, aiTest, forgetConfig, moderationModel, screenNew, secondOpinion, sweep, triageReport, type Screening } from "@/lib/server/moderation";

export const maxDuration = 60;

// Night Watch screens these before they are saved (src/lib/server/moderation.ts).
const SCREENED: Record<string, (a: Record<string, unknown>) => { kind: "post" | "comment" | "story"; text: string; link?: unknown; media?: unknown; type?: unknown }> = {
  create_post: (a) => ({ kind: "post", text: String(a.p_body ?? ""), link: a.p_link_url, media: a.p_media_url, type: a.p_media_type }),
  add_comment: (a) => ({ kind: "comment", text: String(a.p_body ?? "") }),
  create_story: (a) => ({ kind: "story", text: String(a.p_text ?? ""), media: a.p_media_url, type: a.p_media_type }),
};
const idOf = (r: unknown) => (typeof r === "string" ? r : r && typeof r === "object" && "id" in r ? String((r as { id: unknown }).id) : null);
const quietly = (label: string, job: () => Promise<unknown>) =>
  after(() => job().catch((err) => console.error(`[night-watch] ${label} failed:`, err instanceof Error ? err.message : err)));

// First bytes of an object in the private media bucket (signed URL + Range).
// null = the object does not exist; throws when storage cannot be reached.
async function storedHead(path: string): Promise<Uint8Array | null> {
  const { bucket, objectPath } = storageFor(path);
  const { data, error } = await bucket.createSignedUrl(objectPath, 60);
  if (error || !data) {
    if (/not found/i.test(error?.message ?? "")) return null;
    throw new Error(error?.message ?? "no signed url");
  }
  const res = await fetch(data.signedUrl, { headers: { Range: "bytes=0-15" }, signal: AbortSignal.timeout(8000) });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`storage responded ${res.status}`);
  return new Uint8Array(await res.arrayBuffer()).slice(0, 16);
}


export async function POST(req: NextRequest, ctx: { params: Promise<{ fn: string }> }) {
  return handle(async () => {
    const { fn } = await ctx.params;
    if (!isRpcName(fn)) throw new AppError("NOT_FOUND", "Unknown action. Are you hacking? Cute.", 404);
    if (!READ_RPCS.has(fn)) assertWritable();
    const body = await req.json().catch(() => ({}));
    const parsed = RPC_SCHEMAS[fn].safeParse(body ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new AppError("INVALID", `Invalid input${issue?.path.length ? ` (${issue.path.join(".")})` : ""}: ${issue?.message ?? "nope"}`, 400);
    }
    const db = await getUserDb();
    if (!limit(`rpc:${db.userId}`, 900, 60_000)) {
      throw new AppError("RATE_LIMIT", "You are clicking faster than a bot. Breathe.", 429);
    }
    const args = parsed.data as Record<string, unknown>;
    const uploads = uploadPathsIn(fn, args);
    if (uploads.length) {
      const problem = await verifyUploads(uploads, db.userId, appMode() === "supabase" ? storedHead : null);
      if (problem) throw new AppError("INVALID", problem, 400);
    }

    const screen = SCREENED[fn]?.(args);
    let screening: Screening | null = null;
    if (screen) {
      screening = await screenNew({
        userId: db.userId,
        kind: screen.kind,
        text: screen.text,
        link: typeof screen.link === "string" ? screen.link : null,
        mediaPath: typeof screen.media === "string" ? screen.media : null,
        mediaType: typeof screen.type === "string" ? screen.type : null,
      });
    }

    const result = await db.rpc(fn, args);

    if (screening) {
      const id = idOf(result);
      const s = screening;
      if (id) quietly("apply", () => s.after(id));
      if (aiModerationAvailable() && Math.random() < 0.25) quietly("sweep", () => sweep(3));
    }
    if (fn === "create_report") {
      quietly("report", () => triageReport(String(args.p_target_type), String(args.p_target_id)));
    }
    if (fn === "submit_appeal") {
      const a = result as { id?: string; status?: string } | null;
      if (a?.id && a.status === "open") quietly("appeal", () => secondOpinion(a.id!));
    }
    if (fn === "nw_set_config") forgetConfig();
    if (fn === "nw_dashboard" && result && typeof result === "object") {
      return { ...(result as object), ai: { available: aiModerationAvailable(), model: aiModerationAvailable() ? moderationModel() : null } };
    }
    if (fn === "nw_test" && result && typeof result === "object") {
      return { rules: result, ai: await aiTest(String(args.p_text ?? "")) };
    }
    return result;
  });
}
