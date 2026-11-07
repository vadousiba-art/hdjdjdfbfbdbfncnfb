import "server-only";
import crypto from "node:crypto";
import webpush from "web-push";
import { waitUntil } from "@vercel/functions";
import { firebaseAccount, pushConfig } from "@/lib/config";
import { wordPush, type PushItem, type PushPayload } from "@/lib/push";
import { serviceRpc } from "./db";

// Sends queued notifications to members' devices: browsers and the installed
// web app through Web Push (encrypted per device, signed with YORU's VAPID
// key), the Android app through Firebase Cloud Messaging when it's set up.
// Runs in the background after a request that may have created
// notifications, one pass at a time per server instance.

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://yoru-social.vercel.app";
let vapidSet = false;

function webPushReady() {
  const cfg = pushConfig();
  if (!cfg.publicKey || !cfg.privateKey) return false;
  if (!vapidSet) {
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
    vapidSet = true;
  }
  return true;
}
export const pushReady = () => webPushReady() || Boolean(firebaseAccount());
export const webPushEnabled = webPushReady;

type Device = { kind?: "webpush" | "fcm"; endpoint: string; p256dh?: string | null; auth?: string | null };
type Claimed = PushItem & { devices: Device[] };

// Pushes wait 30 seconds after the notification (migration 0017), and one you
// read in the app meanwhile is never sent. After a write, the request stays
// open in the background until what it queued is due, sends it, and stops:
// at most WAIT_BUDGET_MS, inside the function's 60-second limit. Several
// requests draining at once is safe: each queued push is claimed exactly once.
const WAIT_BUDGET_MS = 45_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// When this server's background drain will stop (0 = none running).
const g = globalThis as unknown as { __yoruPushUntil?: number };

// Writes that never create a notification, so they never need a drain.
const QUIET = new Set([
  "get_for_you", "mark_not_interested", "undo_not_interested", "touch_presence", "mark_channel_read",
  "mark_notifications_read", "set_notification_prefs", "unfollow_user", "push_subscribe", "push_unsubscribe",
]);
export const mayNotify = (fn: string) => !QUIET.has(fn);

export function schedulePush() {
  if (!pushReady()) return;
  // A drain already running here outlives anything this request queued (due in 30 s).
  if ((g.__yoruPushUntil ?? 0) > Date.now() + 31_000) return;
  const job = drainUntilQuiet().catch((err) => console.warn("[yoru] push send failed:", (err as Error).message));
  try {
    waitUntil(job);
  } catch {
    /* outside a request the promise simply runs */
  }
}

async function drainUntilQuiet() {
  const end = Date.now() + WAIT_BUDGET_MS;
  g.__yoruPushUntil = Math.max(g.__yoruPushUntil ?? 0, end);
  try {
    for (;;) {
      await sendQueued();
      const next = await serviceRpc<number | null>("push_next_due", {});
      if (next == null) return;
      const wait = Math.ceil(next * 1000) + 250;
      if (Date.now() + wait > end) return; // a later request picks it up
      await sleep(wait);
    }
  } finally {
    if (g.__yoruPushUntil === end) g.__yoruPushUntil = 0;
  }
}

export async function sendQueued(): Promise<{ sent: number; gone: number; failed: number }> {
  const total = { sent: 0, gone: 0, failed: 0 };
  if (!pushReady()) return total;
  for (let round = 0; round < 5; round++) {
    const items = await serviceRpc<Claimed[]>("push_claim", { p_limit: 100 });
    if (!items?.length) break;
    const r = await deliver(items.flatMap((n) => n.devices.map((d) => ({ device: d, payload: wordPush(n, SITE), urgent: n.kind === "message" }))));
    total.sent += r.ok.length;
    total.gone += r.gone.length;
    total.failed += r.failed.length;
    if (items.length < 100) break;
  }
  return total;
}

