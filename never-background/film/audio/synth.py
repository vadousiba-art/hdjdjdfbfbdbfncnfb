"""Score and sound design for YORU — "You were never a background character." (v2, 34.5 s)

Real instruments from VS Chamber Orchestra: Community Edition (CC0): upright
piano, violin/viola/cello sections, contrabass, harp, glockenspiel, timpani.
Sound effects from Mixkit (Mixkit Sound Effects Free License). Electronic
pulse, drums, risers and reverb are synthesized here. Everything is placed on
cues.json, the timeline the picture uses. D minor; F major from the moment
colour comes back.

  0–3.95    near silence: a distant crowd, phones buzzing, paper falling
  3.95–14.95 a fragile piano; strings creep in; a pulse grows; the piano frays
  14.95–15.45 silence. A single heartbeat. A held breath.
  16.1      the impact: shatter, timpani, low strings; a driving build
  18.95     colour: harp, glockenspiel, strings open into F major, the theme
  25.55     the logo hit
  26.7–30.2 warm and hopeful; 30.2–33 almost nothing under the question
  33–34.5   final chord

Output: film/audio/never-background.wav (48 kHz stereo 16-bit).
Needs ./fetch-assets.sh first.
"""

import json
import pathlib
import sys
import wave

import numpy as np
from scipy import signal

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import bank as B  # noqa: E402

FILM = pathlib.Path(__file__).resolve().parent.parent
C = json.loads((FILM / "cues.json").read_text())
SR = B.SR
DUR = C["duration"]
N = int(round(DUR * SR))
TAIL = 4 * SR
BEAT = 60.0 / C["bpm"]
rng = np.random.default_rng(2026)
BANK = B.build()

dry = np.zeros((N + TAIL, 2))
verb = np.zeros((N + TAIL, 2))


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def stereo(sig, pan=0.0):
    if sig.ndim == 2:
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        return sig * np.array([l, r]) * np.sqrt(2)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.stack([sig * l, sig * r], 1) * np.sqrt(2)


def place(sig, at, gain=1.0, pan=0.0, send=0.0):
    sig = stereo(sig, pan)
    i = int(round(at * SR))
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(len(dry), i + len(sig))
    if i >= j:
        return
    seg = sig[: j - i] * gain
    dry[i:j] += seg
    if send:
        verb[i:j] += seg * send


def env(t, a=0.002, d=0.3):
    return np.minimum(1.0, t / max(a, 1e-6)) * np.exp(-t / d)


def fade(x, a=0.01, r=0.3):
    n = len(x)
    e = np.ones(n)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        e[:na] = np.linspace(0, 1, na)
    if nr:
        e[n - nr:] *= np.linspace(1, 0, nr) ** 1.5
    return x * (e[:, None] if x.ndim == 2 else e)


def filt(x, kind, f, order=2):
    nyq = SR / 2
    wn = [min(v / nyq, 0.99) for v in f] if isinstance(f, (list, tuple)) else min(f / nyq, 0.99)
    return signal.sosfilt(signal.butter(order, wn, btype=kind, output="sos"), x, axis=0)


NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}


def m(name):
    return 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]


def midi_hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ------------------------------------------------------------------ instruments
def nearest(inst, note, layer=None):
    rows = BANK[inst]
    if layer is not None:
        rows = [r for r in rows if r["layer"] == layer] or BANK[inst]
    r = min(rows, key=lambda r: (abs(r["midi"] - note), r["layer"]))
    return r


def piano(name, dur=2.5, vel=0.6):
    n = m(name) if isinstance(name, str) else name
    layer = 1 if vel < 0.4 else 2 if vel < 0.75 else 3
    r = nearest("piano", n, layer)
    x = B.shift(B.sample(r["file"]), n - r["midi"])
    x = x[: int((dur + 0.6) * SR)]
    return fade(x, 0.001, min(0.6, dur * 0.5)) * (0.6 + 0.5 * vel)


