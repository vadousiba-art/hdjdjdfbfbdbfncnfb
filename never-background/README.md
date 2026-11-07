# YORU — "YOU WERE NEVER A BACKGROUND CHARACTER."

A 34.5-second vertical (1080×1920, 30 fps) emotional short for TikTok and
Instagram Reels. Emotional arc: intrigue → recognition → heartbreak →
awakening → belonging. The world is black-and-white manga with crimson accents
until the protagonist looks up; then **colour blooms out from them** and stays
for the rest of the film.

Built in code and rendered locally: original manga characters (Canvas 2D), real
YORU screens, free stock footage (Mixkit, free licence), and a score played on
CC0 orchestral samples (VSCO-2-CE) with free sound effects (Mixkit). See
`LICENSES.md` for every third-party asset and its licence.

## Build

```bash
cd never-background
./fetch-assets.sh && bash film/prep-media.sh   # download free assets, make frame sequences
bash capture/server.sh && node capture/capture.mjs   # (optional) re-capture the real app screens
python3 film/audio/synth.py                    # -> film/audio/never-background.wav
node film/render.mjs                           # -> out/yoru-never-a-background-character.mp4
node film/render.mjs --preview                 # 540x960 check
node film/render.mjs --stills 4.8,19.4         # -> out/stills/
node film/render.mjs --cover                   # -> out/cover.png
```

`film/cues.json` is the one timeline both picture and sound read.

| Need | Tool |
| --- | --- |
| Characters, panels, transitions, typography | Canvas 2D in headless Chromium (`film/art.js`, `film/manga.js`, `film/main.js`) |
| Footage | Mixkit clips → frame sequences and ink alpha mattes (`film/prep-media.sh`, ffmpeg) |
| Real YORU screens | Playwright against a local demo build with the clock moved past the Halloween window, so the app shows its normal logo (`capture/`) |
| Score | numpy/scipy sampler over VSCO-2-CE (`film/audio/bank.py`, `film/audio/synth.py`) + Mixkit SFX |
| Encode | ffmpeg (H.264 High, AAC 256k) |

## The film, scene by scene (everything connects)

| Time | Picture | Sound |
| --- | --- | --- |
| 0–3.3 | A crowded room; every face hidden behind a glowing phone; notifications fall like paper; the grey city glows through the window. One face is visible. The camera pushes into their eye. "Have you ever felt…" | A distant crowd, phones buzzing, paper. No music. |
| 2.75–5.05 | The eye: the phone's feed scrolls in its reflection. "…invisible / in a world where / everyone is connected?" A crimson line cuts across the reflection, and we **dive into the reflection**. | The first fragile piano note lands with the crimson line. |
| 5.0–7.3 | **The reflection becomes their phone.** A "my favorite song." post is buried by identical #trend posts. **A music note escapes** the buried post… "You have things you love." | Piano; cellos creep in; a same-y whoosh; a sparkle as the note rises. |
| 7.3–9.3 | …and lands in three panels: headphones on, eyes closed; a sketch taking shape; reading manga. | Page turns as each panel lands; violas. |
| 9.3–11.45 | **The phone slides up**: typing "have you ever heard of", hesitating, deleting. "Things you wish someone understood." | Real phone typing; delete clicks; the pulse begins. |
| 11.45–12.6 | **The phone drops**, revealing a group laughing at an inside joke; they slide away while the protagonist stays in shadow. "But sometimes…" | Far-away laughter. |
| 12.55–13.7 | The phone comes back; they send "this song sounds like 3am. anyone?" It sinks under the feed, and **ink floods the frame**. | A deep whoosh into the ink. |
| 13.5–15.3 | Out of the ink: their profile in the dark against rain on a window. "…it feels like nobody is listening." | Rain; the piano starts to fray; a thin violin line. True silence from 14.95. |
| 15.3–16.1 | A close-up; their eyes close. Everything stops. | A single heartbeat in the silence, then a held breath. |
| 16.1–18.0 | White frame, inverted frame, crimson frame with an ink slash: **the feed shatters**. Grey silhouettes in panels are wiped away into individual people (guitar, games, skating, books, photography, painting). | Impact, glass, timpani, low strings; a driving build. |
| 18.0–20.5 | **The panels rush past the camera** to the protagonist, who looks up. **Colour blooms out from their face**: warm skin, navy hair, crimson headphones, a sunset sky, light leaks. | Harp glissando, glockenspiel, strings open into F major; the theme on piano and violins. |
| 20.5–22.3 | In colour, they share a song; others answer in their own colourful panels. "You were never boring." | The theme continues. |
| 21.85–25.1 | **The manga page shrinks into a phone**, which becomes the real YORU app over night-city bokeh in colour: REI's profile, REI's post, two replies arriving (crimson brackets). Labelled **REAL YORU SCREENS · DEMO ACCOUNTS**. "You were looking for your people." | |
| 25.1–26.95 | **The phone flies into the camera**; crimson lines converge; the official YORU 夜 wordmark (normal logo) with an anamorphic flare. | Riser, timpani roll, deep impact, an orchestral F-major hit. |
| 26.7–30.3 | The protagonist stands in a tall panel in full colour, the others around them; **crimson lines draw a frame**; the camera pulls back. "Someone out there loves the things you love." Then **ink floods** to black. | Warm strings and piano; the city faintly. |
| 30.2–33.0 | "What do you wish more people understood about you?" held for over two seconds on clean black. | Almost nothing: a held chord, two piano notes. |
| 33.0–34.5 | YORU 夜 over soft colour bokeh, "YOUR PEOPLE. YOUR STORY." | Final F(add9) chord and a soft chime. |

## Product integrity

- **Real interface, honestly labelled.** Every phone screen in the YORU section is a real capture of the current app. The accounts (REI, Kuro, Mio) are fictional demo users on a throwaway local database, and the film says so on screen. Their avatars are original drawings. The only changes during capture: the local server's "DEMO MODE" strip is hidden (production never shows it), and the clock is moved 25 days ahead so the date-based Halloween logo isn't shown. The seeded demo home feed never appears.
- **Features shown exist today:** profile "Currently: Listening to…", status, bio, inside jokes, posts, comments and replies.
- **The feed in the problem section is fictional and unbranded** (grey cards, "#trend"). It stands for social media in general, not any real platform.
- **No testimonials, no invented community activity presented as real, no promises.** The film invites people to share what they love; it doesn't claim YORU guarantees friendship.

## Delivery notes

- Captions sit between y ≈ 520 and 1500 (inside TikTok/Reels safe areas) on a soft dark band, readable without sound.
- `out/cover.png` is a dedicated cover (the colour reveal with the title).
- Post copy: `CAPTION.md`.
