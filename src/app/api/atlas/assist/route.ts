import { NextRequest } from "next/server";
import { z } from "zod";
import { GEMINI_ID } from "@/lib/atlas/models";
import { ASSIST_LIMIT, ASSIST_TASKS, type AssistTask } from "@/lib/atlas/prompt";
import { atlasQuota, collect, findModel, streamGemini, streamOpenRouter } from "@/lib/server/atlas";
import { memberContext } from "@/lib/server/atlas-member";
import { getUserDb } from "@/lib/server/db";
import { AppError, assertWritable, handle } from "@/lib/server/errors";

// Inline drafting from YORU's own text boxes (post composer, comments, chat,
// bio). Returns a suggestion only: the member edits it and presses Post / Send
// / Save themselves. Uses the member's chosen model (text only), no history.
export const maxDuration = 60;

const Body = z.object({
  task: z.enum(Object.keys(ASSIST_TASKS) as [AssistTask, ...AssistTask[]]),
  text: z.string().trim().max(2000).default(""),
  context: z.string().trim().max(1500).optional(),
});

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertWritable();
    const db = await getUserDb();
    const { task, text, context } = Body.parse(await req.json().catch(() => ({})));
    if (!text && !context) throw new AppError("INVALID", "Type a few words first, and Atlas will take it from there.", 400);
    const { model: pref } = await db.rpc<{ model: string }>("get_atlas", { p_limit: 1 });
    const chosen = (await findModel(pref)) ?? (await findModel(GEMINI_ID));
    if (!chosen) throw new AppError("NOT_CONFIGURED", "Atlas isn't set up yet.", 503);
    await atlasQuota(db);
    const member = await memberContext(db, "");
    const prompt = [
      `<task>${ASSIST_TASKS[task]}</task>`,
      context ? `<context>${context}</context>` : "",
      text ? `<member_text>${text}</member_text>` : "",
      "Reply with only the finished text: no quotes, no fenced block, no notes.",
    ].filter(Boolean).join("\n");
    const stream = chosen.provider === "gemini"
      ? streamGemini({ member, history: [], text: prompt, inline: [], signal: req.signal })
      : streamOpenRouter({ model: chosen, member, history: [], text: prompt, images: [], signal: req.signal });
    const out = await collect(stream);
    const clean = out.text.replace(/^```\w*\n?|\n?```$/g, "").replace(/^["“]([\s\S]*)["”]$/, "$1").trim().slice(0, ASSIST_LIMIT[task]);
    if (!clean) throw new AppError("AI_UNAVAILABLE", "Atlas came back empty-handed. Try again.", 503);
    return { text: clean, model: out.model };
  });
}