def strings(inst, name, dur, vel=0.6, attack=0.25, release=0.6, start=0.12):
    n = m(name) if isinstance(name, str) else name
    layer = None
    if inst in ("violins", "violas"):
        layer = 1 if vel < 0.6 else 2
    elif inst in ("cellos", "basses"):
        layer = 1 if vel < 0.6 else 3
    r = nearest(inst, n, layer)
    x = B.sample(r["file"])
    x = x[int(start * SR):]
    x = B.shift(x, n - r["midi"])
    need = int((dur + release) * SR)
    if len(x) < need:  # extend long notes with a crossfaded loop of the body
        body = x[int(0.6 * SR): int(min(len(x), 6 * SR))]
        while len(x) < need:
            k = int(0.25 * SR)
            ramp_ = np.linspace(0, 1, k)[:, None]
            x = np.vstack([x[:-k], x[-k:] * (1 - ramp_) + body[:k] * ramp_, body[k:]])
    x = x[:need]
    return fade(x, attack, release) * vel


def section(notes, dur, vel=0.5, **kw):
    """A string chord: notes are (inst, note) pairs."""
    parts = [strings(inst, nm, dur, vel, **kw) for inst, nm in notes]
    n = max(len(x) for x in parts)
    out = np.zeros((n, 2))
    for x in parts:
        out[: len(x)] += x
    return out / np.sqrt(len(parts))


def harp(name, vel=0.7):
    n = m(name)
    r = nearest("harp", n)
    x = B.shift(B.sample(r["file"]), n - r["midi"])[: int(3.5 * SR)]
    return fade(x, 0.001, 1.0) * vel


def glock(name, vel=0.5):
    n = m(name)
    r = nearest("glock", n)
    x = B.shift(B.sample(r["file"]), n - r["midi"])[: int(3.0 * SR)]
    return fade(x, 0.001, 1.2) * vel


def timpani(roll=False, idx=0):
    files = BANK["timpani_roll" if roll else "timpani_hit"]
    return B.sample(files[idx % len(files)])


def sfx(i, start=0.0, dur=None):
    x = B.load_mp3(B.STOCK / "sfx" / f"{i}.mp3")
    x = x[int(start * SR):]
    if dur:
        x = x[: int(dur * SR)]
    return x


def kick(f0=95, f1=42, d=0.4):
    t = tt(d)
    ph = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t / 0.045)) / SR
    return np.sin(ph) * env(t, 0.001, 0.2) + filt(rng.standard_normal(len(t)), "highpass", 3000) * env(t, 0.0005, 0.005) * 0.3


def hat(d=0.06):
    t = tt(d)
    return filt(rng.standard_normal(len(t)), "highpass", 8000) * env(t, 0.0005, 0.02)


def clap(d=0.3):
    t = tt(d)
    n = filt(rng.standard_normal(len(t)), "bandpass", [900, 5000])
    e = sum(env(np.maximum(0, t - o), 0.001, 0.02) * (t >= o) for o in (0, 0.012, 0.024)) + env(t, 0.03, 0.12) * 0.6
    return n * e


# ------------------------------------------------------------------ 0 – 3.95: the room
crowd = filt(sfx(444, 12.0, 6.0), "lowpass", 900)
crowd = filt(crowd, "highpass", 150)
place(fade(crowd, 0.9, 1.6), 0.15, 0.2, 0, 0.3)
for at, pan in ((0.75, -0.6), (1.45, 0.55), (2.2, -0.25), (2.85, 0.7)):
    t = tt(0.32)
    buzz = np.sign(np.sin(2 * np.pi * 168 * t)) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 9 * t)))
    place(filt(buzz, "bandpass", [120, 800]) * env(t, 0.01, 0.2), at, 0.018, pan, 0.4)
for i, at in enumerate((0.4, 1.1, 1.9, 2.6, 3.3)):
    place(sfx(2380), at, 0.06, (-1) ** i * 0.5, 0.4)

