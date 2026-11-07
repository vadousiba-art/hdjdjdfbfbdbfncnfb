import "server-only";
import { memberBlock, wantsTrending, type AtlasMember } from "@/lib/atlas/prompt";
import type { Db } from "./db";
import type { Turn } from "./atlas";

// What Atlas knows for one request: the member's own profile basics, trending
// tags when the question is about discovery, and the recent conversation (text
// only, trimmed so long chats don't resend everything).
export async function memberContext(db: Db, text: string) {
  const [me, trending] = await Promise.all([
    db.rpc<AtlasMember>("get_atlas_context"),
    wantsTrending(text)
      ? db.rpc<{ tag: string }[]>("get_trending_tags", { p_limit: 8 }).then((t) => (t ?? []).map((x) => x.tag)).catch(() => [])
      : Promise.resolve([] as string[]),
  ]);
  return memberBlock(me, trending);
}

export async function recentTurns(db: Db, limit = 16): Promise<Turn[]> {
  const { history } = await db.rpc<{ history: { role: "user" | "assistant"; content: string }[] }>("get_atlas", { p_limit: limit });
  const turns = history.map((m) => ({ role: m.role, content: m.content.length > 2000 ? `${m.content.slice(0, 2000)}…` : m.content }));
  // Providers want the conversation to start with the member.
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}
