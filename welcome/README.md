# YORU welcome film — production

Source for "Enter the Night" (80 s) and "Tonight on YORU" (26 s). See
`STORYBOARD.md` for the creative plan and `../docs/welcome.md` for how the
app uses the film.

## Toolchain (all local, free)

| Need | Tool |
|---|---|
| Real app screens | Playwright driving a local demo-mode YORU server (`capture/`) |
| Original artwork and manga effects | Canvas 2D, procedural (`manga.js`, `capture/art.mjs`) |
| Official logo as vectors | `assets/trace_wordmark.py` (scikit-image) traces `assets/wordmark.png` |
| Composition and motion | `film.js`, a deterministic canvas renderer (`window.renderFrame(t)`) |
| Score and sound design | `audio/synth.py` (numpy + scipy) |
| Render | `render.mjs`: headless Chromium frame by frame into ffmpeg |
| Web delivery | `encode.sh`: VP9/Opus WebM + H.264/AAC MP4, posters, link image |

Blender, After Effects and Resolve aren't needed (and weren't available).

## Rebuild everything

```bash
cd welcome
capture/server.sh                       # fresh local demo server on :3200 (never production)
node capture/art.mjs                    # original post artwork
node capture/capture.mjs                # cast, scene data, phone + desktop screenshots
node capture/tall.mjs                   # the scrolling feed without fixed bars
python3 assets/trace_wordmark.py        # vector wordmark
python3 audio/synth.py                  # audio/welcome-{full,short}.wav
node render.mjs --o land --cut full     # out/yoru-welcome-full-land.mp4 (about 20 min)
node render.mjs --o port --cut full
node render.mjs --o land --cut short
node render.mjs --o port --cut short
bash encode.sh                          # -> ../public/welcome/v1/
```

Captured screens (`assets/screens/`) and the rendered soundtracks (`audio/*.wav`) are
not committed; the commands above regenerate them. The finished web files are
committed in `../public/welcome/v1/`.

Stills for review: `node render.mjs --o port --cut full --stills 8.4,26.6,58`.

The timeline lives in `../src/lib/welcome/cues.json` and is read by the
picture, the score and the app's captions, so a change there moves all three.
