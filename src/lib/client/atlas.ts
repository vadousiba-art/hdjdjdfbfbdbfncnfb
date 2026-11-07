"use client";

import { ApiError, get, optimizeImage, post } from "./api";
import { ATLAS_LIMITS, AUDIO_TYPES, IMAGE_TYPES, type AtlasModel } from "@/lib/atlas/models";
import type { AssistTask } from "@/lib/atlas/prompt";

export type AtlasHistory = { id: string; role: "user" | "assistant"; content: string; model?: string | null; attachments?: string[]; created_at: string };
export type AtlasState = {
  model: string;
  speak: boolean;
  history: AtlasHistory[];
  models: AtlasModel[];
  ready: { gemini: boolean; openrouter: boolean };
};
export type Outgoing = { kind: "image" | "audio"; mime: string; data: string; name: string; preview?: string; bytes: number; voice?: boolean };

export const loadAtlas = () => get<AtlasState>("/api/atlas");

async function send<T>(method: "PATCH" | "DELETE", body?: unknown) {
  const res = await fetch("/api/atlas", { method, credentials: "same-origin", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(json?.error?.code ?? "HTTP", json?.error?.message ?? "Request failed", res.status);
  return json?.data as T;
}
export const savePrefs = (p: { model?: string; speak?: boolean }) => send<{ model: string; speak: boolean }>("PATCH", p);
export const clearAtlas = () => send<{ cleared: boolean }>("DELETE");

export const assist = (task: AssistTask, text: string, context?: string) =>
  post<{ text: string; model: string }>("/api/atlas/assist", { task, text, context });

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

// Turns a picked file or a voice recording into something Atlas accepts:
// images are resized and stripped of location data first (same as posts).
export async function prepareFile(file: Blob, name: string, hint?: "audio"): Promise<Outgoing> {
  let type = (file.type || "").split(";")[0].toLowerCase();
  // Browsers label .webm/.mp4/.ogg audio files as video by their extension.
  if (hint === "audio" && /^video\/(webm|mp4|ogg)$/.test(type)) type = type.replace("video/", "audio/");
  if (hint === "audio" && !type && /\.(m4a|mp3|wav|ogg|webm|flac|aac)$/i.test(name)) type = `audio/${name.split(".").pop()!.toLowerCase().replace("m4a", "mp4").replace("mp3", "mpeg")}`;
  if ((IMAGE_TYPES as readonly string[]).includes(type)) {
    const small = file instanceof File ? await optimizeImage(file) : file;
    return { kind: "image", mime: small.type || type, data: await toBase64(small), name, preview: URL.createObjectURL(small), bytes: small.size };
  }
  if ((AUDIO_TYPES as readonly string[]).includes(type)) {
    return { kind: "audio", mime: type, data: await toBase64(file.type === type ? file : new Blob([file], { type })), name, bytes: file.size };
  }
  throw new ApiError("INVALID", "Atlas can take photos (JPEG, PNG, WebP) and audio (MP3, M4A, WAV, WebM, Ogg).", 400);
}

export const tooBig = (files: { bytes: number }[]) => files.reduce((n, f) => n + f.bytes, 0) > ATLAS_LIMITS.bytes;

export type StreamEvent =
  | { t: "meta"; model: string; via: "gemini" | "openrouter"; note?: string }
  | { t: "d"; v: string }
  | { t: "done" }
  | { t: "error"; code: string; message: string };

// Sends one turn and calls onEvent as the reply streams in.
export async function chat(
  body: { text: string; model: string; voice?: boolean; attachments: Outgoing[] },
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal,
) {
  let res: Response;
  try {
    res = await fetch("/api/atlas/chat", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, attachments: body.attachments.map(({ kind, mime, data }) => ({ kind, mime, data })) }),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return;
    throw new ApiError("OFFLINE", "You're offline. Atlas needs the internet for this one.", 0);
  }
  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => null);
    throw new ApiError(json?.error?.code ?? "HTTP", json?.error?.message ?? `Atlas couldn't answer (${res.status}).`, res.status);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read().catch((err) => {
      if ((err as Error)?.name === "AbortError") return { done: true, value: undefined };
      throw err;
    });
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
    }
  }
}

// Draft blocks Atlas writes for YORU (```post … ```), split out of a reply so
// the page can show them as cards with their own buttons.
export type Piece = { kind: "text"; text: string } | { kind: "draft"; target: "post" | "bio" | "comment" | "message"; text: string };
export function splitDrafts(reply: string): Piece[] {
  const out: Piece[] = [];
  const re = /```(post|bio|comment|message)\n([\s\S]*?)(?:```|$)/g;
  let at = 0;
  for (let m = re.exec(reply); m; m = re.exec(reply)) {
    if (m.index > at) out.push({ kind: "text", text: reply.slice(at, m.index) });
    out.push({ kind: "draft", target: m[1] as "post" | "bio" | "comment" | "message", text: m[2].trim() });
    at = m.index + m[0].length;
  }
  if (at < reply.length) out.push({ kind: "text", text: reply.slice(at) });
  return out.filter((p) => p.kind === "draft" || p.text.trim());
}

// Text for reading aloud: no markdown symbols, links or code.
export function speakable(reply: string) {
  return reply
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>~|]/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
