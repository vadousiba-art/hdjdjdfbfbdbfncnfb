# Monetization: research, recommendation, architecture

**Update (2026-11-05): Pro is paid by Interac e-Transfer only.** CAD $5.99
buys one month per payment and nothing renews; donations go the same way.
The owner confirms each payment in Watchtower → Payments. See
[etransfer.md](etransfer.md). The PayPal checkout that was built on
2026-11-03 was removed before it ever went live. The research below is
kept for reference.

Research checked on 2026-10-27 against each provider's own pages (links
below). Fees and terms change; re-check before signing up. This is not
legal or tax advice.

## The age question comes first

The founders are 17 and in Canada. No account may be opened by
misstating anyone's age or identity.

| Provider | Who may hold the account | Source |
|---|---|---|
| **Stripe** | 13+ may create an account, but if under 18 "a legal guardian must assume the role of owner of your account before your account can accept charges". The guardian agrees to the terms and may be asked for ID. | [Stripe: age requirement](https://support.stripe.com/questions/age-requirement-to-create-a-stripe-account) |
| **PayPal (Canada)** | Individuals must be Canadian residents and at least 18 or the age of majority in their province (19 in several provinces). | [PayPal Canada User Agreement](https://www.paypal.com/ca/legalhub/useragreement-full) (eligibility section; the page did not load in full for us, so confirm the wording) |
| **Paddle** | The seller agreement sets no explicit age, but the seller represents it has "the necessary right, power and authority to enter into this Agreement" (cl. 11.1). Minors' contracts are generally voidable in Canada, so expect an adult or a company to be the seller. | [Paddle terms](https://www.paddle.com/legal/terms), updated 6 Oct 2026 |
| **Lemon Squeezy** (Stripe-owned) | No explicit age; same "right, power and authority" representation (s. 9.1); stores pass KYC/KYB review. | [Lemon Squeezy terms](https://www.lemonsqueezy.com/terms) |

**What this means in practice:** the realistic legal path before the
founders turn 18 is a parent or guardian as the account owner (Stripe
supports this directly), or a company whose director is an adult. Either
way that adult is legally responsible for the account. Talk to a parent or
guardian and, ideally, an accountant before opening anything.

## Fees

| | Stripe (Checkout + Billing) | Paddle | Lemon Squeezy | PayPal |
|---|---|---|---|---|
| Card fee | 2.9% + CA$0.30 (domestic); +0.8% international cards; +2% if currency conversion ([pricing](https://stripe.com/en-ca/pricing)) | 5% + 50¢, all-in ([pricing](https://www.paddle.com/pricing)) | 5% + 50¢; +1.5% buyers outside the US; +0.5% subscriptions; +1.5% PayPal ([fees](https://docs.lemonsqueezy.com/help/getting-started/fees)) | not researched in depth |
| Subscriptions | Billing: +0.7% of billing volume ([Billing pricing](https://stripe.com/en-ca/billing/pricing)) | included | +0.5% | |
| Sales tax / VAT | **You** register and file (Stripe Tax can calculate) | handled (merchant of record) | handled (merchant of record) | you |
| Payout | to a Canadian bank account | monthly | 1% per payout to non-US banks | |

**What US$5.99/month nets per member (one card payment, before income tax):**

- Stripe, a Canadian card, with no conversion: 5.99 − (2.9% + ~US$0.22) − 0.7% ≈ **US$5.55**. A US card adds 0.8%. Charging in USD to a CAD account adds 2% conversion. Sales tax collection is on you.
- Paddle: 5.99 − (5% + 0.50) ≈ **US$5.19**, with tax handled. Paddle's FAQ says products under $10 can ask for custom pricing.
- Lemon Squeezy, a buyer outside the US, subscription: 5.99 − (7% + 0.50) ≈ **US$5.07**, minus a 1% payout fee, with tax handled.

## Recommendation

1. **Don't charge yet.** With about 12 early members, Pro revenue would be
   a few dollars a month, and the compliance work is real. Keep testing Pro
   with admin grants (already built) and ask members whether they'd pay.
2. **When ready: Paddle or Lemon Squeezy (merchant of record)** for Pro. They
   collect and file sales tax/VAT/GST everywhere, which a two-person team
   should not do by hand. The cost is about 0.4 to 0.5 USD more per
   subscription than Stripe. Owner: a parent/guardian or an adult-directed
   company, as above.
3. **Stripe** is the better choice once there's an accountant and real
   volume, or for creator tips (Stripe Connect), which merchants of record
   generally don't support for paying out to other people.
4. In Canada, GST/HST registration is generally required once taxable
   sales pass CA$30,000 in four consecutive quarters (small-supplier rule).
   Selling to other countries can trigger their digital-services taxes
   earlier, which is the main reason to prefer a merchant of record. Confirm
   with an accountant.

## Architecture (built)

```
provider checkout ──► webhook (/api/billing/webhook, NOT BUILT)
                          │ verify signature with the provider secret (server only)
                          ▼
                   payment_events  (unique provider + event_id → a duplicate delivery is a no-op)
                          │
                          ▼
                   entitlements    (user_id, product 'pro', source, starts_at, ends_at)
                          │
                          ▼
                   is_pro(user)    ← every Pro check in SQL uses this
```

- `entitlements` and `payment_events` (migration 0007) have RLS on. Members
  can read only their own entitlement, and nothing is writable from the
  browser.
- Today the only entitlement source is `comp`: admin grants, 1–366 days,
  audited (`admin_grant_pro`, `admin_revoke_pro`).
- Pro-only items are checked in the database, not the UI:
  `update_my_identity` refuses Pro banners and frames, `save_theme` allows 12
  slots only with Pro, and the streak shield in `daily_checkin` needs Pro.
- When Pro ends, `get_my_identity` and profile views fall back to the free
  banner and frame. Nothing is deleted.

### To switch on purchases (needs founder approval)

1. Pick the provider and account owner (see above). Create the product
   "YORU Pro, monthly, US$5.99".
2. Add `BILLING_PROVIDER`, the webhook signing secret and the API key as
   Vercel environment variables (server only, never `NEXT_PUBLIC_`).
3. Build `/api/billing/webhook`: verify the signature, insert into
   `payment_events` (`on conflict do nothing`; stop if it already existed),
   then upsert `entitlements` with `source = provider`, `ends_at` = period
   end + 3 days of grace. Handle the created, renewed, cancelled (keep until
   period end) and refunded/charged-back (end now) events.
4. Build `/api/billing/checkout`: server creates the checkout session for
   the signed-in user (`client_reference_id` = user id). Never trust a price
   from the browser.
5. Enable the Pro button only when `BILLING_PROVIDER` is set. Update the
   Terms (renewal, cancellation, refunds) and Privacy (the processor
   receives name, email and payment details).
6. Test in the provider's test mode end to end, including duplicate and
   out-of-order webhooks, before taking a real payment.

## Creator tips (architecture only; not built)

- **Provider:** Stripe Connect. The platform takes an application fee (5–10%)
  on each tip and the creator receives the rest. Stripe's page says Express
  and Custom accounts can be opened from 13 with a guardian. We recommend
  tips for **18+ verified creators only** at first, because paying minors
  raises consent and safety questions beyond what a payment provider checks.
- **Data:** `tips (id, from_user, to_user, post_id null, amount_cents,
  currency, fee_cents, provider_ref unique, status, created_at)`. It is
  written only by the webhook; the browser can't create a tip row.
- **Rules:** CA$1–100 per tip; tips to blocked or banned users refused; daily
  limit per sender; tipping never grants XP or ranking (keeps XP free of
  money). Refunds and chargebacks reverse the tip and are shown to the creator.
- **Disclosure:** show the fee percentage before paying.

## Premium rooms (not started)

Idea: chat channels where Pro (or a creator's supporters) can post, while
everyone can read. Requires channel-level `requires_entitlement` and a
check in `send_message`. Do not put existing community spaces behind a
paywall; the social core stays free (the Pro page promises this).
