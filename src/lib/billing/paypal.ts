// What a PayPal subscription means for YORU Pro. Pure (no network, no
// database) so the rules can be tested on their own; src/lib/server/paypal.ts
// reads the subscription from PayPal and src/app/api/billing applies this.

// The parts of PayPal's subscription object (GET /v1/billing/subscriptions/:id) we use.
export type PayPalSubscription = {
  id: string;
  plan_id?: string;
  status?: string; // APPROVAL_PENDING | APPROVED | ACTIVE | SUSPENDED | CANCELLED | EXPIRED
  custom_id?: string; // the YORU member id, set when the subscription is created
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { time?: string };
  };
};

export type ProChange =
  | { kind: "active"; user: string; endsAt: Date } // renew Pro until endsAt
  | { kind: "canceled"; user: string } // no more renewals: Pro runs to the end of the paid period
  | { kind: "ended"; user: string } // suspended, expired or refunded: Pro ends now
  | { kind: "pending"; user: string } // approved but PayPal hasn't activated it yet
  | { kind: "ignore"; reason: "plan" | "member" | "status" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SUBSCRIPTION_ID = /^I-[A-Z0-9]{6,40}$/;
const DAY = 86_400_000;

// Events that take back a payment: Pro ends even though PayPal may still list
// the subscription as active.
export const REVERSAL_EVENTS = new Set(["PAYMENT.SALE.REFUNDED", "PAYMENT.SALE.REVERSED"]);

export function proChange(sub: PayPalSubscription, opts: { planId: string; graceDays: number; now?: Date; eventType?: string }): ProChange {
  const now = opts.now ?? new Date();
  if (sub.plan_id !== opts.planId) return { kind: "ignore", reason: "plan" };
  const user = sub.custom_id?.trim() ?? "";
  if (!UUID.test(user)) return { kind: "ignore", reason: "member" };
  if (opts.eventType && REVERSAL_EVENTS.has(opts.eventType)) return { kind: "ended", user };
  switch (sub.status) {
    case "ACTIVE": {
      // Paid up to the next billing date. Right after sign-up PayPal can be a
      // moment late filling that in: give a day, the payment webhook extends it.
      const next = Date.parse(sub.billing_info?.next_billing_time ?? "");
      const base = Number.isFinite(next) && next > now.getTime() ? next : now.getTime() + DAY;
      return { kind: "active", user, endsAt: new Date(base + opts.graceDays * DAY) };
    }
    case "CANCELLED":
      return { kind: "canceled", user };
    case "SUSPENDED":
    case "EXPIRED":
      return { kind: "ended", user };
    case "APPROVAL_PENDING":
    case "APPROVED":
      return { kind: "pending", user };
    default:
      return { kind: "ignore", reason: "status" };
  }
}

// The subscription a webhook event is about: subscription events carry the
// subscription itself, payment (sale) events name it as the billing agreement.
export function subscriptionOfEvent(event: { resource_type?: string; resource?: Record<string, unknown> }): string | null {
  const r = event.resource ?? {};
  const id = event.resource_type === "subscription" ? r.id : r.billing_agreement_id;
  return typeof id === "string" && SUBSCRIPTION_ID.test(id) ? id : null;
}
