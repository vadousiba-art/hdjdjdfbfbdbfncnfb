# YORU reels

Vertical short-form reels (1080x1920, 30 fps) edited in code with Remotion, plus
HyperFrames for the odd asset Remotion can't draw. Not part of the web app.

## Setup (once per machine)

```bash
npm install
npm run setup        # ffmpeg + cmake (brew on Mac, apt on Linux), whisper.cpp in bin/whisper.cpp, base.en model
npx remotion browser ensure
npx hyperframes browser ensure   # HyperFrames renders with Chrome Headless Shell
npx hyperframes telemetry disable
```

## Use

```bash
npm run dev                                                    # Remotion Studio
node scripts/transcribe.mjs public/recordings/take.mp4         # -> public/recordings/take.words.json
npx remotion render src/index.ts <Comp> out/name.mp4 --codec=h264 --crf=17
```

`transcribe.mjs` writes `[{ text, startMs, endMs }]`, one entry per word. It uses
whisper.cpp's DTW alignment and snaps word edges to the voice, and it will not
overwrite a transcript without `--force` (beats anchored to it would move).

## Folders

| Folder | What goes there |
| --- | --- |
| `public/recordings/` | talking-head takes (H.264 mp4) and their `.words.json` |
| `public/screen-recordings/` | screen captures |
| `public/images/` | stills |
| `public/sound pack/`, `public/music pack/` | audio (original files, trimmed in code) |
| `hyperframes/` | one HyperFrames project per asset |
| `brand/` | the brand sheet (`BRAND.md`) and theme code |
| `src/<video>/` | one folder and composition per video, registered in `src/Root.tsx` |
| `out/` | rendered mp4s |

Footage, audio packs, renders and `bin/` stay out of git.
