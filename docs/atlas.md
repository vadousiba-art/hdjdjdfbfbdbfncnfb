# Atlas

Atlas is the AI assistant Jesse (YORU's co-founder) built, living in YORU as its own section at **/atlas** (Orbit icon in the side rail and the menu). It talks, listens, looks at photos and drafts posts, bios, comments and messages.

## How it works

```
browser ──▶ /api/atlas/chat ──▶ routeRequest()
                                 ├─ audio / voice ─────────────▶ Google Gemini (always)
                                 ├─ images ─ chosen model sees images? ─ yes ▶ that model
                                 │                                    └ no  ▶ Gemini (reply says so)
                                 └─ text ──────────────────────▶ the member's chosen model
```

- **Providers.** Gemini (Google AI Studio) is the default and the engine for voice, audio and images. OpenRouter supplies the text-model picker, and **only free models are offered**: a model must end in `:free`, every price must be `0`, it must answer in text, and routers that switch models per request (`openrouter/free`) and safety classifiers are left out (`src/lib/atlas/models.ts`). The list comes from OpenRouter's public `/api/v1/models`, cached on the server for 15 minutes.
- **Never silently switched.** The member's pick is used exactly. If it can't take an input (an image to a text-only model, any audio), that one turn goes to Gemini and the reply says so. If a picked model disappears or is busy, Atlas says so and offers "Change model"; it doesn't swap.
- **Gemini models** are configurable (`GEMINI_MODEL`, comma-separated: first is the default, the rest are tried only when it's overloaded, rate-limited or retired, and the reply names the model that answered). Default: `gemini-3.5-flash,gemini-flash-lite-latest`. Checked on 29 Oct 2026 with the project's key: `gemini-2.5-flash` is closed to new keys; newer Flash models were briefly overloaded (hence the fallback).
- **Voice.** The browser records with `MediaRecorder` (WebM on Chrome/Android, MP4 on Safari, Ogg on Firefox) and the clip goes to Gemini as-is: Gemini understands the audio directly, so there's no transcription step. Verified with WAV, WebM and MP4 clips. Voice turns use minimal thinking and short spoken answers. Replies are read aloud with the device's own speech (`speechSynthesis`), so speaking costs no API calls; mute in the header, stop per reply.
- **Streaming.** Replies stream as newline-delimited JSON (`meta`, `d` chunks, `done` / `error`), so text appears as it's written. Models are told to keep reasoning short (`thinkingLevel` on Gemini, `reasoning.effort: low` + `exclude` on OpenRouter) so free models don't spend the answer budget thinking.
- **YORU features.** The system prompt (`src/lib/atlas/prompt.ts`) describes only features YORU actually has. Drafts come back in fenced blocks (```` ```post ````, `bio`, `comment`, `message`) that the page shows as cards: **Open in composer** (post), **Use as my bio** (asks to confirm, then saves through `update_my_profile`), **Copy**. The Orbit button in the post composer, comment box, chat box and bio editor calls `/api/atlas/assist` for a suggestion; **Use this** puts it in the box and the member still presses Post / Send / Save. Atlas never posts, sends or changes anything itself. Questions about trends include YORU's trending tags.
- **Memory.** `atlas_messages` keeps each member's latest 200 messages (text only; photos and audio are never stored, just noted), private by RLS; members can clear it. `atlas_prefs` keeps the chosen model and voice setting (migration 0013).

## Security and limits

- Keys are read only on the server (`atlasConfig()` in `src/lib/config.ts`); nothing Atlas-related is `NEXT_PUBLIC_`. Requests need a signed-in member (`getUserDb`), are validated with zod (text ≤ 4000 chars, ≤ 3 files, ≤ 3 MB together, image/audio types only) and limited per member in Postgres (`ATLAS_LIMIT_PER_MINUTE`, default 8; `ATLAS_LIMIT_PER_DAY`, default 100), on top of the providers' own free-tier limits. Provider calls time out after 50 s; the browser can stop a reply.
- Images are resized and stripped of location data in the browser before upload (the same `optimizeImage` posts use).
- Free tiers: Google and some free OpenRouter providers may use inputs to improve their products. The Atlas page says so under the input and the Privacy Policy explains it (section 4, "Atlas").

## Setup

| Variable | Where |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio → Get API key. Vercel → Settings → Environment Variables, Production, **Sensitive**. |
| `OPENROUTER_API_KEY` | openrouter.ai → Settings → Keys (set a credit limit; Atlas only uses free models). Same place in Vercel. |
| `GEMINI_MODEL` (optional) | Comma-separated Gemini models, default first. |
| `ATLAS_LIMIT_PER_MINUTE`, `ATLAS_LIMIT_PER_DAY` (optional) | Per-member limits. |

Without `GEMINI_API_KEY`, voice and images are off; without `OPENROUTER_API_KEY`, only Gemini is offered; without both, the page explains Atlas isn't switched on.

**Rotating a key** (do this for both current keys, since they were shared in a chat): create a new key at the provider, replace the value in Vercel (Settings → Environment Variables → the variable → Edit), redeploy, then delete the old key at the provider.

## The desktop app

`atlas-desktop/` holds Jesse's Electron shell (from the files supplied), hardened and connected to YORU: by default it opens YORU's Atlas section in a locked-down window; if Jesse's local Python backend is present (`ATLAS_MODE=local`), it starts that instead, as before. See its README. The Python backend and the original renderer (`voice-assistant/`, `src/index.html`) were not part of the files supplied, so they aren't in this repository.
