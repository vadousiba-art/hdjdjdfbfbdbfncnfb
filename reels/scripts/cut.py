"""Cuts the talking-head a-roll for each version of a video, from src/<video>/cut.json.

  python3 scripts/cut.py <video> [version ...]

For every segment (a clip and a range in ms) it keeps the speech and removes each pause
longer than `gap` (keeping `keep_before`/`keep_after` of air around the words), unless the
segment is marked "raw". Clips are graded (gamma from cut.json) and lightly denoised; the
voice is cleaned, then levelled to -14 LUFS. Writes, per version:

  public/recordings/<video>/<version>/aroll.mp4   the cut a-roll, H.264 + AAC, 30 fps
  public/recordings/<video>/<version>/edit.json   segments and words on the output timeline

Takes come from public/recordings/<video>/<clip>.mp4 with <clip>.words.json beside them."""

import json
import pathlib

import numpy as np
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
VIDEO = sys.argv[1]
PLAN = json.loads((ROOT / "src" / VIDEO / "cut.json").read_text())
REC = ROOT / "public" / "recordings" / VIDEO
FPS = PLAN.get("fps", 30)
GAP, BEFORE, AFTER = PLAN.get("gap", 100), PLAN.get("keep_before", 50), PLAN.get("keep_after", 80)
RNN = ROOT / "bin" / "models" / "cb.rnnn"
VOICE = (
    f"highpass=f=70,arnndn=m={RNN}:mix=0.85,afftdn=nr=6:nf=-50,"
    "equalizer=f=120:t=q:w=1:g=2.5,equalizer=f=300:t=q:w=1.2:g=-3,equalizer=f=3200:t=q:w=1.3:g=3,"
    "equalizer=f=10000:t=h:w=0.7:g=2,acompressor=threshold=-24dB:ratio=3.5:attack=5:release=120:makeup=5,deesser=i=0.4"
)


def words_of(clip):
    w = json.loads((REC / f"{clip}.words.json").read_text())
    for i, x in enumerate(w):
        x["i"] = i
    for x in PLAN.get("add_words", {}).get(clip, []):
        w.append({**x, "i": len(w)})
    return sorted(w, key=lambda x: x["startMs"])


_LOUD = {}


