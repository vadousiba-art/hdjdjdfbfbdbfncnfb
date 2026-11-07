# YORU (夜)

> THE INTERNET AFTER DARK. 夜は、まだ終わらない。

A private, invite-only, Japanese-inspired social network for anime, manga, Vocaloid, music, gaming and art fans. It mixes a feed, stories, group chats, threads, and an AI comedian called **The AI Menace**.

> YORU is a visual rebrand of the app formerly called IsraelTokn't. The database, accounts, auth and Android package id (`com.israeltoknt.app`) are unchanged, so existing users keep everything.

Built with **Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Motion · Supabase (Postgres, Auth, Realtime, Storage) · Claude**, with optional **Neon** Postgres as the primary database.

---

## Quick start (demo mode, no accounts needed)

```bash
npm install
npm run dev
# open http://localhost:3000
```

With no Supabase credentials the app runs in **demo mode**:

- The real database schema (`supabase/migrations/*.sql`, with all RLS policies and functions) runs inside an embedded Postgres (PGlite), stored in `.data/`.
- On first start it seeds the group from the mockup: Ethan, Lucas, Zach, Tyler, the AI Menace, 48 extra members, posts, stories, chats, polls and awards.
- Login is an account picker, so you can switch users and test realtime chat in two browser windows.
- Uploads are saved to `.data/uploads/`. Realtime runs over Server-Sent Events.
- `npm run demo:reset` wipes the demo data, and it re-seeds on the next start.

Demo mode lets anyone log in as anyone. It turns itself off in production unless you set `DEMO_MODE=true`. Don't expose it publicly.

---

## Real setup (Supabase)

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. **Apply the schema.** Open the SQL editor and run, in order:
   - `supabase/migrations/0001_core.sql` (tables, RLS, functions, triggers, realtime)
   - `supabase/migrations/0002_storage.sql` (the private `media` bucket and its read policy)
   - `supabase/migrations/0003_yoru_features.sql` (levels, streaks, site controls, mutes, audit log). Additive only: new columns with defaults, new tables and functions. It can be run twice safely and does not change existing rows.
   - `supabase/migrations/0004_open_signup.sql` (open sign-ups with an admin switch, support inbox, account deletion). Turns on open sign-ups.
   - `supabase/migrations/0005_neon_ready.sql` (search and foreign-key indexes, the upload-cleanup helper, opt-in change capture for Neon). Additive; changes no rows.

   Or use the Supabase CLI: `supabase init` (once; it keeps the existing migrations), then `supabase link --project-ref <ref>` and `supabase db push`.
3. **Configure the environment:** `cp .env.example .env.local`, then fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Add `ANTHROPIC_API_KEY` to enable the full AI Menace.
4. **Recommended auth settings:** under Authentication → Providers → Email, turn off **"Allow new users to sign up"**. The app creates accounts server-side after checking the invite, and a database trigger also rejects any sign-up without a valid invite, so this is defence in depth.
5. **Start it:** `npm run build && npm start` (or deploy to Vercel or any Node host).
6. **Become the owner.** Visit `/join`. The first account created becomes the owner. Then open **Admin → Invites** to create invite links for your friends.
7. *(Optional)* `npm run seed -- --yes` loads the demo content into Supabase. Do this after you've created your own owner account, otherwise the seed user becomes the owner.

`/setup` shows which pieces are configured, and `/api/health` returns the same status as JSON.

---

## Seven Supabase projects

YORU runs entirely on Supabase. The original project keeps logins and all data; six extra projects share live-update connections and messages (and new uploads, when given secret keys), multiplying those free-tier limits. Setup, verification results and the switch-on steps: [docs/seven-projects.md](docs/seven-projects.md). `npm run shards:check` verifies every project live.

## Database options (Supabase or Neon)

By default all app data lives in Supabase Postgres. Setting `DATA_BACKEND=neon` plus `DATABASE_URL` keeps app data on **Neon** instead. Supabase still handles login, files and realtime delivery. The same migrations, RLS policies and functions run on both, user ids don't change, and passwords never leave Supabase.

