import "server-only";
import { atlasConfig } from "@/lib/config";
import { freeTextModels, GEMINI, type AtlasModel, type OpenRouterRaw } from "@/lib/atlas/models";
import { ATLAS_SYSTEM } from "@/lib/atlas/prompt";
import { AppError } from "./errors";
import type { Db } from "./db";

// Atlas's provider layer. Keys stay here; the browser only ever talks to
// /api/atlas/*. Both providers are called over plain fetch (no SDKs to ship),
// with timeouts, and stream text back as it's written.

export type Turn = { role: "user" | "assistant"; content: string };
export type Inline = { kind: "image" | "audio"; mime: string; data: string }; // base64
export type Chunk = { model?: string; text?: string };

const TIMEOUT_MS = 50_000;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://yoru-social.vercel.app";

// ---------------------------------------------------------------- models

let cached: { at: number; models: AtlasModel[] } | null = null;
let loading: Promise<AtlasModel[]> | null = null;
const MODELS_TTL = 15 * 60_000;

async function fetchFreeModels(): Promise<AtlasModel[]> {
  const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`OpenRouter models ${res.status}`);
  const body = (await res.json()) as { data?: OpenRouterRaw[] };
  return freeTextModels(body.data ?? []);
}

// Gemini (when its key is set) plus OpenRouter's free text models (when its key
// is set). The OpenRouter list is public and cached for 15 minutes; if it
// can't be fetched, the last good list is kept.
export async function atlasModels(): Promise<AtlasModel[]> {
  const cfg = atlasConfig();
  const gemini = cfg.geminiKey ? [GEMINI] : [];
  if (!cfg.openrouterKey) return gemini;
  if (!cached || Date.now() - cached.at > MODELS_TTL) {
    loading ??= fetchFreeModels()
      .then((models) => (cached = { at: Date.now(), models }).models)
      .catch((err) => {
        console.warn("[atlas] couldn't refresh the OpenRouter model list:", String(err));
        return cached?.models ?? [];
      })
      .finally(() => (loading = null));
    await loading;
  }
  return [...gemini, ...(cached?.models ?? [])];
}

export async function findModel(id: string): Promise<AtlasModel | undefined> {
  return (await atlasModels()).find((m) => m.id === id);
}

// ---------------------------------------------------------------- quota

// Per-member limits held in Postgres, so they apply across server instances.
export async function atlasQuota(db: Db) {
  const cfg = atlasConfig();
  const minute = await db.rpc<{ allowed: boolean }>("consume_quota", { p_bucket: "atlas_minute", p_max: cfg.perMinute, p_window_seconds: 60 });
  if (!minute.allowed) throw new AppError("RATE_LIMIT", "Atlas needs a moment. Try again in a minute.", 429);
  const day = await db.rpc<{ allowed: boolean; remaining: number }>("consume_quota", { p_bucket: "atlas_day", p_max: cfg.perDay, p_window_seconds: 86400 });
  if (!day.allowed) throw new AppError("RATE_LIMIT", `You've used today's ${cfg.perDay} Atlas requests. They come back tomorrow.`, 429);
  return day.remaining;
}

// ---------------------------------------------------------------- SSE

async function* sse(res: Response): AsyncGenerator<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith("data:")) yield line.slice(5).trim();
    }
  }
  if (buf.trim().startsWith("data:")) yield buf.trim().slice(5).trim();
}

const busy = (provider: string) =>
  new AppError("AI_UNAVAILABLE", `${provider} is busy right now. Give it a minute and try again.`, 503);

// ---------------------------------------------------------------- Gemini

