# Gatekeeper: security review for Open Gates (2.0)

Reviewed 2026-10-27 by reading the code and migrations, plus the automated
tests listed in [open-gates.md](open-gates.md). This is a self-review, not
an external audit or penetration test. No certifications are claimed.

## How access control works (unchanged, confirmed)

- The browser never talks to the database directly for app data. Every call
  goes through `/api/rpc/[fn]`, which accepts only functions on an
  allow-list (`src/lib/server/rpc-registry.ts`), validates every argument
  with zod, and runs the call as the signed-in member.
- Every table has row-level security (RLS). App roles have no
  INSERT/UPDATE/DELETE on any table; all writes go through
  `security definer` functions with a fixed `search_path`, which check the
  caller (`require_member` / `require_admin`) and apply rate limits.
- Admin actions are checked again inside the database and written to
  `audit_log`.
- Server secrets (service-role/secret keys, AI keys, shard secrets) are
  read only in `server-only` modules. The browser gets only
  `NEXT_PUBLIC_SUPABASE_URL` and the publishable/anon key, which RLS limits.
- `npm audit --omit=dev`: 0 vulnerabilities.

## What Open Gates added, and how it is protected

| Area | Protection | Tested |
|---|---|---|
| 6 new tables (entitlements, payment_events, collections, collection_items, saved_themes, creator_applications) | RLS on; select policies only (own rows, or members-only collections); no write grants | Yes: direct INSERT as a member is refused (`permission denied`); other members' entitlements and private collections read as empty |
| Pro-only features | Checked in SQL via `is_pro()`, not in the UI: Pro banners/frames refused, 12 theme slots, streak shield. Pro cosmetics fall back to free versions when Pro ends | Yes |
| Pro grants | Admin only, 1–366 days, audited; no payment code exists | Yes |
| Payment webhooks (future) | `payment_events` unique `(provider, event_id)` makes duplicate deliveries a no-op | Schema only (no endpoint yet) |
| Ghost Mode | `last_seen_at` is not written while on and is cleared when turned on, so it can't leak from the database, logs or admin views | Yes (SQL + e2e) |
| Discover | Only `discoverable` members; blocked (either direction), banned and bot accounts excluded; paging capped (50 per page, offset ≤ 2000) | Yes |
| Creator applications | `https://` links only (zod + table `check`), 20–600 chars, one pending at a time, 3/day; admin links open with `noopener noreferrer nofollow` | Yes |
| Reports | Category list enforced; auto-escalation (3 distinct reporters or "at risk of harm"); 20 reports/day per member | Yes |
| Identity updates | Only allow-listed keys accepted; interests limited to 8 known keys; showcase badges must be ones you earned | Yes |
| Rate limits | identity 60/h, collections 60/h, collection items 300/h, themes 60/h, creator applications 3/day | Code review |
| Migration 0007 | Additive only; safe to run twice (verified on real Postgres) | Yes |

## Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Small JPEG photos (under 600 KB, or ones that didn't shrink) were uploaded with their EXIF metadata, which can include the GPS location where the photo was taken. | High (privacy, young audience) | **Fixed**: JPEGs are always re-encoded in the browser, which drops EXIF (verified in Chromium: GPS EXIF in, none out). Remaining: if re-encoding fails the original is sent; PNG/WebP under 600 KB and videos are not stripped. A server-side strip would close this fully. |
| 2 | Pro banners and frames stayed visible after Pro ended. | Low (billing integrity) | **Fixed** in 0007 (`effective_banner` / `effective_frame`), with a test. |
| 3 | No Content-Security-Policy header. Other headers are set (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy). React escapes output and there is no `dangerouslySetInnerHTML` on member content, which limits XSS risk. | Medium | Open. Adding a CSP needs care (inline boot script, Supabase and media origins); recommend `Content-Security-Policy-Report-Only` first. |
| 4 | Ghost Mode does not hide the "is typing…" indicator inside a chat. | Low | Documented; the setting text does not promise it. |
| 5 | No daily XP cap; XP can be farmed by posting at the rate limit. XP has no money value, so impact is leaderboard fairness only. | Low | Open; documented in open-gates.md. |
| 6 | Supabase Free has no automatic backups. | Medium (data loss) | Process: manual `pg_dump` weekly and before every migration, per [rollback.md](rollback.md). |
| 7 | Minimum age: sign-up requires ticking "I'm 16 or older and I agree to the Terms and Privacy Policy", and the FAQ states the 16+ rule. This is a self-declaration, not verification. | Low | By design for now. (An earlier version of this review wrongly said there was no age check.) |

## Privacy and data lifecycle

- Account deletion (Settings, or `/delete-account`) removes the account and
  everything posted; it also removes collections, saved looks, applications
  and entitlements, through foreign keys `on delete cascade` from profiles.
- New personal data in 2.0: interface language, interests, look choices,
  creator category/statement/portfolio link. All are shown to the member in
  Settings and can be changed or removed. The Privacy Policy should list
  interests and creator applications (a small update before launch).
- Media is in a private bucket, served only to signed-in members, with
  type and size limits (50 MB; images and mp4/webm/mov only) and per-member
  upload quotas.

## Legal readiness notes (not legal advice)

- Terms and Privacy pages exist. Before charging money they need sections
  on subscriptions, renewal, cancellation and refunds, and on the payment
  processor (see [monetization.md](monetization.md)).
- Creator labels are described everywhere as community recognition, not a
  partnership, to avoid implying endorsement or employment.
- Machine-translated interface text is labelled as such. The legal pages are
  English-only and remain the binding version.