**Production stays on Supabase (decided: 100% Supabase).** Neon's free plan caps compute at 100 CU-hours a month, which an always-online YORU would likely exhaust mid-month. Everything is built, tested and documented, ready for when it makes sense:

| Doc | What's in it |
| --- | --- |
| [docs/open-gates.md](docs/open-gates.md) | YORU 2.0 "Open Gates": feature status, how to release and roll back, test results |
| [docs/pro-universe.md](docs/pro-universe.md) | YORU Pro Universe: the 400-item catalog, 20 systems, storefront, migration 0009, tests, what's left before launch |
| [docs/monetization.md](docs/monetization.md) | Payment provider research (fees, age rules), recommendation, Pro/tips architecture. Nothing charges today |
| [docs/security-review.md](docs/security-review.md) | Gatekeeper review: access control, findings and fixes, privacy, legal notes |
| [docs/aws-openai-readiness.md](docs/aws-openai-readiness.md) | What would change if AWS/OpenAI credits are approved (none are confirmed) |
| [docs/seven-projects.md](docs/seven-projects.md) | The seven-project setup: what runs where, capacity, verification, how to turn it on |
| [docs/architecture.md](docs/architecture.md) | Audit findings, the decision, service responsibilities, auth/media/realtime flows, outage behaviour |
| [docs/database-migration.md](docs/database-migration.md) | Backup, provision, copy, verify, cutover (read-only window), monitor; local rehearsal |
| [docs/api-integrations.md](docs/api-integrations.md) | Every provider API used, where, and how errors and retries work |
| [docs/environment-setup.md](docs/environment-setup.md) | Every environment variable, local and Vercel setup, troubleshooting |
| [docs/free-tier-limits.md](docs/free-tier-limits.md) | Verified free-tier limits, risks, monitoring |
| [docs/rollback.md](docs/rollback.md) | Backups, when and how to roll back, data validation |

```bash
npm run db:local                 # local Postgres that behaves like Neon (non-superuser owner)
npm run db:migrate               # apply migrations to DATABASE_URL_DIRECT / DATABASE_URL
npm run db:copy -- --dry-run     # Supabase -> Neon copy plan (SOURCE_DATABASE_URL -> DATABASE_URL_DIRECT)
npm run db:rehearse              # full local rehearsal: seed, migrate, copy, change, re-copy, verify
npm run test:pg                  # adapter tests against real Postgres
```

---

## Android app

Store listing text, links and graphics: [`docs/store-listing.md`](docs/store-listing.md). Public pages: `/about`, `/privacy`, `/terms`, `/faq`, `/support`, `/delete-account`. Set `SUPPORT_EMAIL` to show a support address on them.

`android/` (package `com.yoru.social`) is a small native Android app (plain Java, no extra libraries) that opens the live site full-screen. It supports photo and video uploads, the back button, external links in the browser, invite links that open in the app, an offline screen, and the logo as its icon. Accounts, chat and the feed all run on the server, so the app stays up to date without new releases.

- **Download:** the built APK is served at `/download/yoru.apk` (the old `/download/israeltoknt.apk` link redirects there). The login screen and the menu link to it, and the link is hidden inside the app itself.
- **Build:** install the Android SDK (platform 36, build-tools 36) and JDK 17+. Create `android/local.properties` with `sdk.dir=...` and `android/keystore.properties` with your signing key (see `android/app/build.gradle`). Then run `cd android && gradle assembleRelease`. To point the app at a different site, pass `-PitnUrl=https://your-site`.
- **Updates:** future APKs must be signed with the same key, or phones will refuse to update and require an uninstall. Keep the keystore safe.
- **iPhone:** open the site in Safari, then Share → Add to Home Screen. The web app manifest makes it open full-screen.

## Features