// What to do with the attached files, said plainly so a silent or unclear
// clip gets "I couldn't hear that" rather than a guess from the conversation.
function cue(inline: Inline[], voice?: boolean) {
  const audio = inline.some((f) => f.kind === "audio");
  const image = inline.some((f) => f.kind === "image");
  if (voice) return "[Voice message: the attached audio is the member speaking to you. Answer what they said, for listening. If it's silent or you can't make out any words, say you couldn't hear them and ask them to try again.]\n";
  if (audio && image) return "[The member attached audio and an image. Use both.]\n";
  if (audio) return "[The member attached an audio file. Listen to it and respond; if it has no clear content, say so.]\n";
  if (image) return "[The member attached an image.]\n";
  return "";
}

type GeminiPart = { text?: string; thought?: boolean; inline_data?: { mime_type: string; data: string } };

export async function* streamGemini(opts: {
  member: string;
  history: Turn[];
  text: string;
  inline: Inline[];
  voice?: boolean;
  signal?: AbortSignal;
}): AsyncGenerator<Chunk> {
  const cfg = atlasConfig();
  if (!cfg.geminiKey) throw new AppError("NOT_CONFIGURED", "Atlas's voice and image engine (Gemini) isn't set up yet.", 503);
  const contents = [
    ...opts.history.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
    {
      role: "user",
      parts: [
        ...opts.inline.map((f) => ({ inline_data: { mime_type: f.mime, data: f.data } })),
        { text: `${cue(opts.inline, opts.voice)}${opts.text}`.trim() },
      ],
    },
  ];
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: `${ATLAS_SYSTEM}\n\n${opts.member}` }] },
    contents,
    generationConfig: {
      maxOutputTokens: opts.voice ? 600 : 4096,
      thinkingConfig: { thinkingLevel: opts.voice ? "minimal" : "low" },
    },
  });

  let last: AppError | null = null;
  // The first model is the default; the next ones are only tried when it is
  // overloaded, rate-limited or retired, and the reply names the model used.
  for (const model of cfg.geminiModels) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": cfg.geminiKey },
      body,
      signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
    }).catch((err) => {
      throw err?.name === "TimeoutError" ? new AppError("AI_UNAVAILABLE", "Gemini took too long to answer. Try again.", 504) : err;
    });
    if (res.status === 429 || res.status === 503 || res.status === 500 || res.status === 404) {
      last = res.status === 429
        ? new AppError("RATE_LIMIT", "Atlas has hit Gemini's free-tier limit for now. Try again in a minute.", 429)
        : busy("Gemini");
      await res.body?.cancel();
      continue;
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      console.error("[atlas] gemini", res.status, err?.error?.message);
      if (res.status === 400 && /size|too large|exceeds/i.test(err?.error?.message ?? "")) {
        throw new AppError("INVALID", "That file is too big for Atlas. Try a shorter clip or a smaller image.", 400);
      }
      if (res.status === 400) throw new AppError("INVALID", "Gemini couldn't read that. Try a different file or message.", 400);
      if (res.status === 401 || res.status === 403) throw new AppError("NOT_CONFIGURED", "Atlas's Gemini key isn't working. An admin needs to check it.", 503);
      throw busy("Gemini");
    }
    let named = false;
    let any = false;
    for await (const data of sse(res)) {
      const d = JSON.parse(data) as {
        modelVersion?: string;
        promptFeedback?: { blockReason?: string };
        candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
      };
      if (d.promptFeedback?.blockReason) throw new AppError("BLOCKED", "Gemini won't help with that one. Try asking another way.", 422);
      if (!named) {
        named = true;
        yield { model: d.modelVersion ?? model };
      }
      for (const p of d.candidates?.[0]?.content?.parts ?? []) {
        if (p.text && !p.thought) {
          any = true;
          yield { text: p.text };
        }
      }
      if (d.candidates?.[0]?.finishReason === "SAFETY" && !any) {
        throw new AppError("BLOCKED", "Gemini won't help with that one. Try asking another way.", 422);
      }
    }
    return;
  }
  throw last ?? busy("Gemini");
}

// ---------------------------------------------------------------- OpenRouter

