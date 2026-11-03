"""Builds the edit for a talking-head reel from photos/part3: which stretch of
which recording plays when, the pauses tightened, what's on screen over each
line, and the captions timed to the words (from carousel/transcribe.py).

  python3 reel/edl.py <project>

Reads reel/<project>/plan.json (the beats, their source ranges, captions and
B-roll), writes reel/<project>/edit.json (the timeline the picture and the
sound both read). A beat of kind "insert" has no recording: it lasts "dur"
seconds, its B-roll items start at "t" seconds in, and its captions are
[text, start, end] in seconds from the beat's start.

Pauses longer than GAP inside a line are cut down to a breath, so the speech
keeps moving; each cut also flips the punch-in on face shots."""

import json
import pathlib
import sys

import numpy as np
from scipy.io import wavfile

HERE = pathlib.Path(__file__).resolve().parent
PROJECT = sys.argv[1]
P = HERE.parent / "photos" / PROJECT
PLAN = json.loads((HERE / PROJECT / "plan.json").read_text())
GAP, KEEP_BEFORE, KEEP_AFTER = 0.30, 0.12, 0.2
HOP = 0.01


def level(src):
    """The recording as it will be heard: the cleaned voice when there is one (its compressor lifts word tails)."""
    path = P / "clean" / f"{src}.wav"
    sr, x = wavfile.read(path if path.exists() else P / "wav" / f"{src}.wav")
    return sr, x.astype(np.float64) / 32768


def frames_db(src):
    sr, x = level(src)
    n = int(len(x) / (HOP * sr))
    rms = np.array([np.sqrt(np.mean(x[int(i * HOP * sr): int((i + 1) * HOP * sr)] ** 2)) + 1e-9 for i in range(n)])
    return 20 * np.log10(rms), len(x) / sr


def notch(src, t, side, window=0.08):
    """Move a cut to the quietest 10 ms near it: looking back from a range start, forward from a range end,
    so the search runs into the pause and never into the words being kept."""
    db, _ = frames_db(src)
    lo, hi = (int((t - window) / HOP), int(t / HOP) + 1) if side == "start" else (int(t / HOP), int((t + window) / HOP) + 1)
    lo, hi = max(0, lo), min(len(db), hi)
    return round((lo + int(np.argmin(db[lo:hi]))) * HOP, 3)


def settle(src, b):
    """Move a range end forward out of any sound it lands in, so a last syllable is never clipped:
    to the first 50 ms that sit 30 dB under the speech level, where the word has died away (at most 0.6 s later)."""
    db, length = frames_db(src)
    floor = np.percentile(db, 92) - 30
    i, quiet = int(b / HOP), 0
    while i < len(db) and i < int((b + 0.6) / HOP):
        quiet = quiet + 1 if db[i] < floor else 0
        if quiet >= 5:
            return round((i - 4) * HOP, 3)
        i += 1
    return round(min(length, b + 0.6), 3)


def speech(src, a, b):
    """Spoken stretches of src between a and b (seconds), with the long pauses removed."""
    sr, x = level(src)
    seg = x[int(a * sr): int(b * sr)]
    n = int(len(seg) / (HOP * sr))
    rms = np.array([np.sqrt(np.mean(seg[int(i * HOP * sr): int((i + 1) * HOP * sr)] ** 2)) + 1e-9 for i in range(n)])
    db = 20 * np.log10(rms)
    on = db > np.percentile(db, 92) - 30
    # close tiny gaps and drop clicks
    on = np.convolve(on, np.ones(5), "same") > 0
    runs, i = [], 0
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            runs.append([i * HOP, j * HOP])
            i = j
        else:
            i += 1
    runs = [r for r in runs if r[1] - r[0] > 0.06]
    if not runs:
        return [(a, b)]
    merged = [runs[0]]
    for r in runs[1:]:
        if r[0] - merged[-1][1] < GAP:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [(max(a, a + s - KEEP_BEFORE), min(b, a + e + KEEP_AFTER)) for s, e in merged]


words = {p.stem: [w for s in json.loads(p.read_text()) for w in s["words"]] for p in (P / "wav").glob("*.json")}

