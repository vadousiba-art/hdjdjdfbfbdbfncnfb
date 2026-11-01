"""A reel's sound, on reel/<project>/edit.json: the cleaned voice cut to the
edit (short fades at every cut), an original score ducked under the voice,
and effects. The score and effects for each project are in
reel/scores/<project>.py (music(ctx) -> mono array, effects(ctx) using ctx.put).

  python3 reel/audio.py <project>

Voice: photos/<project>/clean/<src>.wav (made with ffmpeg: high-pass, FFT
noise reduction, EQ, compression, de-ess, -17 LUFS each, so every take
matches); plan.json "voice_trim" evens out any take that still sits low (dB).
Output: reel/<project>/audio/reel.wav, mastered to about -14 LUFS."""

import importlib
import json
import pathlib
import subprocess
import sys
from types import SimpleNamespace

import numpy as np
from scipy import signal
from scipy.io import wavfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "carousel" / "audio"))
import band  # noqa: E402,F401  (puts film/audio on the path)
from kit import SR  # noqa: E402

PROJECT = sys.argv[1]
E = json.loads((HERE / PROJECT / "edit.json").read_text())
PLAN = json.loads((HERE / PROJECT / "plan.json").read_text())
CLEAN = HERE.parent / "photos" / PROJECT / "clean"
DUR = E["duration"]
N = int(DUR * SR)
beat = {b["id"]: b for b in E["timeline"]}


def cap_at(fragment):
    return next(c for c in E["captions"] if fragment in c["text"])


# ------------------------------------------------------------------ voice
voice = np.zeros(N)
TRIM = {k: 10 ** (v / 20) for k, v in PLAN.get("voice_trim", {}).items()}
src_cache = {}
for b in E["timeline"]:
    if not b["src"]:
        continue
    if b["src"] not in src_cache:
        sr, x = wavfile.read(CLEAN / f"{b['src']}.wav")
        assert sr == SR
        src_cache[b["src"]] = x.astype(np.float64) / 32768 * TRIM.get(b["src"], 1.0)
    x = src_cache[b["src"]]
    for p in b["pieces"]:
        seg = x[int(p["in"] * SR): int(p["out"] * SR)].copy()
        f = min(int(0.012 * SR), len(seg) // 2)
        seg[:f] *= np.linspace(0, 1, f)
        seg[-f:] *= np.linspace(1, 0, f)
        i = int(p["at"] * SR)
        voice[i: i + len(seg)] += seg[: N - i]

# ------------------------------------------------------------------ score and effects
fx = np.zeros(N)


def put(sig, t, gain):
    i = int(t * SR)
    if 0 <= i < N:
        sig = sig if sig.ndim == 1 else sig.mean(axis=1)
        fx[i: i + len(sig)] += sig[: N - i] * gain


score = importlib.import_module(f"scores.{PROJECT}")
ctx = SimpleNamespace(E=E, beat=beat, cap_at=cap_at, DUR=DUR, N=N, put=put)
music = score.music(ctx)
score.effects(ctx)

# ------------------------------------------------------------------ mix: duck the music under the voice
env = np.abs(voice)
env = signal.sosfiltfilt(signal.butter(1, 4 / (SR / 2), output="sos"), env)
active = np.clip(env / (np.percentile(env[env > 1e-4], 60) + 1e-9), 0, 1)
# fast down, slow up
duck = np.zeros_like(active)
a_up, a_dn = np.exp(-1 / (0.35 * SR)), np.exp(-1 / (0.04 * SR))
level = 0.0
for i in range(0, len(active), 48):
    target = active[i]
    coef = a_dn if target > level else a_up
    level = target + (level - target) * coef ** 48
    duck[i: i + 48] = level


def rms(x):
    loud = x[np.abs(x) > 1e-5]
    return np.sqrt(np.mean(loud ** 2)) if len(loud) else 1.0


# the score sits about 6 dB under the voice in the gaps and about 16 dB under it while he talks
music *= rms(voice) * 10 ** (-6 / 20) / rms(music)
fx *= rms(voice) * 10 ** (-10 / 20) / rms(fx)
music_gain = 10 ** (-(10 * duck) / 20)
mix = voice + music * music_gain + fx
fo = int(min(1.2, max(0.15, DUR - E["speech_end"])) * SR)  # the closing fade never reaches back into the voice
mix[-fo:] *= np.linspace(1, 0, fo) ** 1.5
mix = np.stack([mix, mix], 1)

out = HERE / PROJECT / "audio"
out.mkdir(parents=True, exist_ok=True)
tmp = out / "reel-premaster.wav"
wavfile.write(tmp, SR, (np.clip(mix / max(1.0, np.max(np.abs(mix)) * 1.05), -1, 1) * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1.2:LRA=9", "-ar", str(SR), str(out / "reel.wav")], check=True)
tmp.unlink()
print("wrote", out / "reel.wav", f"{DUR:.1f}s")