export async function* streamOpenRouter(opts: {
  model: AtlasModel;
  member: string;
  history: Turn[];
  text: string;
  images: Inline[];
  signal?: AbortSignal;
}): AsyncGenerator<Chunk> {
  const cfg = atlasConfig();
  if (!cfg.openrouterKey) throw new AppError("NOT_CONFIGURED", "Atlas's text models (OpenRouter) aren't set up yet.", 503);
  // Never send a model something it can't take, and never spend money: only
  // ids from the free list reach this point (checked by the caller too).
  if (!opts.model.id.endsWith(":free")) throw new AppError("FORBIDDEN", "Atlas only uses free models.", 403);
  const user = opts.images.length && opts.model.vision
    ? [{ type: "text", text: opts.text || "Take a look at what I attached." }, ...opts.images.map((f) => ({ type: "image_url", image_url: { url: `data:${f.mime};base64,${f.data}` } }))]
    : opts.text;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.openrouterKey}`,
      "HTTP-Referer": SITE,
      "X-Title": "YORU Atlas",
    },
    body: JSON.stringify({
      model: opts.model.id,
      stream: true,
      max_tokens: 4096,
      // Think a little, but don't spend the whole answer on it, and don't stream the thoughts.
      reasoning: { effort: "low", exclude: true },
      messages: [
        { role: "system", content: `${ATLAS_SYSTEM}\n\n${opts.member}` },
        ...opts.history,
        { role: "user", content: user },
      ],
    }),
    signal: opts.signal ? AbortSignal.any([opts.signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
  }).catch((err) => {
    throw err?.name === "TimeoutError" ? new AppError("AI_UNAVAILABLE", `${opts.model.name} took too long to answer. Try again or pick another model.`, 504) : err;
  });
  if (!res.ok) throw await openRouterError(res, opts.model);
  yield { model: opts.model.id };
  for await (const data of sse(res)) {
    if (data === "[DONE]") break;
    const d = JSON.parse(data) as { error?: { message?: string; code?: number }; choices?: { delta?: { content?: string } }[] };
    if (d.error) throw mapOpenRouter(d.error.code ?? 500, d.error.message ?? "", opts.model);
    const t = d.choices?.[0]?.delta?.content;
    if (t) yield { text: t };
  }
}

async function openRouterError(res: Response, model: AtlasModel) {
  const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return mapOpenRouter(res.status, err?.error?.message ?? "", model);
}

function mapOpenRouter(status: number, message: string, model: AtlasModel): AppError {
  if (status === 429) {
    return new AppError("RATE_LIMIT", `${model.name} is busy right now (free models share their limits). Try again shortly or pick another model.`, 429);
  }
  if (/context|too long|maximum.*tokens/i.test(message)) {
    return new AppError("INVALID", `This chat is too long for ${model.name}. Clear the chat or pick a model with more room.`, 400);
  }
  if (status === 404 || /no endpoints|not a valid model|not found/i.test(message)) {
    return new AppError("NOT_FOUND", `${model.name} isn't available any more. Pick another model.`, 404);
  }
  if (status === 402) return new AppError("FORBIDDEN", `${model.name} isn't free right now, so Atlas won't use it. Pick another model.`, 403);
  if (status === 401 || status === 403) {
    return new AppError("NOT_CONFIGURED", "Atlas's OpenRouter key isn't working. An admin needs to check it.", 503);
  }
  console.error("[atlas] openrouter", status, message.slice(0, 200));
  return new AppError("AI_UNAVAILABLE", `${model.name} had a problem answering. Try again or pick another model.`, 503);
}

// Collects a stream into one string (for inline drafting).
export async function collect(stream: AsyncGenerator<Chunk>): Promise<{ text: string; model: string }> {
  let text = "";
  let model = "";
  for await (const c of stream) {
    if (c.model) model = c.model;
    if (c.text) text += c.text;
  }
  return { text: text.trim(), model };
}