# ------------------------------------------------------------------ 3.95 – 14.95: fragile piano, strings, the pulse
P0 = C["piano1"]
mel = [  # (beat, note, beats)
    (0, "A4", 1.5), (1.5, "F4", 0.5), (2, "E4", 1), (3, "D4", 1.8),
    (4.5, "C5", 1.5), (6, "Bb4", 0.5), (6.5, "A4", 1), (7.5, "F4", 1.6),
    (9, "A4", 1.2), (10.2, "G4", 0.5), (10.7, "F4", 0.8), (11.5, "E4", 1.5),
    (13, "D4", 0.6), (13.6, "E4", 0.6), (14.2, "F4", 1.3),
]
for b, nm, d in mel:
    at = P0 + b * BEAT
    if at > C["hush"][0] - 0.1:
        continue
    place(piano(nm, d * BEAT + 1.2, 0.42), at, 0.55, 0.1, 0.5)
for b, nm in ((0, "D3"), (4.5, "Bb2"), (9, "F2"), (11.5, "C3"), (13, "A2")):
    place(piano(nm, 4.0, 0.3), P0 + b * BEAT, 0.42, -0.15, 0.45)
# frayed piano doubles (bit-crushed, saturated) from the typing onward
for b, nm, d in mel[6:]:
    at = P0 + b * BEAT
    if at > C["hush"][0] - 0.1:
        continue
    k = np.clip((at - 9.0) / 5.0, 0, 1)
    p = piano(nm, d * BEAT + 0.8, 0.5)
    crushed = np.tanh(np.round(p * 14) / 14 * 3) * 0.5
    place(filt(crushed, "bandpass", [350, 3000]), at + 0.025, 0.25 * k, -0.35, 0.6)
# strings: cellos under the scroll, violas with the things they love, a thin tense violin line later
place(strings("cellos", "D3", 4.6, 0.35, attack=1.4, release=1.2), 5.0, 0.5, -0.3, 0.6)
place(strings("basses", "D2", 4.6, 0.3, attack=1.6, release=1.2), 5.2, 0.4, -0.2, 0.5)
place(strings("violas", "F3", 3.0, 0.35, attack=0.9, release=1.0), 7.3, 0.42, 0.3, 0.6)
place(strings("violas", "A3", 3.0, 0.3, attack=0.9, release=1.0), 7.3, 0.36, 0.35, 0.6)
place(strings("cellos", "Bb2", 3.2, 0.38, attack=0.8, release=1.0), 9.3, 0.5, -0.3, 0.6)
place(strings("cellos", "A2", 3.6, 0.4, attack=0.8, release=0.6), 12.0, 0.5, -0.3, 0.6)
v1 = strings("violins", "A5", 3.6, 0.3, attack=2.2, release=0.4)
place(v1, 11.4, 0.34, 0.25, 0.7)
v2 = strings("violins", "Bb5", 2.0, 0.25, attack=1.6, release=0.3)
place(v2, 13.1, 0.26, -0.25, 0.7)
# the pulse: a muffled sub on eighth notes, growing
t0, t1 = 9.3, C["hush"][0]
for i in range(int((t1 - t0) / (BEAT / 2))):
    at = t0 + i * BEAT / 2
    k = (at - t0) / (t1 - t0)
    t = tt(0.3)
    p = np.sin(2 * np.pi * 55 * t) * env(t, 0.004, 0.12) + 0.3 * np.sin(2 * np.pi * 110 * t) * env(t, 0.002, 0.05)
    place(filt(p, "lowpass", 260 + 900 * k), at, (0.05 + 0.22 * k) * (1.0 if i % 2 == 0 else 0.55), 0, 0.15)

