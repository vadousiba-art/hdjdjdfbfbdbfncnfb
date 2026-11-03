import { NextRequest, NextResponse } from "next/server";
import { paypalConfig } from "@/lib/config";
import { subscriptionOfEvent } from "@/lib/billing/paypal";
import { errorResponse, toAppError } from "@/lib/server/errors";
import { syncSubscription, verifyWebhook } from "@/lib/server/paypal";

// PayPal webhook (Developer Dashboard → your app → Webhooks), subscribed to:
//   BILLING.SUBSCRIPTION.ACTIVATED, .UPDATED, .RE-ACTIVATED, .CANCELLED,
//   .SUSPENDED, .EXPIRED, .PAYMENT.FAILED and PAYMENT.SALE.COMPLETED,
//   .REFUNDED, .REVERSED
// The signature is checked with PayPal first. The event only says which
// subscription changed: its state is read back from PayPal, so a forged or
// replayed event can't grant anything.

export async function POST(req: NextRequest) {
  try {
    if (!paypalConfig().enabled) return NextResponse.json({ error: { code: "NOT_CONFIGURED", message: "PayPal billing isn't set up." } }, { status: 503 });
    const raw = await req.text();
    if (raw.length > 200_000) return NextResponse.json({ error: { code: "INVALID", message: "Too large." } }, { status: 413 });
    let event: { id?: string; event_type?: string; resource_type?: string; resource?: Record<string, unknown> };
    try {
      event = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: { code: "INVALID", message: "Not JSON." } }, { status: 400 });
    }
    if (!(await verifyWebhook(req.headers, raw))) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "Signature check failed." } }, { status: 401 });
    }
    const subscription = subscriptionOfEvent(event);
    if (!subscription || typeof event.id !== "string") return NextResponse.json({ data: { ignored: true } });
    const type = String(event.event_type ?? "");
    // Kept in payment_events: what happened, never the payer's details.
    const summary = { event_type: type, resource_type: event.resource_type ?? null, subscription, status: event.resource?.status ?? null };
    const out = await syncSubscription(subscription, { event: { id: event.id, type, summary } });
    return NextResponse.json({ data: out });
  } catch (err) {
    // An event we can never apply (unknown subscription or member) is
    // acknowledged so PayPal stops sending it. Anything else answers non-2xx and
    // PayPal retries later, which is what we want while PayPal or the database
    // is unreachable.
    const e = toAppError(err);
    if (["NOT_FOUND", "INVALID", "FORBIDDEN"].includes(e.code)) {
      console.warn("[yoru] PayPal event not applied:", e.code);
      return NextResponse.json({ data: { ignored: true } });
    }
    return errorResponse(e);
  }
}