| Area | What works |
| --- | --- |
| **Feed** | Infinite scroll, text, images, GIFs, video, polls, links, quote posts, reposts, bookmarks, hashtags (including Hebrew and emoji), trending (score with time decay), live "new posts" pill |
| **Reactions** | Like plus 8 custom reactions (💀 🔥 😭 🤡 🧢 🫡 W L). Hold or right-click the heart to pick one. Emoji burst animations |
| **Comments** | Threaded replies up to 4 levels, comment likes, delete, report, "Summon Menace" roast replies |
| **Group chats** | Realtime public and private groups and DMs, typing indicators, replies, emoji reactions, media, @mention autocomplete, unread counts, `/menace` command |
| **Stories** | 24-hour photo, video or text stories, group stories, viewer with progress bars and hold-to-pause, view counts, delete, report |
| **AI Menace** | Dedicated chat with history, 3 roast intensities, opt-in personalized roasts, Roast Me, Skill Issue Detector, Rate My Take, Propaganda Generator, Diplomatic Crisis Simulator, Fake Breaking News (can post to the feed), Comeback Generator, Roast of the Day |
| **Chaos tools** | Random chaos button, synthesized soundboard, daily challenge (+5 chaos points), community awards (5 per day) |
| **Profiles** | Avatar upload, bio, status, flair, inside jokes, stats, 11 achievement badges, posts and media tabs |
| **Leaderboards** | Opt-in only: most liked, biggest menace, most awarded, most roasted, top yapper |
| **Notifications** | Likes, reactions, comments, replies, mentions, reposts, awards, DMs, roasts, optional friend activity. Each one can be toggled, and they update live |
| **Levels & streaks** | XP for posts (+10), comments (+4), likes received (+2, taken back on unlike) and awards (+15); nightly check-in (+20, up to +35 streak bonus) with a streak counter; levels with Japanese titles (新人 → 夜の王); full-screen level-up animation; Levels and Night Streaks leaderboards |
| **Style** | YORU red by default; a color slider in Settings (plus presets: 紅 桜 菫 氷 翠 金 炎) recolors the entire app live, including the logo, effects and animations, and tints your profile for everyone. Every accent is generated from one hue (`--accent-h`), "Currently watching / reading / listening / playing", pinned post on your profile, admin-given flair |
| **Effects** | Ambient background (stars, sakura, rain, fireflies or off), double-tap media to like, `||spoilers||` that blur until tapped, category chips in the composer, Ctrl/Cmd+K command palette, and a hidden 夜 mode (Konami code or tap the logo five times). All respect reduced motion |
| **Admin** | Overview with 14-day activity chart and top posters/tags; announcement banner; broadcast notification to everyone; quiet mode (pause member posts); slow mode; word filter; tonight's prompt; feature posts in "Tonight's picks"; mute members (10 min to 7 days), flair, grant XP, rebuild XP from history; full audit log of admin actions. Plus invites, roles, verify, ban and the report queue |
| **Open Gates (2.0)** | 16 interface languages (machine-translated, labelled) with Arabic right-to-left; interests and Discover; profile banners, avatar frames and a badge showcase; saved looks; Collections; Ghost Mode; Creator Showcase with admin review; report categories with auto-escalation; YORU Pro (purchases off, admin grants only); public Trust Center; "What's new" release tour. Details: [docs/open-gates.md](docs/open-gates.md) |
| **Pro Universe** | 400 customization items in 20 systems (rings, banners, nameplates, themes, effects, badges, layouts, collections, drafts, analytics, feed presets, hubs, reactions, insights, chat themes, sounds, planner, milestones, lab, hub) with try-on, equip and wishlist; Draft Studio and scheduled posts; own-data analytics. Ownership checked server-side; purchases not open. Details: [docs/pro-universe.md](docs/pro-universe.md) |
| **UX** | Dark, light and system themes; reduced-motion support (system, reduced, or full); mobile-first layout with a desktop 3-column view; absurd loading, empty, 404 and error screens |

