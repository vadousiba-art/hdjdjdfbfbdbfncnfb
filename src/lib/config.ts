// Runtime configuration. Server-only values are never sent to the browser;
// the client only learns the mode and the public Supabase URL/key.

export type AppMode = "supabase" | "demo" | "unconfigured";

export const BOT_ID = "00000000-0000-4000-8000-00000000a1e7";

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const supabaseUrl = () => env("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = () =>
  env("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
export const supabaseServiceKey = () =>
  env("SUPABASE_SERVICE_ROLE_KEY") ?? env("SUPABASE_SECRET_KEY");

export function appMode(): AppMode {
  if (supabaseUrl() && supabaseAnonKey()) return "supabase";
  const demo = env("DEMO_MODE");
  if (demo === "false") return "unconfigured";
  if (demo === "true" || process.env.NODE_ENV !== "production") return "demo";
  return "unconfigured";
}

// Where application data lives. Auth stays with Supabase (or the demo account
// picker) whichever is chosen:
//   supabase  Supabase Postgres through PostgREST (the original setup)
//   postgres  Neon (or any Postgres) through a pooled server-side connection.
//             Opt-in with DATA_BACKEND=neon, so a DATABASE_URL injected by a
//             Vercel integration never switches production by accident.
//   pglite    the embedded demo database
export type DataBackend = "supabase" | "postgres" | "pglite" | "none";

export const databaseUrl = () => env("DATABASE_URL");

export function dataBackend(): DataBackend {
  const mode = appMode();
  if (mode === "unconfigured") return "none";
  const wanted = env("DATA_BACKEND")?.toLowerCase();
  if (wanted === "neon" || wanted === "postgres") return "postgres";
  return mode === "supabase" ? "supabase" : "pglite";
}

// ── Seven Supabase projects ──────────────────────────────────────────────────
// Project 7 is always the ORIGINAL project (NEXT_PUBLIC_SUPABASE_URL): it keeps
// Auth and every relational table. Projects 1-6 (SUPABASE_PROJECT_n_*) add
// capacity for the workloads that can be spread safely:
//   realtime  per-user live-update topics and chat typing (publishable key)
//   storage   new photo/video uploads (needs that project's secret key)
// See docs/seven-projects.md.
export type SupabaseProject = {
  n: number;
  ref: string;
  url: string;
  publishableKey: string;
  secretKey?: string;
  primary: boolean;
  realtime: boolean;
  storage: boolean;
};

const PROJECT_URL = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/;
const refOf = (url?: string) => url?.match(PROJECT_URL)?.[1];

export function supabaseProjects(): SupabaseProject[] {
  const out: SupabaseProject[] = [];
  const primaryRef = refOf(supabaseUrl());
  for (let n = 1; n <= 6; n++) {
    const url = env(`SUPABASE_PROJECT_${n}_URL`);
    const key = env(`SUPABASE_PROJECT_${n}_PUBLISHABLE_KEY`);
    const ref = refOf(url);
    if (!ref || !key || ref === primaryRef || out.some((p) => p.ref === ref)) continue;
    const secretKey = env(`SUPABASE_PROJECT_${n}_SECRET_KEY`);
    out.push({
      n,
      ref,
      url: `https://${ref}.supabase.co`,
      publishableKey: key,
      secretKey,
      primary: false,
      realtime: env(`SUPABASE_PROJECT_${n}_REALTIME`) !== "off",
      storage: Boolean(secretKey) && env(`SUPABASE_PROJECT_${n}_STORAGE`) !== "off",
    });
  }
  if (primaryRef && supabaseAnonKey()) {
    out.push({
      n: 7,
      ref: primaryRef,
      url: `https://${primaryRef}.supabase.co`,
      publishableKey: supabaseAnonKey()!,
      secretKey: supabaseServiceKey(),
      primary: true,
      realtime: env("SUPABASE_PROJECT_7_REALTIME") !== "off",
      storage: true,
    });
  }
  return out;
}

export const primaryProject = () => supabaseProjects().find((p) => p.primary);

// Realtime sharding is opt-in (REALTIME_SHARDS=on) because with Supabase data
// it needs migration 0006 applied to the original project first.
export function realtimeShards(): SupabaseProject[] {
  if (env("REALTIME_SHARDS") !== "on") return [];
  return supabaseProjects().filter((p) => p.realtime);
}

// Projects that receive NEW uploads. Existing files never move. Optional
// STORAGE_UPLOAD_PROJECTS=1,3,7 limits the list (e.g. to skip a full project).
export function uploadProjects(): SupabaseProject[] {
  if (appMode() !== "supabase") return [];
  const only = env("STORAGE_UPLOAD_PROJECTS")
    ?.split(",")
    .map((x) => Number(x.trim()))
    .filter(Boolean);
  return supabaseProjects().filter((p) => p.storage && (!only?.length || only.includes(p.n)));
}

// How the browser receives live updates:
//   sharded           live updates spread over the Supabase projects: each user
//                     listens on one project (REALTIME_SHARDS=on)
//   postgres_changes  Supabase Realtime streams table changes (data on Supabase)
//   broadcast         the server relays changes over Supabase Realtime Broadcast
//                     to private per-user topics (data on Neon, auth on Supabase)
//   sse               /api/live Server-Sent Events (demo login, single server)
export type RealtimeTransport = "sharded" | "postgres_changes" | "broadcast" | "sse";

export function realtimeTransport(): RealtimeTransport {
  if (appMode() !== "unconfigured" && realtimeShards().length) return "sharded";
  if (appMode() !== "supabase") return "sse";
  return dataBackend() === "postgres" ? "broadcast" : "postgres_changes";
}

// Configuration mistakes that stop the selected backend from working. Shown
// on /setup and /api/health (names only, never values).
export function configProblems(): string[] {
  const problems: string[] = [];
  const wanted = env("DATA_BACKEND")?.toLowerCase();
  if (wanted && !["neon", "postgres", "supabase"].includes(wanted)) {
    problems.push(`DATA_BACKEND must be "neon" or "supabase" (got an unknown value).`);
  }
  if (dataBackend() === "postgres") {
    if (!databaseUrl()) problems.push("DATA_BACKEND=neon needs DATABASE_URL (Neon pooled connection string).");
    if (appMode() === "supabase" && !supabaseServiceKey()) {
      problems.push("DATA_BACKEND=neon with Supabase Auth needs SUPABASE_SERVICE_ROLE_KEY (sign-up, media and realtime relay).");
    }
  }
  return problems;
}

// Non-blocking: an extra project with a bad setting is skipped, never allowed
// to take the app down. Shown on /setup and /api/health.
export function configWarnings(): string[] {
  const warnings: string[] = [];
  // The original project must never be replaced by one of the extra projects.
  const p7 = refOf(env("SUPABASE_PROJECT_7_URL"));
  if (env("SUPABASE_PROJECT_7_URL") && p7 !== refOf(supabaseUrl())) {
    warnings.push("SUPABASE_PROJECT_7_URL must be the original project (the same as NEXT_PUBLIC_SUPABASE_URL).");
  }
  const seen = new Map<string, number>();
  for (let n = 1; n <= 6; n++) {
    const raw = env(`SUPABASE_PROJECT_${n}_URL`);
    if (!raw) continue;
    const ref = refOf(raw);
    if (!ref) warnings.push(`SUPABASE_PROJECT_${n}_URL is not a https://<ref>.supabase.co URL.`);
    else if (ref === refOf(supabaseUrl())) warnings.push(`SUPABASE_PROJECT_${n}_URL is the original project; projects 1-6 must be the extra ones.`);
    else if (seen.has(ref)) warnings.push(`SUPABASE_PROJECT_${n}_URL repeats project ${seen.get(ref)}.`);
    else seen.set(ref, n);
    if (!env(`SUPABASE_PROJECT_${n}_PUBLISHABLE_KEY`)) warnings.push(`SUPABASE_PROJECT_${n}_PUBLISHABLE_KEY is missing (project ${n} is skipped).`);
  }
  if (env("REALTIME_SHARDS") === "on" && !supabaseProjects().some((p) => p.realtime)) {
    warnings.push("REALTIME_SHARDS=on but no Supabase project is configured for realtime.");
  }
  return warnings;
}

export const aiConfig = () => ({
  apiKey: env("ANTHROPIC_API_KEY"),
  model: env("ANTHROPIC_MODEL") ?? "claude-opus-5-5",
  dailyLimit: Number(env("AI_DAILY_LIMIT_PER_USER") ?? 40),
  burstLimit: Number(env("AI_BURST_LIMIT_PER_MINUTE") ?? 6),
});

// Atlas (Jesse's assistant, /atlas). Keys are server-only. Gemini handles voice,
// audio and images; OpenRouter offers the free text models. Models are
// configurable because providers retire them (gemini-2.5-flash is already
// closed to new keys).
const list = (v: string | undefined, fallback: string[]) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : fallback);
export const atlasConfig = () => ({
  geminiKey: env("GEMINI_API_KEY"),
  // First model is the default; the rest are tried, in order, only when one is
  // overloaded or rate-limited, and the reply says which model answered.
  geminiModels: list(env("GEMINI_MODEL"), ["gemini-3.5-flash", "gemini-flash-lite-latest"]),
  openrouterKey: env("OPENROUTER_API_KEY"),
  perMinute: Number(env("ATLAS_LIMIT_PER_MINUTE") ?? 8),
  perDay: Number(env("ATLAS_LIMIT_PER_DAY") ?? 100),
});

// Push notifications (Web Push / VAPID). The public key goes to browsers; the
// private key signs pushes and is server-only. Generate a pair once with
// `npx web-push generate-vapid-keys`.
export const pushConfig = () => ({
  publicKey: env("VAPID_PUBLIC_KEY"),
  privateKey: env("VAPID_PRIVATE_KEY"),
  // Who push services can contact about our pushes: a mailto: or the site.
  subject: env("VAPID_SUBJECT") ?? (env("SUPPORT_EMAIL") ? `mailto:${env("SUPPORT_EMAIL")}` : env("NEXT_PUBLIC_SITE_URL") ?? "https://yoru-social.vercel.app"),
});

// Android app notifications through Firebase Cloud Messaging (instant). The
// service account JSON (or its base64) from Firebase → Project settings →
// Service accounts. Server-only. Without it the app checks for notifications
// in the background instead (every ~15 minutes).
export function firebaseAccount(): { project_id: string; client_email: string; private_key: string } | null {
  const raw = env("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) return null;
  try {
    const json = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
    return json.project_id && json.client_email && json.private_key ? json : null;
  } catch {
    return null;
  }
}

// What the Android app needs to start Firebase (all public client values from
// the Firebase console's Android app settings). Sent to the app at runtime so
// instant notifications can be turned on without a new APK.
export function firebaseClient(): { projectId: string; appId: string; apiKey: string; senderId: string } | null {
  const sa = firebaseAccount();
  const appId = env("FIREBASE_ANDROID_APP_ID");
  const apiKey = env("FIREBASE_API_KEY");
  if (!sa || !appId || !apiKey) return null;
  const senderId = env("FIREBASE_SENDER_ID") ?? appId.split(":")[1] ?? "";
  return senderId ? { projectId: sa.project_id, appId, apiKey, senderId } : null;
}

export const uploadConfig = {
  maxImageBytes: 10 * 1024 * 1024,
  maxVideoBytes: 50 * 1024 * 1024,
  imageTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  videoTypes: ["video/mp4", "video/webm", "video/quicktime"],
  perHour: 30,
};

export const demoDataDir = () => env("DEMO_DATA_DIR") ?? ".data";
