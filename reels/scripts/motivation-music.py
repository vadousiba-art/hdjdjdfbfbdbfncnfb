"""The soundtrack for the motivation reel: an original dark trap bed, built to the same plan
as the reference video's music (measured 2026-11-06):

  - the hook is dry: no music under it
  - the beat drops on the first word after the hook: 808 on F and E (a half step, E
    Phrygian) with slides, kick, half-time clap, hi-hats with rolls, a dark bell line
    and a low pad, at 152 BPM
  - everything stops dead the moment the last word ends
  - silence, then one huge low boom (pitched on C) on the cut to black

  python3 scripts/motivation-music.py <version>

Reads public/recordings/motivation/<version>/edit.json and writes music.wav (48 kHz
stereo) beside it, timed to that version's words. Nothing here is sampled: every sound is
synthesised below.
"""

import json
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
from scipy import signal

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = sys.argv[1]
OUT = ROOT / "public" / "recordings" / "motivation" / VERSION
EDIT = json.loads((OUT / "edit.json").read_text())
SR = 48000
BPM = 152
STEP = 60 / BPM / 4            # one 16th note
BAR = 16 * STEP
CARD = 1.6                      # the black end card after the a-roll, in seconds
BED_LUFS = -21.0                # the beat, under a -14 LUFS voice
BOOM_PEAK = 10 ** (-2.0 / 20)   # the boom's sample peak
rng = np.random.default_rng(152)

words = EDIT["words"]
drop = next(w for w in words if w["seg"] == 1)["startMs"] / 1000          # first word after the hook
stop = max(w["endMs"] for w in words) / 1000                               # the last word ends
boom_at = EDIT["frames"] / EDIT["fps"]                                     # the cut to black
total = boom_at + CARD
N = int(round(total * SR))


def note(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    return 440.0 * 2 ** ((names[name[:-1]] + 12 * (int(name[-1]) + 1) - 69) / 12)


def place(buf, x, t, gain=1.0):
    i = int(round(t * SR))
    if i >= len(buf) or i + len(x) <= 0:
        return
    a, b = max(0, i), min(len(buf), i + len(x))
    buf[a:b] += gain * x[a - i:b - i]


def env_exp(n, tau, attack=0.003):
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    at = max(1, int(attack * SR))
    e[:at] *= np.linspace(0, 1, at)
    return e


def lowpass(x, hz, order=2):
    b, a = signal.butter(order, hz / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x, hz, order=2):
    b, a = signal.butter(order, hz / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bandpass(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], "band")
    return signal.lfilter(b, a, x)


# ---------------------------------------------------------------- instruments

def bass808(f_to, dur, f_from=None):
    n = int((dur + 0.04) * SR)
    t = np.arange(n) / SR
    if f_from:
        glide = np.clip(t / (dur * 0.55), 0, 1)
        f = f_from * (f_to / f_from) ** glide
    else:
        f = np.full(n, f_to)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) + 0.22 * np.sin(2 * ph)
    e = env_exp(n, 0.55, 0.002)
    rel = int(0.04 * SR)
    e[-rel:] *= np.linspace(1, 0, rel)
    x = np.tanh(2.4 * x * e) / np.tanh(2.4)
    return x


def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 120 * np.exp(-t / 0.03)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.16, 0.001)
    click = highpass(rng.standard_normal(n), 2500) * env_exp(n, 0.004, 0.0005) * 0.25
    return np.tanh(1.8 * (x + click))


def clap():
    n = int(0.5 * SR)
    noise = bandpass(rng.standard_normal(n), 1100, 6500)
    e = np.zeros(n)
    for k, d in enumerate([0.0, 0.009, 0.018]):     # three quick hands, then the tail
        i = int(d * SR)
        e[i:] += env_exp(n - i, 0.012 if k < 2 else 0.16, 0.0005) * (0.7 if k < 2 else 1.0)
    body = np.sin(2 * np.pi * 185 * np.arange(n) / SR) * env_exp(n, 0.05) * 0.35
    return (noise * e * 0.6 + body)


def hat(vel=1.0, tau=0.022):
    n = int(0.12 * SR)
    x = highpass(rng.standard_normal(n), 7200, 3) * env_exp(n, tau, 0.0005)
    return x * 0.35 * vel


def bell(f, dur=1.6):
    n = int(dur * SR)
    t = np.arange(n) / SR
    idx = 0.4 + 2.6 * np.exp(-t / 0.25)
    x = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * 3.5 * t))
    return x * env_exp(n, 0.8, 0.002) * 0.5


def pad(freqs, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f in freqs:
        for cents in (-8, 0, 8):
            fr = f * 2 ** (cents / 1200)
            x += signal.sawtooth(2 * np.pi * fr * t + rng.uniform(0, 6.28))
    x = lowpass(x / (3 * len(freqs)), 850, 2)
    e = np.minimum(1, t / 1.8) * np.minimum(1, (dur - t) / 0.05).clip(0, 1)
    return x * e


def boom():
    n = int(CARD * SR)
    t = np.arange(n) / SR
    f = 33 + 90 * np.exp(-t / 0.09)                      # falls onto a low C-ish rumble
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.55, 0.001)
    tone = np.sin(2 * np.pi * note("C2") * t) * env_exp(n, 0.42, 0.002) * 0.6
    hit = lowpass(rng.standard_normal(n), 320, 2) * env_exp(n, 0.18, 0.0005) * 1.4
    crack = bandpass(rng.standard_normal(n), 800, 5000) * env_exp(n, 0.03, 0.0003) * 0.25
    x = np.tanh(1.6 * (sub + tone + hit + crack))
    tail = int(0.08 * SR)
    x[-tail:] *= np.linspace(1, 0, tail)
    return x


