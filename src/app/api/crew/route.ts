import { NextRequest } from "next/server";
import { z } from "zod";
import { getUserDb } from "@/lib/server/db";
import { AppError, assertWritable, handle } from "@/lib/server/errors";
import { draftCrew } from "@/lib/server/crew";

// Owner only: add Night Crew accounts, named and described by Gemini.
// The database checks the owner again and labels every account as a bot.
export const maxDuration = 60;

const Body = z.object({ count: z.number().int().min(1).max(50) });

export async function POST(req: NextRequest) {
  return handle(async () => {
    assertWritable();
    const db = await getUserDb();
    const { count } = Body.parse(await req.json().catch(() => ({})));
    const me = await db.rpc<{ role: string }>("get_me", {});
    if (me?.role !== "owner") throw new AppError("FORBIDDEN", "Only the owner runs the Night Crew.", 403);
    const { drafts, by } = await draftCrew(count);
    const crew = await db.rpc("admin_add_crew", { p_members: drafts });
    return { crew, by, added: drafts.length };
  });
}
