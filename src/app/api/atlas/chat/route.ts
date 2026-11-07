import { NextRequest } from "next/server";
import { z } from "zod";
import { ATLAS_LIMITS, AUDIO_TYPES, IMAGE_TYPES, routeRequest } from "@/lib/atlas/models";
import { atlasQuota, findModel, streamGemini, streamOpenRouter, type Chunk, type Inline } from "@/lib/server/atlas";
import { memberContext, recentTurns } from "@/lib/server/atlas-member";
import { getUserDb } from "@/lib/server/db";
import { AppError, assertWritable, errorResponse, toAppError } from "@/lib/server/errors";

// One Atlas turn. The reply streams back as newline-delimited JSON:
//   {"t":"meta","model":"…","via":"gemini"|"openrouter","note":"…"}
//   {"t":"d","v":"text"} …
//   {"t":"done"}   or   {"t":"error","code":"…","message":"…"}
export const maxDuration = 60;

const mimes = new Set<string>([...IMAGE_TYPES, ...AUDIO_TYPES]);
const Body = z.object({
  text: z.string().trim().max(ATLAS_LIMITS.text).default(""),
  model: z.string().min(1).max(120),
  voice: z.boolean().optional(),
  attachments: z
    .array(z.object({
      kind: z.enum(["image", "audio"]),
      mime: z.string().max(60).transform((m) => m.split(";")[0].trim().toLowerCase()),
      data: z.string().max(Math.ceil((ATLAS_LIMITS.bytes * 4) / 3) + 8).regex(/^[A-Za-z0-9+/]+=*$/),
    }))
    .max(ATLAS_LIMITS.files)
    .default([]),
});

const line = (o: unknown) => new TextEncoder().encode(`${JSON.stringify(o)}\n`);

export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  let db: Awaited<ReturnType<typeof getUserDb>>;
  let stream: AsyncGenerator<Chunk>;
  let via: "gemini" | "openrouter";
  let note: string | undefined;
  try {
    assertWritable();
    db = await getUserDb();
    body = Body.parse(await req.json().catch(() => ({})));
    if (!body.text && !body.attachments.length) throw new AppError("INVALID", "Say or attach something first.", 400);
    let bytes = 0;
    for (const a of body.attachments) {
      if (!mimes.has(a.mime) || !a.mime.startsWith(`${a.kind}/`)) throw new AppError("INVALID", `Atlas can't read ${a.mime} files.`, 400);
      bytes += Math.floor((a.data.length * 3) / 4);
    }
    if (bytes > ATLAS_LIMITS.bytes) throw new AppError("INVALID", "Those files are too big together. Try a smaller image or a shorter clip.", 400);

    // The member's choice, exactly; an unknown or retired model is an error,
    // never a silent swap.
    const chosen = await findModel(body.model);
    if (!chosen) throw new AppError("NOT_FOUND", "That model isn't available any more. Pick another one.", 404);
    const route = routeRequest(chosen, body.attachments);
    via = route.provider;
    note = route.note;
    await atlasQuota(db);
    const [member, history] = await Promise.all([memberContext(db, body.text), recentTurns(db)]);
    const inline = body.attachments as Inline[];
    stream = route.provider === "gemini"
      ? streamGemini({ member, history, text: body.text, inline, voice: body.voice, signal: req.signal })
      : streamOpenRouter({ model: chosen, member, history, text: body.text, images: inline.filter((a) => a.kind === "image"), signal: req.signal });
  } catch (err) {
    return errorResponse(err);
  }

  const kinds = body.attachments.map((a) => (a.kind === "audio" && body.voice ? "voice" : a.kind));
  const asked = body.text || (body.voice ? "🎤 Voice message" : kinds.includes("image") ? "🖼 Sent an image" : "🎧 Sent audio");
  return new Response(
    new ReadableStream({
      async start(ctrl) {
        let text = "";
        let model = "";
        try {
          for await (const c of stream) {
            if (c.model) {
              model = c.model;
              ctrl.enqueue(line({ t: "meta", model, via, note }));
            }
            if (c.text) {
              text += c.text;
              ctrl.enqueue(line({ t: "d", v: c.text }));
            }
          }
          if (!text.trim()) throw new AppError("AI_UNAVAILABLE", "Atlas came back empty-handed. Try again.", 503);
          await db.rpc("atlas_save_exchange", { p_user_text: asked, p_ai_text: text, p_model: model, p_attachments: kinds }).catch((e) => console.warn("[atlas] save failed", String(e)));
          ctrl.enqueue(line({ t: "done" }));
        } catch (err) {
          if (req.signal.aborted) return ctrl.close();
          const e = toAppError(err);
          ctrl.enqueue(line({ t: "error", code: e.code, message: e.message }));
        }
        ctrl.close();
      },
    }),
    { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } },
  );
}