# foley
for i in range(6):  # thumb scrolls
    at = C["scroll"][0] + 0.15 + i * 0.45
    if C["favHold"][0] < at < C["favHold"][1]:
        continue
    t = tt(0.18)
    place(filt(rng.standard_normal(len(t)), "bandpass", [1200, 5000]) * np.sin(np.pi * t / 0.18) ** 2, at, 0.025, 0.2, 0.2)
place(sfx(1492), C["trendWave"][0] - 0.55, 0.22, 0, 0.3)  # the same-y trend wave
place(sfx(2350), C["noteRise"][0] - 0.05, 0.3, -0.2, 0.6)  # the note escapes
for at in C["interests"]:
    place(sfx(1104), at - 0.05, 0.5, rng.uniform(-0.4, 0.4), 0.4)
    place(piano("A6", 1.2, 0.25), at, 0.15, 0.3, 0.7)
place(sfx(1492), C["slideUp"][0] - 0.75, 0.12, 0.2, 0.2)
typ = sfx(1393, 0.0, C["typeText"][1] - C["typeText"][0])
place(fade(typ, 0.01, 0.05), C["typeText"][0], 0.55, 0.3, 0.1)
for i in range(10):
    at = C["deleteText"][0] + (C["deleteText"][1] - C["deleteText"][0]) * i / 10
    t = tt(0.05)
    place(filt(rng.standard_normal(len(t)), "bandpass", [900, 2600]) * env(t, 0.0005, 0.01), at, 0.06, 0.3, 0.1)
place(sfx(1492), C["slideDown"][0] - 0.75, 0.12, -0.2, 0.2)
for i, at in enumerate([11.62, 11.78, 11.92, 12.1, 12.26]):  # the group laughing, far away
    t = tt(0.17)
    f = 260 + (i % 3) * 45
    hah = np.sin(2 * np.pi * f * t * (1 - 0.12 * t)) * filt(rng.standard_normal(len(t)), "lowpass", 1400) * env(t, 0.01, 0.07)
    place(filt(hah, "lowpass", 1000), at, 0.06, 0.5 - i * 0.2, 0.7)
place(sfx(1492), C["slideUp2"][0] - 0.75, 0.12, 0.2, 0.2)
t = tt(0.06)
place(filt(rng.standard_normal(len(t)), "bandpass", [1500, 5000]) * env(t, 0.0005, 0.01), C["sendTap"], 0.1, 0.2)
t = tt(0.5)
place(np.sin(2 * np.pi * (900 - 600 * t) * t) * env(t, 0.005, 0.18), C["sendTap"] + 0.02, 0.05, 0, 0.5)
place(sfx(1486, 0.0, 2.4), C["ink1"][0] - 0.55, 0.2, 0, 0.4)  # sinking under the ink
rain = filt(sfx(1253, 3.0, 3.2), "lowpass", 5000)
place(fade(rain, 0.5, 0.45), C["alone"][0] - 0.2, 0.55, 0, 0.1)

# ------------------------------------------------------------------ 14.95 – 16.1: silence, a heartbeat, a held breath
place(sfx(490), C["heartbeat"] - 0.02, 0.9, 0, 0.3)
imp = sfx(788)
PEAK788 = 2.18
lead_in = C["impact"] - (C["hush"][1])  # the impact's own rising whoosh, from the end of the silence
breath = imp[int((PEAK788 - lead_in) * SR):].copy()
nl = int(lead_in * SR)
breath[:nl] *= (np.linspace(0, 1, nl) ** 2.5)[:, None]  # stays under the heartbeat, then swells into the hit
place(fade(breath, 0.05, 0.8), C["hush"][1], 1.0, 0, 0.35)

