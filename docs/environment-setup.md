# Environment setup

Never commit `.env*` files (they are git-ignored, except `.env.example`). Never prefix a secret with `NEXT_PUBLIC_`: anything with that prefix is sent to every browser. The app validates the selected backend at startup. Missing settings show up by name on `/setup` and `/api/health`, and the affected features answer 503 with a setup message instead of crashing.

## Variables

| Variable | Needed when | Where it comes from | Exposure |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production (always) | Supabase → Project Settings → API | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Production (always) | Supabase → Project Settings → API Keys | Public (RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) | Production (always). Required for sign-up, uploads, the bot, and Neon mode | Supabase → API Keys (secret) | **Server only** |
| `SUPABASE_PROJECT_n_URL`, `SUPABASE_PROJECT_n_PUBLISHABLE_KEY` (n = 1–6) | Seven-project setup | Each extra project's dashboard → API | Public |
| `SUPABASE_PROJECT_n_SECRET_KEY` | Spreading uploads to project n | That project → API Keys → Secret | **Server only** |
| `REALTIME_SHARDS`, `REALTIME_TOPIC_SECRET`, `STORAGE_UPLOAD_PROJECTS` | Seven-project setup ([seven-projects.md](seven-projects.md)) | You | Server |
| `DATA_BACKEND` | Only to switch app data to Neon: `neon` (not used) | You | Server |
| `DATABASE_URL` | With `DATA_BACKEND=neon` | Neon → Connect → **Pooled** connection (host has `-pooler`) | **Server only** |
| `DATABASE_URL_DIRECT` | Only for `npm run db:migrate` / `db:copy` on your machine | Neon → Connect → direct connection | **Never in Vercel** (local use only) |
| `SOURCE_DATABASE_URL` | Only for `npm run db:copy` | Supabase → Project Settings → Database → connection string (Session pooler) | **Local only**, contains the DB password |
| `PG_POOL_MAX`, `PG_STATEMENT_TIMEOUT_MS` | Optional tuning (defaults 5 and 15000) | You | Server |
| `CRON_SECRET` | Recommended (cleanup cron; unlocks the DB check on `/api/health`) | Any long random string, e.g. `openssl rand -hex 32` | **Server only** |
| `UPLOAD_CLEANUP_MODE` | Optional: `delete` to actually remove abandoned uploads (default: report) | You | Server |
| `UPLOAD_CLEANUP_MIN_AGE_HOURS` | Optional (default 48, minimum 24) | You | Server |
| `MAINTENANCE_READ_ONLY` | Only during a database cutover: `true` pauses all writes | You | Server |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_*` | AI Menace (existing) | Anthropic console | Server only |
| `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_ANDROID_APP_ID`, `FIREBASE_API_KEY` | Optional: instant notifications in the Android app (otherwise it checks in the background) | Firebase console, steps in `docs/notifications.md` | Service account JSON: **Server only** (Vercel: Sensitive). App ID and API key are public client values sent to the app |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Push notifications (website, installed web app) | `npx web-push generate-vapid-keys` (once; changing them signs everyone out of push) | Public key: server (sent to browsers). Private key: **Server only** (Vercel: Sensitive) |
| `GEMINI_API_KEY` | Atlas: voice, audio, images (and text when Gemini is picked) | Google AI Studio → Get API key | **Server only** (Vercel: Sensitive) |
| `OPENROUTER_API_KEY` | Atlas: the free text models | openrouter.ai → Settings → Keys | **Server only** (Vercel: Sensitive) |
| `GEMINI_MODEL`, `ATLAS_LIMIT_*` | Optional: Gemini models (default then fallbacks) and per-member limits | You | Server |
| `SUPPORT_EMAIL` | Optional (existing) | You | Public pages |
| `DEMO_MODE`, `DEMO_DATA_DIR` | Local demo and tests only. Never enable in production | You | Server |

Not used and not needed: `R2_*`, `UPSTASH_*`, `APP_URL`.

## Local development

```bash
cp .env.example .env.local     # leave everything empty for demo mode
npm install
npm run dev                    # demo mode: embedded Postgres, account picker
```

Real Postgres locally (to work on the Neon path without an account):

```bash
npm run db:local                                     # Postgres 16 on 127.0.0.1:54329, Neon-like owner role
DATABASE_URL=postgres://neondb_owner@127.0.0.1:54329/yoru_test npm run db:migrate
DEMO_MODE=true DATA_BACKEND=neon DATABASE_URL=postgres://neondb_owner@127.0.0.1:54329/yoru_test npm run dev
npm run test:pg                                      # adapter integration tests
```

With demo login and `DATA_BACKEND=neon`, the app seeds the demo content on first start if the database has no people. That never happens with Supabase Auth.

## Vercel

Dashboard: Project → Settings → Environment Variables. Pick the environments (Production / Preview / Development) for each variable. Or with the CLI:

```bash
vercel env add CRON_SECRET production
vercel env add DATABASE_URL preview      # paste the Neon *preview branch* pooled URL
```

Recommended split when Neon is used:

| Variable | Production | Preview |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` | production project | same project (Auth/Storage are shared). A second Supabase project is cleaner if you have one free |
| `DATA_BACKEND` | `neon` only after cutover | `neon` |
| `DATABASE_URL` | Neon `main` branch, pooled | Neon `preview` branch, pooled |
| `CRON_SECRET` | set | optional |

Environment variable changes only apply to **new deployments**, so redeploy after changing them.

If you install the Neon integration from the Vercel Marketplace, it may add `DATABASE_URL` (and others) automatically. That alone changes nothing: the app keeps using Supabase until `DATA_BACKEND=neon` is set.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `/setup` shows "DATA_BACKEND=neon needs DATABASE_URL" | Add the pooled URL to the right Vercel environment and redeploy |
| 503 "The database is waking up or unreachable" | Neon compute starting (retry), wrong host, or **CU-hours used up** (Neon console → Billing/Usage) |
| `/api/health` with the secret shows `can_switch_role: false` | Run `npm run db:migrate` again as the database owner; the shim grants `authenticated` with `SET` to the owner role |
| `permission denied for function …` | The browser called a server-only function; that is expected and correct |
| No live updates in Neon mode | Run `supabase/manual/neon-1-realtime-policy.sql` on Supabase; check the logs for `realtime relay rejected (401/403)` (service key missing or wrong) |
| `npm run db:migrate` refuses | It won't run against a `supabase.co` URL. Use the Neon URL |
| `npm run db:copy` "target is missing migrations" | Run `npm run db:migrate` on the target first |
| `db:copy` "columns on the source that the target lacks" | Supabase has a manual schema change that isn't in `supabase/migrations`. Add a migration for it first |
