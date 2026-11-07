import { NextRequest } from "next/server";
import { z } from "zod";
import { atlasConfig } from "@/lib/config";
import { atlasModels } from "@/lib/server/atlas";
import { getUserDb } from "@/lib/server/db";
import { AppError, assertWritable, handle } from "@/lib/server/errors";

// Everything the Atlas page needs in one request: the free models on offer,
// the member's saved model and voice setting, and their recent conversation.
export async function GET() {
  return handle(async () => {
    const db = await getUserDb();
    const [models, mine] = await Promise.all([
      atlasModels(),
      db.rpc<{ model: string; speak: boolean; history: unknown[] }>("get_atlas", { p_limit: 40 }),
    ]);
    const cfg = atlasConfig();
    return { ...mine, models, ready: { gemini: Boolean(cfg.geminiKey), openrouter: Boolean(cfg.openrouterKey) } };
  });
}

const Prefs = z.object({ model: z.string().min(1).max(120).optional(), speak: z.boolean().optional() }).strict();

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    assertWritable();
    const db = await getUserDb();
    const p = Prefs.parse(await req.json().catch(() => ({})));
    if (p.model && !(await atlasModels()).some((m) => m.id === p.model)) {
      throw new AppError("NOT_FOUND", "That model isn't available. Pick another one.", 404);
    }
    return db.rpc("atlas_set_prefs", { p_model: p.model ?? null, p_speak: p.speak ?? null });
  });
}

export async function DELETE() {
  return handle(async () => {
    assertWritable();
    const db = await getUserDb();
    await db.rpc("atlas_clear");
    return { cleared: true };
  });
}