# ------------------------------------------------------------------ 16.1: the impact, the build
I0 = C["impact"]
place(sfx(759), I0, 0.55, 0.1, 0.3)  # glass
place(timpani(False, 3), I0, 1.2, 0, 0.4)
place(section([("cellos", "D3"), ("basses", "D2"), ("violas", "A3")], 0.9, 0.9, attack=0.01, release=0.5), I0, 0.9, 0, 0.4)
t = tt(2.5)
place(np.sin(2 * np.pi * np.cumsum(30 + 40 * np.exp(-t / 0.18)) / SR) * env(t, 0.001, 0.9), I0, 0.55, 0, 0.3)
for i in range(16):  # shards
    t = tt(0.2)
    f = rng.uniform(3500, 9000)
    sh = np.sin(2 * np.pi * f * t) * env(t, 0.0005, 0.05) + filt(rng.standard_normal(len(t)), "highpass", 5000) * env(t, 0.0005, 0.02)
    place(sh, I0 + 0.08 + rng.uniform(0, 0.7), 0.035, rng.uniform(-0.9, 0.9), 0.6)

# the groove from the impact to the logo (84 BPM)
G0, G1 = I0, C["logo"][0]
chords = [  # (start, [(inst, note)...], bass)
    (I0, ["D4", "F4", "A4"], "D2"),
    (I0 + 2 * BEAT, ["D4", "F4", "Bb4"], "Bb1"),
    (C["bloom"][0], ["F4", "A4", "C5"], "F2"),
    (C["bloom"][0] + 2 * BEAT, ["E4", "G4", "C5"], "C2"),
    (C["bloom"][0] + 4 * BEAT, ["D4", "F4", "A4"], "D2"),
    (C["bloom"][0] + 6 * BEAT, ["D4", "F4", "Bb4"], "Bb1"),
    (C["bloom"][0] + 8 * BEAT, ["F4", "A4", "C5"], "F2"),
    (C["bloom"][0] + 10 * BEAT, ["E4", "G4", "C5"], "C2"),
]
for i, (st, ch, bass) in enumerate(chords):
    en = chords[i + 1][0] if i + 1 < len(chords) else G1 + 0.3
    if st >= G1:
        break
    dur = en - st
    major = st >= C["bloom"][0] - 0.01
    vel = 0.55 if major else 0.45
    hi = [("violins", nm[:-1] + str(int(nm[-1]) + 1)) for nm in ch] if major else [("violas", nm) for nm in ch]
    place(section(hi, dur, vel, attack=0.35 if major else 0.2, release=0.5), st, 0.42, 0.15, 0.55)
    place(section([("cellos", ch[0][:-1] + str(int(ch[0][-1]) - 1)), ("basses", bass[:-1] + str(int(bass[-1]) + 1))], dur, vel, attack=0.15, release=0.4), st, 0.5, -0.2, 0.45)
    # driving low-string ostinato (eighths), short notes from the sustained samples
    for e in range(int(dur / (BEAT / 2))):
        at = st + e * BEAT / 2
        s = strings("cellos", bass[:-1] + str(int(bass[-1]) + 1), BEAT * 0.38, 0.75, attack=0.01, release=0.08, start=0.05)
        place(s, at, 0.32 if e % 2 == 0 else 0.22, -0.4, 0.2)
nb = int((G1 - G0) / BEAT)
for b in range(nb):
    at = G0 + b * BEAT
    place(kick(), at, 0.5 if b % 2 == 0 else 0.36, 0)
    if b % 2 == 1:
        place(clap(), at, 0.22, 0.05, 0.35)
    for s8 in range(2):
        place(hat(), at + s8 * BEAT / 2, 0.05 if s8 else 0.07, 0.35)
    if b % 4 == 0:
        place(timpani(False, b), at, 0.55, -0.25, 0.4)

# colour returns: harp glissando, glockenspiel, the theme
B0 = C["bloom"][0]
gl = ["F3", "A3", "C4", "F4", "A4", "C5", "F5", "A5", "C6"]
for i, nm in enumerate(gl):
    place(harp(nm, 0.7), B0 - 0.36 + i * 0.045, 0.5, -0.5 + i * 0.12, 0.6)
