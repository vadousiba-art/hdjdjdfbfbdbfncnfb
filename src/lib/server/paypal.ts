import "server-only";
import { paypalConfig } from "@/lib/config";
import { proChange, type PayPalSubscription, type ProChange } from "@/lib/billing/paypal";
import { serviceRpc } from "./db";
import { AppError } from "./errors";

// PayPal's REST API, server side only. The client secret never leaves the
// server and is never logged.

let cached: { token: string; until: number; key: string } | null = null;

function configured() {
  const c = paypalConfig();
  if (!c.enabled || !c.secret) throw new AppError("NOT_CONFIGURED", "PayPal billing isn't set up on this server yet.", 503);
  return c;
}

async function accessToken(): Promise<string> {
  const c = configured();
  const key = `${c.api}|${c.clientId}`;
  if (cached && cached.key === key && cached.until > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${c.api}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!res.ok || !json?.access_token) {
    console.error("[yoru] PayPal sign-in failed:", res.status);
    throw new AppError("NOT_CONFIGURED", "YORU couldn't reach PayPal. Please try again in a moment.", 503);
  }
  cached = { token: json.access_token, until: Date.now() + (json.expires_in ?? 300) * 1000, key };
  return json.access_token;
}

async function paypal<T>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T | null }> {
  const c = configured();
  const res = await fetch(`${c.api}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  return { status: res.status, data: (await res.json().catch(() => null)) as T | null };
}

export async function getSubscription(id: string): Promise<PayPalSubscription | null> {
  const { status, data } = await paypal<PayPalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);
  if (status === 404) return null;
  if (status !== 200 || !data) {
    console.error("[yoru] PayPal subscription lookup failed:", status);
    throw new AppError("NOT_CONFIGURED", "YORU couldn't reach PayPal. Please try again in a moment.", 503);
  }
  return data;
}

// PayPal signs every webhook; PayPal itself checks the signature against the
// webhook id. The event goes back exactly as received (re-encoding the JSON
// can change it and fail the check).
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const c = configured();
  const h = (name: string) => headers.get(name) ?? "";
  if (!h("paypal-transmission-id") || !h("paypal-transmission-sig")) return false;
  const meta = JSON.stringify({
    auth_algo: h("paypal-auth-algo"),
    cert_url: h("paypal-cert-url"),
    transmission_id: h("paypal-transmission-id"),
    transmission_sig: h("paypal-transmission-sig"),
    transmission_time: h("paypal-transmission-time"),
    webhook_id: c.webhookId,
  });
  const body = `${meta.slice(0, -1)},"webhook_event":${rawBody}}`;
  const { status, data } = await paypal<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", { method: "POST", body });
  return status === 200 && data?.verification_status === "SUCCESS";
}

export type SyncResult = { change: ProChange["kind"]; pro: boolean; until: string | null };

// Read the subscription from PayPal and bring the member's Pro in line with it.
// `member` is set when a signed-in member asks (the subscription must be theirs).
export async function syncSubscription(
  id: string,
  opts: { member?: string; event?: { id: string; type: string; summary: Record<string, unknown> } } = {},
): Promise<SyncResult> {
  const c = configured();
  const sub = await getSubscription(id);
  if (!sub) throw new AppError("NOT_FOUND", "PayPal doesn't know that subscription.", 404);
  const change = proChange(sub, { planId: c.planId, graceDays: c.graceDays, eventType: opts.event?.type });
  if (change.kind === "ignore") {
    if (opts.member) {
      throw new AppError("INVALID", change.reason === "plan" ? "That subscription isn't for YORU Pro." : "That subscription can't be used here.", 400);
    }
    return { change: "ignore", pro: false, until: null };
  }
  if (opts.member && change.user !== opts.member) {
    throw new AppError("FORBIDDEN", "That subscription belongs to another account.", 403);
  }
  if (change.kind === "pending" && !opts.event) return { change: "pending", pro: false, until: null };
  const out = await serviceRpc<{ known: boolean; pro: boolean; until: string | null }>("billing_paypal_sync", {
    p_user: change.user,
    p_subscription: sub.id,
    p_active: change.kind === "active",
    p_ends_at: change.kind === "active" ? change.endsAt.toISOString() : change.kind === "ended" ? new Date().toISOString() : null,
    p_event_id: opts.event?.id ?? null,
    p_event_type: opts.event?.type ?? null,
    p_payload: opts.event?.summary ?? null,
  });
  return { change: change.kind, pro: out.pro, until: out.until };
}