def reverb(x, secs=1.4, mix=0.25):
    n = int(secs * SR)
    ir_l = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (secs / 5))
    ir_r = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (secs / 5))
    ir_l, ir_r = lowpass(ir_l, 6000) / np.sqrt(n), lowpass(ir_r, 6000) / np.sqrt(n)
    wl = signal.fftconvolve(x, ir_l)[: len(x)]
    wr = signal.fftconvolve(x, ir_r)[: len(x)]
    return np.stack([x + mix * 30 * wl, x + mix * 30 * wr])


# ---------------------------------------------------------------- arrangement

# 808 patterns: (16th step, note, length in steps, slide from)
BASS = [
    [(0, "F2", 6, None), (6, "F2", 4, None), (10, "E2", 6, None)],
    [(0, "F2", 4, None), (4, "E2", 3, None), (8, "F#2", 6, "B2"), (14, "F2", 2, None)],
    [(0, "F2", 6, None), (6, "F2", 4, None), (10, "E2", 6, None)],
    [(0, "E2", 6, None), (6, "A2", 4, "A#2"), (12, "F2", 4, None)],
]
KICKS = [[0, 6, 10], [0, 4, 8, 14], [0, 6, 10], [0, 6, 11]]
BELLS = [[(0, "E5"), (4, "F5"), (6, "E5"), (8, "C5"), (12, "B4")],
         [(0, "E5"), (4, "F5"), (6, "G5"), (8, "F5"), (12, "E5")]]

bass_bus = np.zeros(N)
drum_bus = np.zeros(N)
bell_bus = np.zeros(N)
pad_bus = np.zeros(N)

bars = int(np.ceil((stop - drop) / BAR)) + 1
K, C = kick(), clap()
for b in range(bars):
    t0 = drop + b * BAR
    for step, nm, ln, frm in BASS[b % 4]:
        place(bass_bus, bass808(note(nm), ln * STEP, note(frm) if frm else None), t0 + step * STEP, 0.9)
    for step in KICKS[b % 4]:
        place(drum_bus, K, t0 + step * STEP, 0.75)
    place(drum_bus, C, t0 + 8 * STEP, 0.55)                       # half-time clap on 3
    roll = b % 2 == 1
    for step in range(0, 16, 2):
        if roll and step >= 12:
            continue
        place(drum_bus, hat(1.0 if step % 4 == 0 else 0.65), t0 + step * STEP)
    if b % 4 in (1, 3):
        place(drum_bus, hat(0.5), t0 + 13 * STEP)
    if roll:                                                      # triplet roll into the next bar
        for k in range(6):
            place(drum_bus, hat(0.45 + 0.1 * k, 0.015), t0 + 12 * STEP + k * (4 * STEP / 6))
    for step, nm in BELLS[b % 2]:
        place(bell_bus, bell(note(nm)), t0 + step * STEP, 0.32)
    if b % 2 == 0:
        place(pad_bus, pad([note("E3"), note("B3"), note("G4")], 2 * BAR), t0, 0.22)

# the dead stop: everything ends with the last word (5 ms fade, no tails)
cut = int(round(stop * SR))
fade = int(0.005 * SR)
mix_mono = bass_bus + drum_bus
mix_mono[cut:cut + fade] *= np.linspace(1, 0, fade)
mix_mono[cut + fade:] = 0
wet = reverb(bell_bus + pad_bus + 0.25 * drum_bus, 1.6, 0.3)
wet[:, cut:cut + fade] *= np.linspace(1, 0, fade)
wet[:, cut + fade:] = 0
bed = np.stack([mix_mono, mix_mono]) + wet
bed[:, : int(drop * SR)] = 0                                     # the hook stays dry


def lufs(x):
    with tempfile.TemporaryDirectory() as tmp:
        p = pathlib.Path(tmp) / "x.wav"
        write_wav(p, x)
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(p), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
        return float(json.loads(r[r.rindex("{"): r.rindex("}") + 1])["input_i"])


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    pcm = (x.T * 32767).astype("<i2").tobytes()
    import wave
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm)


peak = np.abs(bed).max()
bed /= peak
g = 10 ** ((BED_LUFS - lufs(bed[:, int(drop * SR):cut])) / 20)
bed *= g

bm = boom()
bm = np.stack([bm, bm]) * (BOOM_PEAK / np.abs(bm).max())
i = int(round(boom_at * SR))
bed[:, i:i + bm.shape[1]] += bm[:, : N - i]

write_wav(OUT / "music.wav", bed)
print(f"{VERSION}: drop {drop:.3f}s, stop {stop:.3f}s, boom {boom_at:.3f}s, total {total:.3f}s, "
      f"bed {lufs(bed[:, int(drop * SR):cut]):.1f} LUFS, peak {20 * np.log10(np.abs(bed).max()):.1f} dBFS")
