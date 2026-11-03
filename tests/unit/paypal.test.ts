import { describe, expect, it } from "vitest";
import { proChange, subscriptionOfEvent, type PayPalSubscription } from "@/lib/billing/paypal";

const PLAN = "P-3T0538893C7819749NLVFW3Q";
const USER = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const now = new Date("2026-11-03T12:00:00Z");
const sub = (over: Partial<PayPalSubscription> = {}): PayPalSubscription => ({
  id: "I-ABC123DEF456",
  plan_id: PLAN,
  status: "ACTIVE",
  custom_id: USER,
  billing_info: { next_billing_time: "2026-12-03T10:00:00Z" },
  ...over,
});
const change = (s: PayPalSubscription, eventType?: string) => proChange(s, { planId: PLAN, graceDays: 3, now, eventType });

describe("PayPal subscription → Pro", () => {
  it("an active subscription gives Pro until the next billing date plus grace", () => {
    expect(change(sub())).toEqual({ kind: "active", user: USER, endsAt: new Date("2026-12-06T10:00:00Z") });
  });

  it("covers a moment's gap when PayPal hasn't filled in the next billing date", () => {
    expect(change(sub({ billing_info: {} }))).toEqual({ kind: "active", user: USER, endsAt: new Date("2026-11-07T12:00:00Z") });
  });

  it("cancelled runs out, suspended and expired end now, approved waits", () => {
    expect(change(sub({ status: "CANCELLED" }))).toEqual({ kind: "canceled", user: USER });
    expect(change(sub({ status: "SUSPENDED" }))).toEqual({ kind: "ended", user: USER });
    expect(change(sub({ status: "EXPIRED" }))).toEqual({ kind: "ended", user: USER });
    expect(change(sub({ status: "APPROVED" }))).toEqual({ kind: "pending", user: USER });
  });

  it("a refund or reversal ends Pro even while PayPal still says active", () => {
    expect(change(sub(), "PAYMENT.SALE.REFUNDED")).toEqual({ kind: "ended", user: USER });
    expect(change(sub(), "PAYMENT.SALE.REVERSED")).toEqual({ kind: "ended", user: USER });
    expect(change(sub(), "PAYMENT.SALE.COMPLETED").kind).toBe("active");
  });

  it("ignores other plans, missing members and unknown states", () => {
    expect(change(sub({ plan_id: "P-OTHER" }))).toEqual({ kind: "ignore", reason: "plan" });
    expect(change(sub({ custom_id: undefined }))).toEqual({ kind: "ignore", reason: "member" });
    expect(change(sub({ custom_id: "not-a-uuid" }))).toEqual({ kind: "ignore", reason: "member" });
    expect(change(sub({ status: "WEIRD" }))).toEqual({ kind: "ignore", reason: "status" });
  });

  it("finds the subscription a webhook event is about", () => {
    expect(subscriptionOfEvent({ resource_type: "subscription", resource: { id: "I-ABC123DEF456" } })).toBe("I-ABC123DEF456");
    expect(subscriptionOfEvent({ resource_type: "sale", resource: { id: "SALE1", billing_agreement_id: "I-ABC123DEF456" } })).toBe("I-ABC123DEF456");
    expect(subscriptionOfEvent({ resource_type: "sale", resource: { id: "SALE1" } })).toBeNull();
    expect(subscriptionOfEvent({ resource_type: "subscription", resource: { id: "../etc" } })).toBeNull();
  });
});
