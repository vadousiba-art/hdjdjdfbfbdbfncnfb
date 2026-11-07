# The welcome film ("Enter the Night")

YORU's cinematic introduction: an 80-second film for new members, a 26-second
update cut for existing members, a replay entry in the menu, and a "Watch the
intro" button on the public landing page. It sits on top of the app; it never
replaces or blocks anything.

## What exists

| Piece | Where |
|---|---|
| Full film, 80 s, 1920×1080 and 1080×1920 | `public/welcome/v1/full-{land,port}.{webm,mp4}` |
| Short update cut, 26 s, both orientations | `public/welcome/v1/short-{land,port}.{webm,mp4}` |
| Posters and link-preview image (1200×630) | `public/welcome/v1/poster-{land,port}.jpg`, `og.jpg` |
| Storyboard, script, verified feature list | `welcome/STORYBOARD.md` |
| Production source (capture, composition, score, render) | `welcome/` (see its README) |
| Timeline shared by picture, sound and captions | `src/lib/welcome/cues.json` |
| Versioned config, policy, source choice | `src/lib/welcome/config.ts` |
| Player | `src/components/welcome/WelcomePlayer.tsx` |
| When to show it, menu hub | `src/components/welcome/WelcomeExperience.tsx` |
| Preference on the profile | `supabase/migrations/0008_welcome.sql` |

Every frame is either drawn in code (manga ink, halftone, speed lines, the
official wordmark traced to vector outlines) or is a real screenshot of the
current app, captured from a local demo server with a fictional cast. The
score is synthesized. No stock footage, samples or paid services were used.

## Who sees what

| Member | Experience |
|---|---|
| New account (under 72 hours old), never seen v1 | The full film, once, on their first load of Home after joining |
| Existing member who hasn't seen v1 | The 26-second update, once |
| Anyone who has seen v1 | Nothing automatic. Menu → What's new → watch either cut or read the notes |
| Visitor on `/about` | "Watch the 80-second intro" button; the end button goes to Join |

Rules:
- Shown only on a fresh load of the Home screen, never on route changes or mid-session.
- Remembered on the profile (`profiles.welcome_seen`), mirrored on the device, so another device or a cleared browser doesn't show it again.
- Skip (and Escape) are always available; nothing in YORU waits for the film.
- If the database preference is unavailable, the app falls back to the device mirror and shows the short cut.

## Player behaviour

- Starts **muted**; a prominent "Sound on" button turns sound on. No sound plays without a tap.
- Autoplay blocked (some browsers, the Android app's WebView), **reduced motion**, **data saver** or a **slow connection** → poster with a Play button; nothing is downloaded until tapped.
- WebM (VP9 + Opus) is offered first, MP4 (H.264 + AAC) second, so every major browser can play it (Safari/iOS take the MP4).
- Portrait file on tall screens, landscape on wide ones; on rotation it switches file and keeps its place.
- Captions are drawn by the player from `cues.json` in the member's language (16 languages). They are on by default when the interface isn't English, because the film's on-screen type is English.
- Keyboard: Space/K play, M mute, C captions, ←/→ seek, Escape skip. Focus stays in the dialog and returns afterwards.
- If no file can play, the player shows the release highlights as text, plus "YORU Pro is in development", and the Enter button.
- Files are cached for a year (`/welcome/v1/` never changes in place); the JavaScript bundle doesn't contain the video.

## Honesty rules the film follows

- Only features in the current build are shown working (verified list in `welcome/STORYBOARD.md`).
- **YORU Pro** is labelled "COMING SOON" and "IN DEVELOPMENT" throughout, with "The social part stays free for everyone." **No price** is shown: checkout terms aren't ready. A unit test fails if a price appears in the film's text.
- No member counts, dates, analytics or partners.

## Analytics

None. YORU's Privacy Policy and Trust Center promise no third-party
analytics or tracking, so the film records only whether a member has seen
each version (one short text field on their profile). If aggregated
measurement is wanted later, count server-side `mark_welcome_seen` calls per
version; never add a tracking script.

## Android

The Android app is a WebView around the live site, so it gets the film with
the next web deploy (no new APK). The WebView requires a tap before any
media plays, which the player handles with its Play button. Not tested on a
physical Android device; tested in Chromium at phone size.

## Shipping a new version (a future major release)

1. Update `welcome/STORYBOARD.md` and the timeline in `src/lib/welcome/cues.json`; set `"version": "2"`.
2. Re-capture screens, render and encode (`welcome/README.md`). Files go to `public/welcome/v2/`.
3. Add any new caption keys to `src/lib/i18n/messages/*` (the i18n test lists missing ones).
4. Deploy. Members who saw v1 get the short cut of v2 once; new members get the full film.
5. Keep YORU Pro's `status: "in_development"` until purchases are actually open.

## Tests

- `tests/db/welcome.test.ts`: the preference, account age, input validation, signed-out refusal.
- `tests/unit/welcome.test.ts`: config validity, captions translatable and inside the film, no price, policy, source choice.
- `tests/e2e/flows.spec.ts`: a new account sees the film once (muted start, playback, sound toggle, skip), it isn't shown again after reload, replay hub (short cut, read notes), fallback when the files can't load, captions in Japanese, the landing-page intro.

## Production check (2026-10-27)

Migration 0008 applied to the live database (backed up first; account,
post and message counts unchanged; RLS on every table; signed-out callers
refused). Deployed to yoru-social.vercel.app, then checked on the live site
with a throwaway account in a phone-sized Chromium:

- `/about` → "Watch the 80-second intro" plays for a signed-out visitor (portrait WebM chosen).
- A new account sees "Enter the Night" right after joining; it plays; Skip closes it; after a reload it does not come back.
- The test account was then deleted through Settings → Delete my account; the database shows no trace of it.
- Film files are served with `200`, the right content types, a one-year immutable cache and range requests (`206`).
