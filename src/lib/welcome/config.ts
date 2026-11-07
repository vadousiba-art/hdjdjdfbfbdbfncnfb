import { z } from "zod";
import cues from "./cues.json";

// The welcome film ("Enter the Night") and its short update cut. One versioned
// config drives the player, the captions and the show-once policy, so a future
// release only needs new files and a new version here. See docs/welcome.md.
//
// Rules this config must keep:
// - Only released features are shown as working; YORU Pro stays "in
//   development" until purchases actually open.
// - A missing or invalid config never blocks anyone: the app just doesn't
//   offer the film (validated below; `WELCOME` is null when invalid).

const VERSION_RE = /^[0-9]{1,4}(\.[0-9]{1,3})?$/;

// Each size comes as WebM (VP9 + Opus: Chrome, Firefox, Edge, Android) and MP4
// (H.264 + AAC: Safari and iOS); the browser picks the first it can play.
const Source = z.object({ webm: z.string().startsWith("/"), mp4: z.string().startsWith("/"), height: z.number().int().positive() });
const Cut = z.object({
  duration: z.number().positive().max(300),
  landscape: z.array(Source).min(1),
  portrait: z.array(Source).min(1),
  poster: z.object({ landscape: z.string().startsWith("/"), portrait: z.string().startsWith("/") }),
  captions: z.array(
    z.object({ start: z.number().min(0), end: z.number().positive(), key: z.string().startsWith("intro."), lines: z.array(z.string()).min(1) }),
  ),
});
const Config = z.object({
  version: z.string().regex(VERSION_RE),
  autoShow: z.boolean(),
  full: Cut,
  short: Cut,
  upcoming: z.array(z.object({ key: z.string(), status: z.literal("in_development") })),
});
export type WelcomeConfig = z.infer<typeof Config>;
export type WelcomeCut = "full" | "short";

const base = (v: string) => `/welcome/v${v}`;
const v = cues.version;
const files = (cut: WelcomeCut) => ({
  landscape: [{ webm: `${base(v)}/${cut}-land.webm`, mp4: `${base(v)}/${cut}-land.mp4`, height: 1080 }],
  portrait: [{ webm: `${base(v)}/${cut}-port.webm`, mp4: `${base(v)}/${cut}-port.mp4`, height: 1920 }],
  poster: { landscape: `${base(v)}/poster-land.jpg`, portrait: `${base(v)}/poster-port.jpg` },
});

const parsed = Config.safeParse({
  version: v,
  autoShow: true,
  full: { duration: cues.cuts.full.duration, captions: cues.cuts.full.captions, ...files("full") },
  short: { duration: cues.cuts.short.duration, captions: cues.cuts.short.captions, ...files("short") },
  upcoming: [{ key: "pro", status: "in_development" }],
});
if (!parsed.success && process.env.NODE_ENV !== "production") console.warn("[yoru] welcome config invalid", parsed.error);
export const WELCOME: WelcomeConfig | null = parsed.success ? parsed.data : null;

// Who sees what, once per welcome version:
// - a new account (under 72 hours old) that has never seen it: the full film;
// - everyone else who hasn't seen this version: the short update;
// - anyone who has seen this version: nothing (it stays in the menu).
export const NEW_ACCOUNT_HOURS = 72;
export type WelcomeState = { seen: string | null; account_age_hours: number };
export function chooseWelcome(state: WelcomeState | null, version: string | undefined): WelcomeCut | null {
  if (!state || !version) return null;
  if (state.seen === version) return null;
  if (state.seen == null && state.account_age_hours < NEW_ACCOUNT_HOURS) return "full";
  return "short";
}

// Portrait files for tall screens. More sizes can be listed per orientation;
// the smallest is used on data saver, slow connections or small screens (and
// the player then waits for a tap instead of loading the film by itself).
export function pickSource(cut: WelcomeConfig["full"], env: { width: number; height: number; dpr: number; saveData: boolean; slow: boolean }) {
  const portrait = env.height > env.width;
  const list = portrait ? cut.portrait : cut.landscape;
  const needed = Math.max(env.width, env.height) * env.dpr;
  const small = env.saveData || env.slow || needed < 1400;
  const sorted = [...list].sort((a, b) => b.height - a.height);
  const pick = small ? sorted[sorted.length - 1] : sorted[0];
  return { webm: pick.webm, mp4: pick.mp4, poster: portrait ? cut.poster.portrait : cut.poster.landscape, portrait };
}

export const welcomeSeenKey = (userId: string) => `yoru-welcome-seen:${userId}`;
