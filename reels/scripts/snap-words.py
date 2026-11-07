"""Snap the first word after each pause to the moment the voice comes back.

  python3 scripts/snap-words.py <video> <clip> [<clip> ...]

Whisper's DTW timestamps drift around pauses: the word after a dramatic pause is often
placed inside the pause (so its caption would appear before it's said). This finds every
pause (voice off for at least MIN_PAUSE ms, measured like transcribe.mjs: 80 ms RMS
window, quiet threshold = max(300, 0.12 x p95)) and moves the start of the word that
belongs to it onto the voice onset. Only those words change; the text and word list stay
the same, so anything keyed by word index keeps working.

The first run keeps the untouched transcript as <clip>.whisper.json and every run starts
from it, so running this twice gives the same result.
"""

import json
import pathlib
import subprocess
import sys

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
REC = ROOT / "public" / "recordings" / sys.argv[1]
MIN_PAUSE = 150   # ms of silence that counts as a pause
BEFORE = 300      # a word up to this far before the pause can belong to it
AFTER = 250       # ...or up to this far after the voice comes back


def voice(clip):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(REC / f"{clip}.mp4"), "-vn", "-ac", "1", "-ar", "16000",
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.int16).astype(float)
    rms = np.sqrt(np.mean(a[: len(a) // 160 * 160].reshape(-1, 160) ** 2, axis=1))
    quiet = max(300.0, np.percentile(rms, 95) * 0.12)
    win = np.convolve(rms, np.ones(8) / 8, mode="full")[7:7 + len(rms)]
    return win >= quiet  # per 10 ms


def pauses(on):
    out, i = [], 0
    while i < len(on):
        if not on[i]:
            j = i
            while j < len(on) and not on[j]:
                j += 1
            if (j - i) * 10 >= MIN_PAUSE and j < len(on):
                out.append((i * 10, j * 10))  # silence from, voice back at
            i = j
        else:
            i += 1
    return out


for clip in sys.argv[2:]:
    orig = REC / f"{clip}.whisper.json"
    cur = REC / f"{clip}.words.json"
    if not orig.exists():
        orig.write_text(cur.read_text())
    words = json.loads(orig.read_text())
    on = voice(clip)
    for p0, p1 in pauses(on):
        cand = [k for k, w in enumerate(words) if p0 - BEFORE <= w["startMs"] <= p1 + AFTER]
        # the word that starts the speech after this pause: the last candidate starting before the voice is back
        before = [k for k in cand if words[k]["startMs"] <= p1]
        k = before[-1] if before else (cand[0] if cand else None)
        if k is None or words[k]["startMs"] == p1:
            continue
        w = words[k]
        if k > 0 and words[k - 1]["startMs"] >= p1:
            continue
        print(f"{clip} #{k} {w['text']!r}: {w['startMs']} -> {p1} ms (pause {p0}-{p1})")
        if k > 0 and words[k - 1]["endMs"] > p0:
            words[k - 1]["endMs"] = max(words[k - 1]["startMs"] + 60, p0)
        w["startMs"] = p1
        w["endMs"] = max(w["endMs"], p1 + 60)
    cur.write_text(json.dumps(words, indent=1))
