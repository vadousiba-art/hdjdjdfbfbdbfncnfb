# my-story

A personal short-form video (1080×1920, 30 fps) edited in code: Canvas 2D in
headless Chromium for the picture, a numpy/scipy sampler for the score, ffmpeg
to encode.

The personal parts stay out of git: the photos and clips (`photos/`), the
timelines with the on-screen text (`film/cues.json`, `carousel/slides.json`),
the script (`SCRIPT.md`) and the renders (`out/`).

| File | Does |
| --- | --- |
| `prep.py` | Crops photos out of phone screenshots of a photo viewer → `photos/cropped/` |
| `film/main.js` | The edit: Ken Burns, grades, crossfades, the crack and fade-out effects, captions, grain, light leaks, the phone montage |
| `film/audio/score.py` | The score, on the same timeline |
| `film/audio/kit.py` | Instruments and mixing shared by both scores (CC0 VSCO-2-CE samples and Mixkit SFX via `never-background/film/audio/bank.py`) |
| `film/render.mjs` | Renders frames and encodes `out/my-story.mp4` (`--stills t1,t2`, `--preview`, `--cover`) |

## Carousel version

The same story as photo-mode slides with stacked white caption boxes, and a
1080×1920 video of those slides (swipe transitions, captions arriving one by
one, an original song cut so every swipe lands on a beat).

| File | Does |
| --- | --- |
| `carousel/prep-clips.sh` | Trims and treats the clips into frame sequences; plates, addresses and the people in the haze clips are never readable |
| `carousel/slides.js` | Draws a slide (1080×1440) or a video frame (1080×1920) |
| `carousel/audio/song.py` | The song, on the slide timeline → `carousel/audio/song.wav` |
| `carousel/audio/band.py` | Beat grid and parts shared by the slide songs |
| `carousel/render.mjs` | `--slides` → `out/carousel/NN.png`; default → `out/story-slides.mp4` |

Part 2 uses the same engine with `--set slides-part2` (`carousel/slides-part2.json`,
`carousel/prep-part2.py` to crop its photos, `carousel/audio/song-part2.py` for its song).

## Talking-head reels

For videos he films himself: `reel/` cuts the takes, grades the footage, lays
B-roll and captions over it, and scores it.

| File | Does |
| --- | --- |
| `carousel/transcribe.py` | Word-timed transcripts of the recordings (faster-whisper, CPU) |
| `reel/grade.py` | Denoise and skin-based colour correction → 30 fps frame sequences |
| `reel/edl.py` | `plan.json` (beats, ranges, captions, B-roll) → `edit.json`, with long pauses cut |
| `reel/vscode.mjs` | An editor screenshot of real YORU source, and a broken version |
| `reel/audio.py` | Voice cut to the edit, a score ducked under it, effects; mastered to -14 LUFS |
| `reel/edit.js`, `reel/render.mjs` | Draws and encodes the reel → `out/part3-reel.mp4` |

The plan, the edit, the footage and the renders stay local (gitignored).