---

## Security model

- **Private by default.** Every table has row-level security. Only signed-in, non-banned members can read anything. Anonymous users can't read even public channels.
- **Writes only go through Postgres functions** (`SECURITY DEFINER`) that check membership, validate input and enforce per-user **rate limits** in the database. Signed-in users get no INSERT, UPDATE or DELETE grants on any table.
- **Reads go through `SECURITY INVOKER` functions**, so RLS still applies.
- **Invite-only sign-up** is enforced by a trigger on `auth.users`. Invite use is counted atomically.
- **The API allowlists browser-callable functions** and validates every argument with zod (`src/lib/server/rpc-registry.ts`). Bot and invite functions can only be executed by the service role.
- **Uploads:** the server checks type, size and quota, then issues a one-time signed upload URL into a private bucket that also enforces MIME type and size. Media is served through `/api/media/*`, which checks the session first. In demo mode the file signature (magic bytes) is also checked.
- **Uploaded files are checked again when used:** a path can only be attached to a post, story, message or avatar by the person who uploaded it, and with Supabase Storage the first bytes must match the file type. Large photos are downscaled in the browser before upload.
- **Secrets stay on the server:** the service-role key and Anthropic key are only read in server code. The browser only sees the public URL and anon key.
- **Security headers:** `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, and a permissions policy.

### AI privacy rules

- The Menace only receives text that a user explicitly sends: their message, a tool input, or a post they ask it to roast, which every member can already see.
- Profile details (bio, status, inside jokes, recent posts) are shared **only if that user enables "Personalized roasts"**.
- Other people can only be roasted if they opted in. Intensity is capped at the level they chose.
- DMs and group chats are **never** sent to the AI. The `/menace` chat command sends only that one message.
- Per-user daily and per-minute limits apply. Rate limits from the API return a friendly 503, and other failures fall back to the offline "Menace Lite".

---

## Project layout

```
supabase/migrations/   SQL schema, RLS, functions, triggers (single source of truth)
src/app/(app)/         Signed-in screens: feed, explore, post, chat, menace, chaos, profile...
src/app/api/           rpc/[fn], auth, upload, media, live (SSE), ai/[tool], health
src/lib/server/        db adapter (Supabase, Neon or PGlite), realtime relay, AI client, uploads, errors, rate limiting
src/lib/database/      migration runner + Postgres shim shared by PGlite, Neon and the scripts
scripts/db/            migrate, copy-to-neon, rehearse, local Postgres
supabase/manual/       Supabase-side SQL for a Neon cutover and its rollback (run by hand)
src/lib/seed/          Demo content + storage-agnostic seeder
src/components/        Shell, feed, stories, chat, menace, profile, ui
tests/unit|db|e2e      Vitest unit tests, SQL security tests (PGlite), Playwright flows
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (demo mode if Supabase isn't configured) |
| `npm run build && npm start` | Production build and server |
| `npm test` | Unit, AI client (mocked API) and database security tests |
| `npm run test:e2e` | Builds, then runs the Playwright flows in demo mode (set `CHROMIUM_PATH` to use a preinstalled Chromium) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run seed -- --yes` | Seed a Supabase project with the demo content |
| `npm run demo:reset` | Wipe the local demo database |
| `npm run db:local` / `db:migrate` / `db:copy` / `db:rehearse` | Postgres/Neon tooling (see Database options) |
| `npm run test:pg` | Neon adapter tests against a real Postgres (`TEST_DATABASE_URL`) |
| `npm run shards:check` / `shards:setup` | Verify the seven Supabase projects live / create the media buckets in the extra projects |
| `npm run load-test -- --url http://localhost:3000` | Lightweight load test against a demo-mode server |

## Content note

Political satire, absurdism, dark humour and aggressive banter between friends who opted in are the point. Attacks based on protected identity are not. The AI's system prompt enforces this, and members can report and block.
