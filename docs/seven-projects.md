# Seven Supabase projects

Status 2026-10-27: **live-update spreading is ON in production for projects 2–6 plus the original (7).** Migrations 0005 and 0006 were applied to the original project (data backed up first; all counts unchanged, RLS on every table), the project settings and `CRON_SECRET` were added in Vercel, and `/api/health` reports `"realtime":"sharded"` with no warnings. Still off: project 1 (no valid key) and spreading new uploads (no secret keys). Steps for those are at the end.

## What runs where

| | Project 7, the original (`xxvyoksevysyyzyonbxg`) | Projects 1–6, the extra ones |
| --- | --- | --- |
| Logins, sessions, passwords (Auth, 50k MAU) | ✓ only here | — |
| All app data: profiles, posts, comments, likes, chats, DMs, notifications, XP, moderation, audit (Postgres, 500 MB) | ✓ only here | — |
| Live updates: notifications, new posts, chat messages, reactions | its share of people | each project carries its share of people |
| Typing indicators | its share of chats | each project carries its share of chats |
| New photo and video uploads | its share | each project with a **secret key** gets its share |
| Files uploaded before this change | stay here, unchanged | — |

### Why the main data is not split

Logins can only live in one Auth system; otherwise every person would need seven accounts. The ~130 database functions behind the feed, chats, notifications and moderation join profiles, posts, reactions, blocks and memberships in a single query, enforce permissions with row-level security, and change several tables in one transaction. Splitting those tables across databases would break features, remove the safety of transactions, and make every screen *slower*, because one query would become several network round trips. So the original project keeps all of it.

What *can* be spread without any of those problems is the traffic that doesn't need joins: **live-update connections and messages**, and **file storage and bandwidth**. Those are also the free-tier limits a growing social app hits first.

## Capacity (Supabase Free, per project; see [free-tier-limits.md](free-tier-limits.md))

| Limit | One project | Spread today (projects 2–7, verified) | All 7 (once project 1 has a valid key) |
| --- | --- | --- | --- |
| Realtime concurrent connections | 200 | 1,200 | 1,400 |
| Realtime messages / month | 2 million | 12 million | 14 million |
| File storage | 1 GB | 1 GB (needs secret keys) | 7 GB |
| Egress (bandwidth) | 5 GB + 5 GB cached | 5 GB (needs secret keys) | 35 GB + 35 GB cached |
| Database | 500 MB | 500 MB (original only) | 500 MB (original only) |
| Auth users | 50k MAU | 50k MAU (original only) | 50k MAU (original only) |

These are allowances, not a promise of how many people YORU can hold. Supabase counts Realtime messages per delivery, so a new post seen live by 1,000 people costs about 1,000 messages wherever those people are connected.

## How it works

