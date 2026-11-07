// Atlas models and routing, shared by the server and the model picker.
// Pure functions only: no keys, no network.

export type AtlasModel = {
  id: string; // "gemini" or an OpenRouter id like "vendor/model:free"
  name: string;
  provider: "gemini" | "openrouter";
  vision: boolean; // can look at images
  audio: boolean; // can listen to audio
  context: number; // tokens
  blurb?: string;
};

export const GEMINI_ID = "gemini";
export const GEMINI: AtlasModel = {
  id: GEMINI_ID,
  name: "Gemini Flash",
  provider: "gemini",
  vision: true,
  audio: true,
  context: 1_000_000,
  blurb: "YORU's default. Hears voice, sees images, reads text.",
};

// A raw entry from OpenRouter's public /api/v1/models list (only the fields we use).
export type OpenRouterRaw = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string; request?: string; image?: string };
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
};

const zero = (v?: string) => v === undefined || v === null || Number(v) === 0;

// Only free chat models are offered. A model counts as free when its id says
// ":free" and every listed price is zero. Left out on purpose: routers that
// pick a different model per request (Atlas never switches models silently),
// models that don't answer in text (music, images), and safety classifiers.
export function freeTextModels(raw: OpenRouterRaw[]): AtlasModel[] {
  return raw
    .filter((m) => {
      const p = m.pricing ?? {};
      const out = m.architecture?.output_modalities ?? ["text"];
      return (
        m.id.endsWith(":free") &&
        zero(p.prompt) && zero(p.completion) && zero(p.request) && zero(p.image) &&
        out.length === 1 && out[0] === "text" &&
        !/^openrouter\//.test(m.id) &&
        !/(content-safety|guard|moderation)/i.test(m.id)
      );
    })
    .map((m) => {
      const input = m.architecture?.input_modalities ?? ["text"];
      return {
        id: m.id,
        name: (m.name ?? m.id).replace(/\s*\(free\)\s*$/i, ""),
        provider: "openrouter" as const,
        vision: input.includes("image"),
        // Audio always goes to Gemini (see routeRequest), so this is informational.
        audio: input.includes("audio"),
        context: m.context_length ?? 32_000,
        blurb: m.description ? firstSentence(m.description) : undefined,
      };
    })
    .sort((a, b) => Number(b.vision) - Number(a.vision) || b.context - a.context || a.name.localeCompare(b.name));
}

function firstSentence(s: string) {
  const one = s.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  return one.length > 140 ? `${one.slice(0, 137)}…` : one;
}

export type Attachment = { kind: "image" | "audio"; mime: string };

export type Route = {
  provider: "gemini" | "openrouter";
  model: string; // "gemini" or the OpenRouter id
  // Shown under the reply when the turn didn't go to the member's own choice.
  note?: string;
};

// Where a request goes:
//   audio (voice or files)  → Gemini, always
//   images                  → the chosen model if it can see images, else Gemini
//   text only               → the chosen model
// Anything a model can't take is never sent to it; when a turn goes to Gemini
// instead of the chosen model, the reply says so.
export function routeRequest(chosen: AtlasModel, attachments: Attachment[]): Route {
  const audio = attachments.some((a) => a.kind === "audio");
  const image = attachments.some((a) => a.kind === "image");
  if (chosen.provider === "gemini") return { provider: "gemini", model: GEMINI_ID };
  if (audio) return { provider: "gemini", model: GEMINI_ID, note: `Gemini handled this one: ${chosen.name} can't listen to audio here.` };
  if (image && !chosen.vision) return { provider: "gemini", model: GEMINI_ID, note: `Gemini handled this one: ${chosen.name} can't see images.` };
  return { provider: "openrouter", model: chosen.id };
}

// Inputs Atlas accepts (checked on the server; the browser converts what it can).
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const AUDIO_TYPES = ["audio/wav", "audio/x-wav", "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/mp3", "audio/aac", "audio/flac", "audio/x-m4a", "audio/m4a"] as const;
export const ATLAS_LIMITS = {
  text: 4000, // characters per message
  files: 3, // attachments per message
  bytes: 3 * 1024 * 1024, // all attachments together, before base64 (fits serverless request limits)
  voiceSeconds: 60,
};
