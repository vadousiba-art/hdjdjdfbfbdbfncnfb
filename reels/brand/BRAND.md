# YORU brand sheet

Pulled from the YORU web app (`src/app/globals.css`, `src/components/ui/Logo.tsx`,
`src/app/manifest.ts`) and the Android apps (`android/app/src/main/res/values/colors.xml`,
`android-native/.../ui/theme/Theme.kt`). Theme code: `brand/theme.ts`. Assets:
`public/brand/` (logo, app screens, fonts).

The **editing rules** stay in `my-story/YORU-STYLE.md` (v2, "unslop": plain cuts,
TikTok captions, straight inserts, no kinetic text, no end card). This sheet is the
**look** those rules are drawn in. Where they disagreed, the app won: the insert panel
(v2's #141010) is the app's card colour, and the caption keyword is YORU red (v2's
#E11D48 underline was dropped in the Brand Lab).

Status: **approved, Brand Lab round 1 (2026-11-05)**, except the two Maybes below. Lab
samples live in `src/brand-lab/` (`BrandLab01`..`20`); build from the kept ones.

| Brand Lab sample | Call | What it means |
| --- | --- | --- |
| 02 App cards | **Keep** ("I like the simplistic animation") | the default way to build graphics |
| 04 Hook: white boxes | **Keep** ("I really like this") | the default hook |
| 05 Hook: black boxes, 06 Hook: plain white | Keep | hook options |
| 08 Red word | Keep | the default caption |
| 11 Split screen, 12 A/B pair | Keep | the insert layouts |
| 14 Ping, 15 Midnight unlock, 16 Reactions, 17 Same reach, 18 Countdown | Keep | approved motion graphics |
| 19 Corner handle, 20 Keyword CTA | Keep | in every video (handle still needed) |
| 03 Red flood, 09 Classic outline | Maybe | to rework, no note yet |
| 01 Night (red crescent), 07 Underline, 10 Red pill, 13 Full-screen app | **Drop** | never use |

## Colour

YORU is a dark app ("夜 — the internet after dark"). Videos use the dark theme.

| Token | Hex | Where it comes from | Use in video |
| --- | --- | --- | --- |
| `night` | `#080808` | app background, PWA theme colour | the ground behind every graphic |
| `night2` | `#0C0C0C` | raised background | gradients on the ground |
| `card` | `#121212` | cards | insert panel, notification cards |
| `card2` | `#1A1A1A` | pressed / nested cards | inner rows |
| `line` | `#292929` | hairlines | card borders, dividers (1-2 px) |
| `ink` | `#F5F5F5` | text | all text on dark |
| `ink2` | `#D6D6D6` | secondary text | sub-lines |
| `muted` | `#999999` | meta text | labels, timestamps |
| `red` | `#F20D2F` | brand, hue 351.4 (logo red measures #FF0D26) | the one accent: keyword underline, tags, buttons, the moon |
| `redBright` | `#FF3355` | brand-2 | glow, highlights on red |
| `redDark` | `#A30F25` | ring-b | the dark end of red gradients |
| `logoWhite` | `#FFF3EE` | the wordmark's warm white | the logo only |

App-only colours (online green `#22C55E`, amber, violet, pink, Discord-blue "official")
are UI states and stay out of the videos.

**One accent.** Red is the only colour besides the neutrals. On top of footage it is
used small (an underline, a tag, a pill, an icon), never as body text: red text on skin
and walls doesn't read. Big red fills belong on the dark ground, not over video.

The light theme (`#F5F5F5` ground, `#111111` ink, red `#D50B28`) exists in the app but
is not a video look.

## Type

- **Inter** (variable, the app's only typeface), weights 600-900. Never italic.
  File: `public/brand/fonts/inter-latin-wght.woff2` (OFL).
- **The tagline style:** uppercase, tracking 0.32 em, weight 600, small:
  `THE INTERNET AFTER DARK.`
- **夜** (yoru, night): the brand glyph. On screen it's `YoruKanji` (a 夜-only subset,
  weight 900, `public/brand/fonts/yoru-kanji.woff2`). The serif 夜 in the logo is part of
  the logo artwork; don't retype it.
- Japanese beyond 夜 (the app's small labels like アニメ) needs Noto Sans JP added first.

## Logo

- `public/brand/wordmark.png` (868x213, for dark grounds) and `wordmark-light.png`.
- `public/brand/mark.png`: the crescent "O" on its own.
- The crescent in the O is red, the letters warm white. Don't recolour, outline or
  animate the wordmark (rule 4). No end card (rule 8), so the logo appears inside a
  graphic or not at all.

## Captions

Inter 800, about 66 px, white, a soft dark shadow and a thin dark edge, 1-3 words at a
time, centred at 68% down (on the seam between halves during a split). One keyword per
caption at most, and it turns red: `redBright` #FF3355 (brighter than the brand red so
it reads on skin). Lowercase except names, letters and numbers ("YORU", "A", "17").

Not used: the underline and the red pill (dropped). The thick black outline is a Maybe.

## Hooks

Top of frame, about 16% down (inside the Instagram grid crop, which starts at y285),
2 lines, Inter 600 at about 60 px. Default: black text on white boxes. Options (all
kept): white on black boxes, plain white with a shadow.

## Inserts and layouts

- Split screen: the screen in the top half, straight, square corners, no outline, still,
  on `card` (#121212). Speaker in the bottom half, face centred. Caption on the seam.
- A/B pairs: two screens side by side, tagged A and B in square YORU-red tags.
- Real YORU screens only (`public/brand/screens/`, captured from the app).
- Never a screen full frame over the speaker (dropped).

## Motifs

Things that make every video feel like the same channel:

- **App cards** (the default for graphics): `card` panels with hairline edges on the night
  ground, sliding up into place one after another, simply. Nothing flashy.
- **Notification cards**: app-style `card` rows with the red 夜 app icon ("YORU · now").
- **Midnight**: `00:00`, the feed that opens at midnight.
- **Night streaks and XP**: the "1 night" chip and the level bar (`Lv 4 · Night Owl`).
- **Red pill buttons and chat bubbles**, straight from the app.
- Slogan: **the night is for everyone**.

Motion graphics stay structural (blocks, cards, a lock, a counter) on the night ground,
used occasionally (rule 6), with small tags as labels. Approved: the ping cascade, the
midnight unlock, the reaction picker, the equal-reach stacks and the countdown.

Not used: the glowing red crescent as a graphic (dropped). The crescent stays in the logo.
A full red ground is a Maybe.

## Sound

Voice only, cleaned and loud (-14 LUFS). No sound effects on cuts. A trending sound
is added in Instagram at posting. `public/music pack/` and `public/sound pack/` are
empty; nothing is licensed yet.

## Corner handle

Instagram glyph + `@handle`, right side, about a quarter of the way down.
**Handle still needed.**
