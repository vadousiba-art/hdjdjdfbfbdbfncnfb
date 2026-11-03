# YORU Pro billing (PayPal subscriptions)

YORU Pro is sold as a monthly PayPal subscription: plan
`P-3T0538893C7819749NLVFW3Q`, PayPal's own subscribe button on `/pro`.
The button only shows once the server can **confirm** and **renew**
subscriptions. Until both server-only variables below are set, the Pro page
keeps saying purchases aren't open, and nobody can be charged.

## How it works

```
member clicks Subscribe ─▶ PayPal window (price, tax, period shown by PayPal)
        │  custom_id = the member's YORU id
        ▼
onApprove(subscriptionID) ─▶ POST /api/billing/paypal/activate
        server: GET /v1/billing/subscriptions/:id from PayPal
                plan must match, custom_id must be this member, status ACTIVE
        ─▶ billing_paypal_sync (service role only) ─▶ entitlements row
           source 'paypal', external_id = subscription id,
           ends_at = next billing date + 3 days grace

PayPal webhook ─▶ POST /api/billing/paypal/webhook
        signature verified by PayPal (verify-webhook-signature + webhook id)
        the subscription is re-read from PayPal; the event body is never trusted
        event logged once in payment_events (provider + event id unique)
```

| PayPal says | YORU Pro |
|---|---|
| ACTIVE (new or renewed) | on until the next billing date + grace; the end date only moves forward |
| CANCELLED | stays on until the end of the month already paid for, then lapses |
| SUSPENDED, EXPIRED | ends now (comes back if PayPal re-activates it) |
| PAYMENT.SALE.REFUNDED / REVERSED | ends now |
| APPROVAL_PENDING / APPROVED | nothing yet; the ACTIVATED webhook switches Pro on |

What YORU stores: the subscription id, its status and dates in
`entitlements`, and in `payment_events` only the event id, type, resource type,
subscription id and status. Never the payer's name, email or card.

## Files

- `supabase/migrations/0015_paypal.sql`: `billing_paypal_sync`, server only
- `src/lib/billing/paypal.ts`: what each PayPal state means (pure, tested)
- `src/lib/server/paypal.ts`: PayPal REST calls (OAuth, subscription, webhook check)
- `src/app/api/billing/paypal/{route,activate/route,webhook/route}.ts`
- `src/components/pro/PayPalSubscribe.tsx`: the button
- Tests: `tests/unit/paypal.test.ts`, `tests/db/billing.test.ts`

## Switching it on

1. Apply migration 0015 to the production database (additive: one new
   function).
2. In the PayPal Developer Dashboard (Apps & Credentials, **Live**), open the
   app whose client id is in the button and copy its **secret**.
3. In the same app, add a webhook at
   `https://<your site>/api/billing/paypal/webhook` with these events:
   `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.UPDATED`,
   `BILLING.SUBSCRIPTION.RE-ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`,
   `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.EXPIRED`,
   `BILLING.SUBSCRIPTION.PAYMENT.FAILED`, `PAYMENT.SALE.COMPLETED`,
   `PAYMENT.SALE.REFUNDED`, `PAYMENT.SALE.REVERSED`. Copy the **webhook id**.
4. Set these in Vercel (Production), then redeploy:

   | Variable | Value | Secret? |
   |---|---|---|
   | `PAYPAL_CLIENT_SECRET` | the app secret | **yes, server only** |
   | `PAYPAL_WEBHOOK_ID` | the webhook id | server only |
   | `PAYPAL_ENV` | `live` (default) or `sandbox` | no |
   | `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | optional; defaults to the id in the button | public |
   | `PAYPAL_PLAN_ID` | optional; defaults to `P-3T0538893C7819749NLVFW3Q` | public |
   | `PAYPAL_GRACE_DAYS` | optional; default 3 | no |

5. Make sure the PayPal plan's price matches what the Pro page says
   (`pro.price`, currently "CAD $5.99 per month"). PayPal always shows the
   real amount before the member confirms.
6. Test once with a real subscription, cancel it in PayPal, and check that Pro
   shows "until <date>" on `/pro/hub`.

To test without real money: create a sandbox app and a sandbox plan, set
`PAYPAL_ENV=sandbox`, the sandbox client id, plan id, secret and webhook id
on a preview deployment.

## Who can pay

PayPal requires account holders to be adults (the age of majority in their
province in Canada). The PayPal business account that receives the money
must be held by an adult, and members under 18 can't subscribe with their
own PayPal account. See `docs/monetization.md`.