**Live updates (`REALTIME_SHARDS=on`).**
- Each person is assigned to one project by a stable hash of their id and opens one websocket there. Each chat's typing indicator is assigned to a project the same way.
- Topics are Broadcast channels named `yoru:<32 hex>`: an HMAC of the person or chat id under a server-only secret (`REALTIME_TOPIC_SECRET`, or one derived from the service key).
- Names are handed out only by `/api/live/topics`, to the signed-in person they belong to; a typing topic only to members of that chat. The extra projects' publishable keys are public anyway, so secret names are what keep topics private.
- Events contain ids only (plus a person's own notification text). Screens fetch the content through the normal API, which checks permissions.
- When someone writes:
  1. the database's `emit_change()` trigger puts a compact record in `public.realtime_outbox` (migration 0006);
  2. after the response, the server drains the outbox (`drain_realtime_outbox`, each change handed out exactly once even with many servers);
  3. it works out who should get each event: a DM goes to its two members, a public group to everyone, a notification to its owner;
  4. it sends one batched request per project.
- The outbox fills only while a server has drained it in the last 15 minutes, so it can't grow on its own. More than 300 changes in one transaction become a single "refetch".
- Code: `src/lib/server/realtime/{shards,outbox,routing}.ts`, `src/app/api/live/topics`, `src/components/providers/LiveProvider.tsx`, `src/lib/client/typing.ts`.

**Media.**
1. `/api/upload/sign` picks a project at random among those that accept uploads: the original, plus every extra project with a secret key.
2. The browser uploads straight to that project with a one-time signed URL.
3. The stored path records the location: `u/<user>/<file>` means the original project; `s<n>/u/<user>/<file>` means project n.
4. `/api/media/<path>` checks that the viewer is a member (cached 60 s), then redirects to a 1-hour signed URL from the right project.
- Account deletion removes the person's folder in every project, and the daily cleanup scans every project.
- Code: `src/lib/server/storage.ts`.

**Health.**
- `npm run shards:check` checks each project: the key belongs to the URL, a live message round-trips, and the bucket exists (with a secret key).
- `/api/cron/shards` touches every project daily so the extra projects keep showing activity (Free projects pause after a week of inactivity).
- `/api/health` lists the configured projects (numbers and refs only).

## Verification results (2026-10-27)

**Key and project pairing**, checked against each project's Auth endpoint:

| Listed as | Project ref | Result |
| --- | --- | --- |
| Database 1 | `vujzeuvaaexdsnscfrgr` | **No valid key.** The key listed for it (`…n8dq…`) is rejected here. |
| Database 2 | `fjjfyoxqtqtqneeexezy` | The key listed under **Database 1** (`…n8dq…`) is the one that belongs to this project. The key listed for Database 2 (`…-ztp…`) is invalid on every project, probably truncated. |
| Databases 3–6 | `swaluqvpyvcqxryxogfl`, `fyoycwoedjwlwiisdprg`, `mrsfqofltstndjtabspe`, `zzktrekdksvhisqnjekh` | ✓ |
| Database 7 (original) | `xxvyoksevysyyzyonbxg` | ✓ Discovered from the live site's public configuration (the URL and anon key the site already sends to every browser). It is a legacy `anon` JWT key. It is not one of the six new projects. |

**Live realtime round trip:** projects 2–7 each delivered a message in 100–160 ms.

**End to end:**
- All 15 Playwright flows passed with live updates spread over projects 2–6, using demo logins, random secret topics and no production data.
- A direct probe showed the receiving browser connected only to projects 5 and 6 (its live-update project and the chat's typing project). The message appeared about 1.4 s after it was sent, including the screen refresh.

**After switching on (production, 2026-10-27):** `/api/health` lists projects 2–7 with no warnings; the daily keep-alive job reached all six projects from Vercel; `/api/live/topics` refuses signed-out requests (401). All 22 Playwright flows passed locally with live updates on the real projects 2–6. Note for local runs: a demo server has no service key, so set `REALTIME_TOPIC_SECRET` or live updates won't start (production derives it from the service key).

**Not live-tested:**
- Media sharding: no secret keys were provided. It is covered by unit tests.
- The outbox drain on the real original database runs on the first write by a member (the app's presence heartbeat on page load counts), so it is exercised by normal use rather than by a test write into production data.

## Account note

Supabase's billing docs say the Free plan gives **two free projects per person**, counted across the organisations they own ([billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase)). The [terms](https://supabase.com/terms) don't explicitly mention multiple accounts, but Supabase can apply usage caps or throttling, or suspend access. Running one app across projects in three accounts may be treated as getting around the per-person limit. If Supabase pauses an extra project, live updates for the people on it stop until it is removed from the configuration. Their data is never at risk, because all data lives in the original project. The paid Pro plan is the risk-free way to get more capacity.

## Turning it on (needs you)

1. **Fix project 1:** copy the publishable key of `vujzeuvaaexdsnscfrgr` from its dashboard (Project Settings → API Keys). Until then it is skipped automatically.
2. **Apply migrations 0005 and 0006 to the original project:** Supabase dashboard → SQL editor → paste `supabase/migrations/0005_neon_ready.sql`, run it, then `0006_seven_projects.sql`. Both are additive. Do this **before** step 4.
3. **Vercel → Settings → Environment Variables (Production):** paste the block below, plus `CRON_SECRET` (any long random string) and optionally `REALTIME_TOPIC_SECRET`. Leave `REALTIME_SHARDS` off for now and redeploy. Then run `curl https://yoru-social.vercel.app/api/health`: `projects` should list 2, 3, 4, 5, 6 and 7, with no warnings except project 1's missing key.
4. Set `REALTIME_SHARDS=on` and redeploy. Check that live updates still work: DM a second account, post, react. To undo, remove `REALTIME_SHARDS` and redeploy; the app falls back to the original project's realtime, and the outbox switches itself off after 15 minutes.
5. **Storage (optional, recommended):** for each extra project, add `SUPABASE_PROJECT_n_SECRET_KEY` (dashboard → API Keys → Secret keys; server-only, never `NEXT_PUBLIC_`). Run `npm run shards:setup` locally with the same variables in `.env.local` to create the private `media` buckets, then `npm run shards:check`. Redeploy. New uploads then spread out, and old files stay where they are.

```
SUPABASE_PROJECT_1_URL=https://vujzeuvaaexdsnscfrgr.supabase.co
SUPABASE_PROJECT_1_PUBLISHABLE_KEY=<missing: copy from that project's dashboard>
SUPABASE_PROJECT_2_URL=https://fjjfyoxqtqtqneeexezy.supabase.co
SUPABASE_PROJECT_2_PUBLISHABLE_KEY=<the key that verified for this project>
SUPABASE_PROJECT_3_URL=https://swaluqvpyvcqxryxogfl.supabase.co
SUPABASE_PROJECT_3_PUBLISHABLE_KEY=<project 3 publishable key>
SUPABASE_PROJECT_4_URL=https://fyoycwoedjwlwiisdprg.supabase.co
SUPABASE_PROJECT_4_PUBLISHABLE_KEY=<project 4 publishable key>
SUPABASE_PROJECT_5_URL=https://mrsfqofltstndjtabspe.supabase.co
SUPABASE_PROJECT_5_PUBLISHABLE_KEY=<project 5 publishable key>
SUPABASE_PROJECT_6_URL=https://zzktrekdksvhisqnjekh.supabase.co
SUPABASE_PROJECT_6_PUBLISHABLE_KEY=<project 6 publishable key>
# Project 7 = the original. Keep the existing NEXT_PUBLIC_SUPABASE_URL /
# NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY. Do not change them.
CRON_SECRET=<long random string>
# REALTIME_SHARDS=on   # only after migration 0006 is applied to the original project
```

Keys are not written into the repository (publishable keys are public by design, but configuration belongs in Vercel).

## Settings reference

| Variable | Meaning |
| --- | --- |
| `SUPABASE_PROJECT_n_URL`, `SUPABASE_PROJECT_n_PUBLISHABLE_KEY` (n = 1–6) | An extra project. Skipped, with a warning, if the URL is malformed, the key is missing, or it repeats another project or the original |
| `SUPABASE_PROJECT_n_SECRET_KEY` | Server-only. Lets project n store new uploads |
| `SUPABASE_PROJECT_n_REALTIME=off`, `SUPABASE_PROJECT_n_STORAGE=off` | Take a project out of one role (e.g. a paused or full project) |
| `SUPABASE_PROJECT_7_*` | Optional. Must equal the original project if set; a different value is ignored and warned about |
| `REALTIME_SHARDS=on` | Spread live updates. Requires migration 0006 on the original project |
| `REALTIME_TOPIC_SECRET` | Optional. Secret for topic names (default: derived from the service key). Changing it moves everyone to new topics on their next page load |
| `STORAGE_UPLOAD_PROJECTS=1,3,7` | Optional. Only these projects receive new uploads |

Adding or removing a realtime project reassigns some people to other projects. That is harmless, because each page asks for its topics when it loads.