type Job = { device: Device; payload: PushPayload; urgent?: boolean };
type Outcome = "ok" | "gone" | "failed";

export async function deliver(jobs: Job[]) {
  const ok: string[] = [];
  const gone: string[] = [];
  const failed: string[] = [];
  // A handful at a time keeps memory and sockets low on small servers.
  for (let i = 0; i < jobs.length; i += 20) {
    await Promise.all(jobs.slice(i, i + 20).map(async (job) => {
      const r = job.device.kind === "fcm" ? await sendFcm(job) : await sendWebPush(job);
      (r === "ok" ? ok : r === "gone" ? gone : failed).push(job.device.endpoint);
    }));
  }
  if (ok.length || gone.length || failed.length) {
    await serviceRpc("push_report", { p_ok: ok, p_gone: gone, p_failed: failed }).catch(() => null);
  }
  return { ok, gone, failed };
}

async function sendWebPush({ device, payload, urgent }: Job): Promise<Outcome> {
  if (!webPushReady() || !device.p256dh || !device.auth) return "failed";
  try {
    await webpush.sendNotification(
      { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24, urgency: urgent ? "high" : "normal", topic: topic(payload.tag), timeout: 10_000 },
    );
    return "ok";
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.warn("[yoru] push to", new URL(device.endpoint).host, "failed:", status ?? (err as Error).message);
    return "failed";
  }
}

// ---------------------------------------------------------------- Firebase (Android app)

let fcmAuth: { token: string; exp: number } | null = null;
let fcmSigningIn: Promise<{ token: string; project: string } | null> | null = null;

// One sign-in shared by every send in a batch; the token lasts an hour.
function fcmAccessToken() {
  const sa = firebaseAccount();
  if (!sa) return Promise.resolve(null);
  if (fcmAuth && fcmAuth.exp > Date.now() + 60_000) return Promise.resolve({ token: fcmAuth.token, project: sa.project_id });
  fcmSigningIn ??= fcmSignIn(sa).finally(() => { fcmSigningIn = null; });
  return fcmSigningIn;
}

async function fcmSignIn(sa: NonNullable<ReturnType<typeof firebaseAccount>>) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key).toString("base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.warn("[yoru] Firebase sign-in failed:", res.status);
    return null;
  }
  const j = (await res.json()) as { access_token: string; expires_in: number };
  fcmAuth = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return { token: j.access_token, project: sa.project_id };
}

// Shown by Android itself in the notification shade (even if the app was
// swiped away); tapping opens the app on `url`.
async function sendFcm({ device, payload, urgent }: Job): Promise<Outcome> {
  const auth = await fcmAccessToken().catch(() => null);
  if (!auth) return "failed";
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${auth.project}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token: device.endpoint,
        notification: { title: payload.title, body: payload.body },
        data: { url: payload.url, tag: payload.tag, unread: String(payload.unread) },
        android: {
          priority: urgent ? "HIGH" : "NORMAL",
          ttl: "86400s",
          collapse_key: topic(payload.tag),
          notification: {
            tag: payload.tag,
            channel_id: urgent ? "yoru_messages" : "yoru_activity",
            icon: "ic_stat_yoru",
            color: "#F20D2F",
            notification_count: payload.unread || undefined,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res) return "failed";
  if (res.ok) return "ok";
  const err = (await res.json().catch(() => null)) as { error?: { status?: string; details?: { errorCode?: string }[] } } | null;
  const code = err?.error?.details?.find((d) => d.errorCode)?.errorCode ?? err?.error?.status;
  if (res.status === 404 || code === "UNREGISTERED" || code === "INVALID_ARGUMENT" || code === "SENDER_ID_MISMATCH") return "gone";
  console.warn("[yoru] Firebase push failed:", res.status, code);
  return "failed";
}

// Push services accept a topic of up to 32 URL-safe characters; pushes with
// the same topic replace each other while waiting for an offline device.
function topic(tag: string) {
  return tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) || undefined;
}
