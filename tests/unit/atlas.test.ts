import { describe, expect, it } from "vitest";
import { GEMINI, freeTextModels, routeRequest, type OpenRouterRaw } from "@/lib/atlas/models";
import { ASSIST_LIMIT, ASSIST_TASKS, memberBlock, wantsTrending } from "@/lib/atlas/prompt";
import { speakable, splitDrafts } from "@/lib/client/atlas";

const free = { prompt: "0", completion: "0" };
const RAW: OpenRouterRaw[] = [
  { id: "acme/text-1:free", name: "Acme: Text 1 (free)", context_length: 131072, pricing: free, architecture: { input_modalities: ["text"], output_modalities: ["text"] } },
  { id: "acme/vision-2:free", name: "Acme: Vision 2 (free)", context_length: 262144, pricing: free, architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] } },
  { id: "acme/paid-3", name: "Acme: Paid 3", pricing: { prompt: "0.000001", completion: "0.000002" }, architecture: { output_modalities: ["text"] } },
  { id: "acme/sneaky:free", name: "Sneaky (free)", pricing: { prompt: "0", completion: "0", request: "0.01" }, architecture: { output_modalities: ["text"] } },
  { id: "openrouter/free", name: "Free Models Router", pricing: free, architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] } },
  { id: "google/lyria-3-clip:free", name: "Lyria", pricing: free, architecture: { input_modalities: ["text"], output_modalities: ["text", "audio"] } },
  { id: "nvidia/nemotron-content-safety:free", name: "Safety", pricing: free, architecture: { output_modalities: ["text"] } },
  { id: "zero/not-marked", name: "Zero but not :free", pricing: free, architecture: { output_modalities: ["text"] } },
];

describe("Atlas model list", () => {
  it("offers only free chat models: no paid, routers, music, classifiers or hidden fees", () => {
    const ids = freeTextModels(RAW).map((m) => m.id);
    expect(ids).toEqual(["acme/vision-2:free", "acme/text-1:free"]);
  });

  it("marks image support and tidies names", () => {
    const [vision, text] = freeTextModels(RAW);
    expect(vision).toMatchObject({ name: "Acme: Vision 2", vision: true, provider: "openrouter", context: 262144 });
    expect(text.vision).toBe(false);
  });
});

describe("Atlas routing", () => {
  const [vision, text] = freeTextModels(RAW);
  const img = { kind: "image" as const, mime: "image/jpeg" };
  const aud = { kind: "audio" as const, mime: "audio/webm" };

  it("uses the member's own model for text, with no note", () => {
    expect(routeRequest(text, [])).toEqual({ provider: "openrouter", model: "acme/text-1:free" });
    expect(routeRequest(GEMINI, [])).toEqual({ provider: "gemini", model: "gemini" });
  });

  it("always sends audio to Gemini, and says so", () => {
    const r = routeRequest(vision, [aud]);
    expect(r.provider).toBe("gemini");
    expect(r.note).toMatch(/can't listen/);
  });

  it("sends images to a model that can see them, otherwise to Gemini with a note", () => {
    expect(routeRequest(vision, [img])).toEqual({ provider: "openrouter", model: "acme/vision-2:free" });
    const r = routeRequest(text, [img]);
    expect(r).toMatchObject({ provider: "gemini" });
    expect(r.note).toMatch(/can't see images/);
  });
});

describe("Atlas replies", () => {
  it("splits YORU drafts out of a reply", () => {
    const pieces = splitDrafts("Here you go:\n```post\nNight shift vibes #anime\n```\nWant another?\n```bio\nI draw at 3am.\n```");
    expect(pieces).toEqual([
      { kind: "text", text: "Here you go:\n" },
      { kind: "draft", target: "post", text: "Night shift vibes #anime" },
      { kind: "text", text: "\nWant another?\n" },
      { kind: "draft", target: "bio", text: "I draw at 3am." },
    ]);
    // Other code blocks stay text.
    expect(splitDrafts("```js\nx()\n```")).toEqual([{ kind: "text", text: "```js\nx()\n```" }]);
  });

  it("reads replies aloud without markdown, links or code", () => {
    expect(speakable("**Sure!** See [the docs](https://x.y) or `run()`.\n```\ncode\n```\nDone https://a.b")).toBe("Sure! See the docs or run(). Done");
  });

  it("adds trending tags only for discovery questions, and the member's own details", () => {
    expect(wantsTrending("what's trending on YORU tonight?")).toBe(true);
    expect(wantsTrending("help me fix this code")).toBe(false);
    const b = memberBlock({ username: "ari", display_name: "Ari", bio: "night owl", status: "" }, ["anime"]);
    expect(b).toContain("Ari (@ari)");
    expect(b).toContain("#anime");
    expect(b).not.toContain("Status");
  });

  it("keeps inline drafts within YORU's own limits", () => {
    expect(ASSIST_LIMIT.bio).toBe(280);
    expect(ASSIST_LIMIT.comment).toBe(1000);
    expect(Object.keys(ASSIST_LIMIT).sort()).toEqual(Object.keys(ASSIST_TASKS).sort());
  });
});