for i, nm in enumerate(["C6", "F6", "A6"]):
    place(glock(nm, 0.5), B0 + 0.05 + i * 0.12, 0.35, 0.3, 0.7)
place(sfx(2350), B0 - 0.1, 0.35, 0, 0.6)
theme = [  # (beat from bloom, note, beats)
    (0, "C5", 1), (1, "F5", 0.5), (1.5, "E5", 0.5), (2, "C5", 1), (3, "A4", 1),
    (4, "Bb4", 1), (5, "D5", 0.5), (5.5, "C5", 0.5), (6, "A4", 2),
    (8, "F5", 1), (9, "G5", 0.5), (9.5, "A5", 0.5), (10, "G5", 1), (11, "F5", 1),
    (12, "E5", 1.5), (13.5, "D5", 0.5), (14, "C5", 2),
]
for b, nm, d in theme:
    at = B0 + 0.1 + b * BEAT
    if at > G1 - 0.1:
        break
    place(piano(nm, d * BEAT + 0.8, 0.8), at, 0.55, 0.1, 0.45)
    place(strings("violins", nm[:-1] + str(int(nm[-1]) + 1), d * BEAT * 0.98, 0.45, attack=0.06, release=0.25), at, 0.32, 0.25, 0.55)

# ------------------------------------------------------------------ 25.1 – 26.95: the logo
L0, LI = C["logo"][0], C["logoIn"]
t = tt(LI - (L0 - 0.4))
k = np.linspace(0, 1, len(t))
rise = filt(rng.standard_normal(len(t)), "bandpass", [700, 7000]) * k**2.5
place(rise, L0 - 0.4, 0.09, 0, 0.6)
place(fade(timpani(True, 2)[: int((LI - L0 + 0.1) * SR)], 0.4, 0.05), L0 - 0.05, 0.55, 0, 0.4)
place(sfx(1143), LI - 0.55, 0.9, 0, 0.35)
place(section([("violins", "F5"), ("violins", "C6"), ("violas", "A4"), ("cellos", "F3"), ("basses", "F2")], 1.5, 0.75, attack=0.01, release=1.0), LI, 0.6, 0, 0.6)
for nm in ("F2", "C3", "F3"):
    place(piano(nm, 2.5, 0.85), LI, 0.4, 0, 0.5)
for i, nm in enumerate(["F6", "C7", "A6"]):
    place(glock(nm, 0.45), LI + 0.08 + i * 0.1, 0.3, 0.2, 0.7)

# ------------------------------------------------------------------ 26.7 – 30.2: warm and hopeful
F0 = C["final"][0]
warm = [(0.0, ["F4", "A4", "C5"], "F2"), (0.95, ["E4", "G4", "C5"], "C2"), (1.85, ["D4", "F4", "A4"], "D2"), (2.7, ["D4", "F4", "Bb4"], "Bb1")]
for i, (off, ch, bass) in enumerate(warm):
    d = (warm[i + 1][0] - off) if i + 1 < len(warm) else 1.3
    place(section([("violins", nm) for nm in ch], d + 0.3, 0.6, attack=0.45, release=0.7), F0 + off, 0.8, 0.15, 0.7)
    place(section([("cellos", bass[:-1] + str(int(bass[-1]) + 1)), ("violas", ch[0])], d + 0.3, 0.6, attack=0.4, release=0.7), F0 + off, 0.75, -0.2, 0.6)
arp = ["F4", "A4", "C5", "A4", "E4", "G4", "C5", "G4", "D4", "F4", "A4", "F4", "D4", "F4", "Bb4"]
for i, nm in enumerate(arp):
    at = F0 + 0.1 + i * 0.22
    if at > C["ink2"][0]:
        break
    place(piano(nm, 1.6, 0.4), at, 0.45, 0.25 if i % 2 else -0.25, 0.55)
for b, nm in ((0, "C6"), (1, "F6"), (1.5, "E6"), (2, "C6"), (3, "A5")):
    place(piano(nm, 1.8, 0.45), F0 + 0.4 + b * BEAT, 0.42, 0.1, 0.7)