def loudness(clip):
    """Per 10 ms: is the voice on? (the 80 ms from there are loud on average, like transcribe.mjs)"""
    if clip not in _LOUD:
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(REC / f"{clip}.mp4"), "-vn", "-ac", "1", "-ar", "16000",
                              "-f", "s16le", "-"], capture_output=True, check=True).stdout
        a = np.frombuffer(raw, np.int16).astype(float)
        rms = np.sqrt(np.mean(a[: len(a) // 160 * 160].reshape(-1, 160) ** 2, axis=1))
        quiet = max(300.0, np.percentile(rms, 95) * 0.12)
        win = np.convolve(rms, np.ones(8) / 8, mode="full")[7:7 + len(rms)]
        _LOUD[clip] = win >= quiet
    return _LOUD[clip]


def split_silences(clip, s, e):
    """Cut every silence inside [s, e] longer than the gap, keeping a little air on each side."""
    loud = loudness(clip)
    out, cur = [], s
    t = s
    while t < e:
        i = int(t // 10)
        if i < len(loud) and not loud[i]:
            q = t
            while t < e and int(t // 10) < len(loud) and not loud[int(t // 10)]:
                t += 10
            if t - q > GAP + BEFORE + AFTER and q > s and t < e:
                out.append((cur, q + AFTER))
                cur = t - BEFORE
        t += 10
    out.append((cur, e))
    return [(x, y) for x, y in out if y - x >= 60]


def keep_ranges(seg, words):
    """The parts of a segment to keep, in source ms."""
    a, b = seg["from"], seg["to"]
    if seg.get("raw"):
        return [(a, b)]
    return [r for s, e in word_ranges(seg, words) for r in split_silences(seg["clip"], s, e)]


def word_ranges(seg, words):
    a, b = seg["from"], seg["to"]
    inside = [w for w in words if w["endMs"] > a and w["startMs"] < b]
    if not inside:
        return [(a, b)]
    out, s, e = [], max(a, inside[0]["startMs"] - BEFORE), inside[0]["endMs"]
    for w in inside[1:]:
        if w["startMs"] - e > GAP:
            out.append((s, min(b, e + AFTER)))
            s = max(a, w["startMs"] - BEFORE)
        e = max(e, w["endMs"])
    out.append((s, min(b, e + AFTER)))
    return out


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"{cmd[0]} failed:\n{r.stderr[-3000:]}")
    return r


def build(version):
    out_dir = REC / version
    out_dir.mkdir(parents=True, exist_ok=True)
    ranges, segments, words_out = [], [], []
    t_frames = 0
    for n, seg in enumerate(PLAN["versions"][version]):
        clip = seg["clip"]
        words = words_of(clip)
        used = set()
        for s, e in keep_ranges(seg, words):
            sf, ef = round(s / 1000 * FPS), round(e / 1000 * FPS)
            if ef <= sf:
                continue
            out0 = t_frames * 1000 / FPS
            ranges.append((clip, sf, ef))
            segments.append({"seg": n, "clip": clip, "srcStartMs": sf * 1000 / FPS, "srcEndMs": ef * 1000 / FPS,
                             "outStartMs": out0, "outEndMs": (t_frames + ef - sf) * 1000 / FPS,
                             "faceY": PLAN["clips"].get(clip, {}).get("face_y")})
            src0 = sf * 1000 / FPS
            for w in words:
                # a word belongs to the first range it is heard in (its start clamped to the range)
                ws = max(w["startMs"], src0)
                if w["i"] not in used and w["endMs"] > src0 and src0 <= ws < ef * 1000 / FPS:
                    used.add(w["i"])
                    words_out.append({"seg": n, "clip": clip, "i": w["i"], "text": w["text"],
                                      "startMs": round(out0 + ws - src0), "endMs": round(out0 + min(w["endMs"], ef * 1000 / FPS) - src0)})
            t_frames += ef - sf
    # video + audio in one pass: every range is its own input, trimmed on frames
    inputs, chains, cat = [], [], []
    for k, (clip, sf, ef) in enumerate(ranges):
        inputs += ["-i", str(REC / f"{clip}.mp4")]
        g = PLAN["clips"].get(clip, {}).get("gamma", 1)
        d = (ef - sf) / FPS
        chains.append(f"[{k}:v]trim=start_frame={sf}:end_frame={ef},setpts=PTS-STARTPTS,"
                      f"eq=gamma={g}:contrast=1.04:saturation=1.06,hqdn3d=1.5:1.5:6:6[v{k}]")
        chains.append(f"[{k}:a]atrim=start={sf / FPS:.6f}:end={ef / FPS:.6f},asetpts=PTS-STARTPTS,"
                      f"afade=t=in:d=0.006,afade=t=out:st={max(0, d - 0.006):.6f}:d=0.006[a{k}]")
        cat.append(f"[v{k}][a{k}]")
    graph = ";".join(chains) + f";{''.join(cat)}concat=n={len(ranges)}:v=1:a=1[v][a]"
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[v]", "-c:v", "libx264", "-crf", "16",
             "-preset", "medium", "-pix_fmt", "yuv420p", "-r", str(FPS), str(tmp / "v.mp4"), "-map", "[a]", "-ar", "48000",
             "-ac", "1", str(tmp / "raw.wav")])
        run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp / "raw.wav"), "-af", VOICE, "-ar", "48000", str(tmp / "voice.wav")])
        # two-pass loudnorm to -14 LUFS, true peak -1.5 dB
        m = run(["ffmpeg", "-hide_banner", "-i", str(tmp / "voice.wav"), "-af", "loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json", "-f", "null", "-"]).stderr
        j = json.loads(m[m.rindex("{"): m.rindex("}") + 1])
        ln = (f"loudnorm=I=-14:TP=-1.5:LRA=7:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
              f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
        run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp / "v.mp4"), "-i", str(tmp / "voice.wav"), "-af", ln, "-map", "0:v", "-map", "1:a",
             "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-shortest", str(out_dir / "aroll.mp4")])
    frames = t_frames
    (out_dir / "edit.json").write_text(json.dumps({"fps": FPS, "frames": frames, "durationMs": frames * 1000 / FPS,
                                                   "segments": segments, "words": words_out}, indent=1))
    print(f"{version}: {len(ranges)} cuts, {frames / FPS:.2f} s, {len(words_out)} words")


for v in sys.argv[2:] or list(PLAN["versions"]):
    build(v)
