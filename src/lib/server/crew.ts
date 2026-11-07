import "server-only";
import { z } from "zod";
import { atlasConfig } from "@/lib/config";
import { INTERESTS } from "@/lib/opengates";

// Names and bios for new Night Crew accounts (migration 0018), written by
// Gemini when its key is set, otherwise picked from a built-in list. Whatever
// the text says, the database labels every one of them as a YORU bot.

export type CrewDraft = { name: string; bio: string; interests: string[] };

const Draft = z.object({ name: z.string().min(1).max(40), bio: z.string().max(300), interests: z.array(z.string()).max(6) });

const NAMES = ["Aki", "Hana", "Ren", "Nao", "Yume", "Kiko", "Taro", "Emi", "Ryo", "Saki", "Leo", "Mila", "Noor", "Ivy", "Zane", "Luca", "Ada", "Omar", "Juno", "Kira", "Nova", "Remy", "Tess", "Ezra"];
const BIOS = [
  "Night owl who never scrolls past a good drawing.",
  "Here for the 2 am posts and the people brave enough to share them.",
  "If you made it, I want to see it.",
  "Collecting good vibes, hot takes and new favorite creators.",
  "Professional encourager, amateur meme critic.",
  "Your first post deserves a first like. That's my job.",
];

function fallback(count: number): CrewDraft[] {
  const keys = INTERESTS as readonly string[];
  return Array.from({ length: count }, () => ({
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    bio: BIOS[Math.floor(Math.random() * BIOS.length)],
    interests: [...keys].sort(() => Math.random() - 0.5).slice(0, 2),
  }));
}

export async function draftCrew(count: number): Promise<{ drafts: CrewDraft[]; by: "gemini" | "built-in" }> {
  const cfg = atlasConfig();
  if (!cfg.geminiKey) return { drafts: fallback(count), by: "built-in" };
  const prompt = [
    `Write ${count} profiles for YORU's "Night Crew": friendly bot accounts on YORU, a late-night social app for fans of anime, gaming, art and music.`,
    "They like and follow members' posts so newcomers feel welcome. Everyone can see they are bots.",
    "For each give: name (one short first name or nickname, 2 to 12 letters, varied cultures, no surnames),",
    "bio (one warm, playful sentence under 110 characters about the kind of posts they love; never claim to be human, never mention a real person),",
    `interests (2 or 3 of: ${(INTERESTS as readonly string[]).join(", ")}).`,
    'Reply with only a JSON array of {"name", "bio", "interests"} objects. All names different.',
  ].join("\n");
  for (const model of cfg.geminiModels) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": cfg.geminiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 1, maxOutputTokens: 8192 },
        }),
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
      const text = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
      const parsed = z.array(Draft).safeParse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")));
      if (parsed.success && parsed.data.length) {
        const drafts = parsed.data.slice(0, count);
        while (drafts.length < count) drafts.push(fallback(1)[0]);
        return { drafts, by: "gemini" };
      }
    } catch {
      /* try the next model, then the built-in list */
    }
  }
  return { drafts: fallback(count), by: "built-in" };
}