city = filt(sfx(2678, 20.0, 4.0), "lowpass", 2500)
place(fade(city, 0.8, 0.8), F0, 0.14, 0, 0.2)
place(sfx(1486, 0.0, 2.0), C["ink2"][0] - 0.5, 0.1, 0, 0.5)

# ------------------------------------------------------------------ 30.2 – 33.0: the question breathes
Q0 = C["question"][0]
place(strings("violins", "A5", C["question"][1] - Q0 + 0.2, 0.35, attack=1.0, release=1.0), Q0, 0.7, 0.15, 0.8)
place(strings("violas", "C5", C["question"][1] - Q0 + 0.2, 0.3, attack=1.2, release=1.0), Q0 + 0.3, 0.35, 0.0, 0.8)
place(strings("cellos", "F3", C["question"][1] - Q0 + 0.2, 0.35, attack=1.2, release=1.0), Q0, 0.65, -0.15, 0.8)
place(piano("A5", 2.8, 0.3), C["questionIn"] + 0.4, 0.4, 0.2, 0.8)
place(piano("F5", 2.8, 0.25), C["questionIn"] + 1.4, 0.32, -0.1, 0.8)

# ------------------------------------------------------------------ 33.0 – 34.5: final chord
E0 = C["end"][0]
for nm in ("F2", "C3", "F3", "A3", "G4", "C5"):
    place(piano(nm, 2.5, 0.42), E0 + 0.05, 0.3, 0, 0.7)
place(section([("violins", "A4"), ("violins", "C5"), ("violas", "F4"), ("cellos", "F3")], DUR - E0, 0.5, attack=0.4, release=0.6), E0, 0.6, 0, 0.8)
for i, nm in enumerate(["F5", "C6"]):
    place(glock(nm, 0.4), C["tagline"] + i * 0.14, 0.26, 0.1, 0.8)


# ------------------------------------------------------------------ mix
def reverb_ir(seconds=3.0, predelay=0.025):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.stack([filt(rng.standard_normal(n) * np.exp(-t / (seconds / 6.5)), "lowpass", 6000) for _ in range(2)], 1)
    ir = np.vstack([np.zeros((int(predelay * SR), 2)), ir])
    return ir / np.sqrt((ir**2).sum(axis=0))


ir = reverb_ir()
wet = np.stack([signal.fftconvolve(verb[:, c], ir[:, c])[: len(verb)] for c in range(2)], 1)
mix = dry + wet * 0.55

# true silence before the release: out over 14.95–15.1, nothing until the heartbeat
gain = np.ones(len(mix))
a, a2, b = int(C["hush"][0] * SR), int((C["hush"][0] + 0.15) * SR), int((C["heartbeat"] - 0.03) * SR)
gain[a:a2] = np.linspace(1, 0, a2 - a) ** 2
gain[a2:b] = 0.0
mix *= gain[:, None]
# (the heartbeat and the held breath start after this window, so they survive it)

mix = mix[:N]
mix = filt(mix, "highpass", 30)
# gentle RMS compression (2.2:1 above -26 dB) so it holds up on phone speakers
lvl = np.sqrt(signal.sosfiltfilt(signal.butter(1, 6 / (SR / 2), output="sos"), (mix**2).mean(1)) + 1e-12)
db = 20 * np.log10(lvl / (np.max(lvl) + 1e-12))
gr = np.where(db > -26, (db + 26) * (1 - 1 / 2.2), 0.0)
mix *= (10 ** (-gr / 20))[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix = mix / np.max(np.abs(mix)) * 0.89
fo = int(0.5 * SR)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5

out = FILM / "audio" / "never-background.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
print(f"wrote {out}  {DUR:.1f}s  rms {20*np.log10(np.sqrt(np.mean(mix**2))):.1f} dBFS")