timeline, captions, t = [], [], 0.0
for beat in PLAN["beats"]:
    if beat["kind"] == "insert":
        start, end = t, t + beat["dur"]
        broll = [{**item, "at": round(start + item.get("t", 0), 3)} for item in beat.get("broll", [])]
        for j, item in enumerate(broll):
            item["until"] = broll[j + 1]["at"] if j + 1 < len(broll) else end
        captions += [{"text": text, "s": round(start + a, 3), "e": round(start + b, 3)} for text, a, b in beat.get("captions", [])]
        timeline.append({"id": beat["id"], "kind": "insert", "src": None, "start": round(start, 3), "end": round(end, 3),
                         "pieces": [], "broll": broll, "look": beat.get("look", {})})
        t = end
        continue
    # the beat's last range ends wherever the voice really stops; inner cuts move to the nearest quiet spot
    rs = planned = beat["ranges"]  # captions take their words from the ranges as planned
    beat["ranges"] = [[a if a < 0.05 else notch(beat["src"], a, "start"),
                       settle(beat["src"], b) if k == len(rs) - 1 else notch(beat["src"], b, "end")]
                      for k, (a, b) in enumerate(rs)]
    cuts = []
    for a, b in beat["ranges"]:
        cuts += speech(beat["src"], a, b)
    start = t
    pieces = []
    for k, (a, b) in enumerate(cuts):
        pieces.append({"src": beat["src"], "in": round(a, 3), "out": round(b, 3), "at": round(t, 3), "punch": k % 2})
        t += b - a
    end = t

    def to_out(s, snap="next", pieces=pieces):
        """Source time -> output time. Word timings can land in a removed pause:
        a start snaps to the next piece, an end to the one before."""
        for p in pieces:
            if p["in"] - 0.05 <= s <= p["out"] + 0.05:
                return p["at"] + min(max(s, p["in"]), p["out"]) - p["in"]
        if snap == "next":
            nxt = [p for p in pieces if p["in"] > s]
            return nxt[0]["at"] if nxt else None
        prev = [p for p in pieces if p["out"] < s]
        return prev[-1]["at"] + prev[-1]["out"] - prev[-1]["in"] if prev else None

    # captions: each phrase takes the next n words of this beat's recording (in order, inside its ranges)
    ws = [w for w in words[beat["src"]] if any(a - 0.05 <= w["s"] <= b for a, b in planned)]
    i = 0
    for text, n in beat["captions"]:
        chunk = ws[i: i + n]
        i += n
        s, e = to_out(chunk[0]["s"]), to_out(chunk[-1]["e"], "prev")
        if s is None or e is None:
            raise SystemExit(f"caption {text!r} falls in a cut")
        # each word's start, for word-by-word caption styles
        times = [to_out(w["s"]) for w in chunk]
        times = [round(max(s, x if x is not None else s), 3) for x in times]
        captions.append({"text": text, "s": round(s, 3), "e": round(e, 3), "words": times})
    if i != len(ws):
        raise SystemExit(f"{beat['id']}: captions use {i} words, the recording has {len(ws)}: {[w['w'] for w in ws]}")
    # B-roll: each item starts on a word (by index into this beat's words) or at the beat start
    broll = []
    for item in beat.get("broll", []):
        at = start if item.get("word") is None else to_out(ws[item["word"]]["s"]) - 0.06
        broll.append({**item, "at": round(at, 3)})
    for j, item in enumerate(broll):
        item["until"] = broll[j + 1]["at"] if j + 1 < len(broll) else (end if item.get("hold", True) else item["at"] + item.get("dur", 1))
    timeline.append({"id": beat["id"], "kind": beat["kind"], "src": beat["src"], "start": round(start, 3), "end": round(end, 3),
                     "pieces": pieces, "broll": broll, "look": beat.get("look", {})})

# keep captions from overlapping: each one ends where the next begins
for a, b in zip(captions, captions[1:]):
    a["e"] = round(min(max(a["e"], a["s"] + 0.35), b["s"]), 3)
tail = PLAN.get("tail", 0)
out = {"fps": 30, "duration": round(t + tail, 3), "speech_end": round(t, 3), "timeline": timeline, "captions": captions,
       "titles": PLAN.get("titles", []), "end_card": PLAN.get("end_card"), "fade_out": PLAN.get("fade_out", True),
       "style": PLAN.get("style", {})}
(HERE / PROJECT / "edit.json").write_text(json.dumps(out, indent=1))
for b in timeline:
    print(f"{b['id']:8s} {b['start']:6.2f}–{b['end']:6.2f}  {len(b['pieces'])} pieces  broll {[x.get('img') or x.get('type') for x in b['broll']]}")
print(f"speech {t:.2f}s, total {t + tail:.2f}s, {len(captions)} captions")
