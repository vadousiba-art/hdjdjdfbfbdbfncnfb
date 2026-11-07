"""Original score and sound design for the YORU welcome film.

Every sound is synthesized here (oscillators, filtered noise, Karplus-Strong
plucks, a synthetic reverb) and placed on the timeline the picture uses
(src/lib/welcome/cues.json), so cuts and impacts land on the frame.

Harmony: D minor colour with the Japanese *in* scale (D Eb G A Bb) for the
melodies; 120 BPM. Nothing is sampled or borrowed.

    python3 audio/synth.py            -> audio/welcome-full.wav, audio/welcome-short.wav
"""

import json
import pathlib
import wave

import numpy as np
from scipy import signal

ROOT = pathlib.Path(__file__).resolve().parent.parent
CUES = json.loads((ROOT.parent / "src" / "lib" / "welcome" / "cues.json").read_text())
SR = 48000
BEAT = 60.0 / CUES["bpm"]


def hz(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# MIDI notes. D in-scale across octaves.
IN = [0, 1, 5, 7, 8]  # D Eb G A Bb, relative to D
def in_note(deg, octave=4):
    o, d = divmod(deg, 5)
    return 14 + 12 * (octave + o) + IN[d]  # 14 = D0


class Mix:
    def __init__(self, dur, seed):
        self.N = int(dur * SR)
        self.dur = dur
        self.dry = np.zeros((self.N, 2))
        self.verb = np.zeros((self.N, 2))
        self.rng = np.random.default_rng(seed)

    def place(self, sig, at, gain=1.0, pan=0.0, send=0.0):
        if sig.ndim == 1:
            l = np.cos((pan + 1) * np.pi / 4)
            r = np.sin((pan + 1) * np.pi / 4)
            sig = np.stack([sig * l, sig * r], axis=1) * np.sqrt(2)
        i = int(round(at * SR))
        if i >= self.N or i + len(sig) <= 0:
            return
        if i < 0:
            sig = sig[-i:]
            i = 0
        j = min(self.N, i + len(sig))
        seg = sig[: j - i] * gain
        self.dry[i:j] += seg
        if send:
            self.verb[i:j] += seg * send

    def noise(self, dur):
        return self.rng.standard_normal(int(dur * SR))


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def env(t, a=0.002, d=0.3):
    return np.minimum(1.0, t / max(a, 1e-6)) * np.exp(-t / d)


def sos(kind, f, order=2):
    nyq = SR / 2
    wn = [min(x / nyq, 0.99) for x in f] if isinstance(f, (list, tuple)) else min(f / nyq, 0.99)
    return signal.butter(order, wn, btype=kind, output="sos")


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x)


def sweep(x, f0, f1, kind="lowpass", block=512, curve=1.5, q=0.3):
    out = np.zeros_like(x)
    nb = int(np.ceil(len(x) / block))
    zi = None
    for b in range(nb):
        k = (b / max(1, nb - 1)) ** curve
        f = f0 * (f1 / f0) ** k
        s = sos("bandpass", [f * (1 - q), f * (1 + q)]) if kind == "bandpass" else sos(kind, f)
        if zi is None:
            zi = np.zeros((s.shape[0], 2))
        seg = x[b * block:(b + 1) * block]
        out[b * block:b * block + len(seg)], zi = signal.sosfilt(s, seg, zi=zi)
    return out


def saw(f, t):
    ph = np.cumsum(np.broadcast_to(f, t.shape) / SR)
    return 2.0 * (ph % 1.0) - 1.0


def sine(f, t):
    return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape) / SR))


# ------------------------------------------------------------------ instruments
def kick(m, at, g=1.0):
    t = tt(0.5)
    f = 46 + 120 * np.exp(-t * 32)
    body = sine(f, t) * env(t, 0.001, 0.22)
    click = filt(m.noise(0.01), "highpass", 2500) * np.linspace(1, 0, int(0.01 * SR))
    m.place(np.tanh(body * 1.6) * 0.9, at, g)
    m.place(click * 0.25, at, g)


def snare(m, at, g=0.5, send=0.15):
    t = tt(0.3)
    n = filt(m.noise(0.3), "bandpass", [1500, 7000]) * env(t, 0.001, 0.09)
    tone = sine(190 + 0 * t, t) * env(t, 0.001, 0.06)
    m.place(n * 0.7 + tone * 0.4, at, g, pan=0.05, send=send)


def clap(m, at, g=0.4):
    out = np.zeros(int(0.35 * SR))
    for k, d in enumerate([0, 0.011, 0.023]):
        t = tt(0.3)
        n = filt(m.noise(0.3), "bandpass", [900, 4000]) * env(t, 0.0005, 0.03 if k < 2 else 0.12)
        i = int(d * SR)
        out[i:i + len(n)] += n
    m.place(out, at, g, pan=-0.05, send=0.25)


def hat(m, at, g=0.12, open_=False, pan=0.25):
    d = 0.18 if open_ else 0.04
    t = tt(d * 3)
    n = filt(m.noise(d * 3), "highpass", 7500) * env(t, 0.0005, d)
    m.place(n, at, g, pan=pan)


def tick(m, at, g=0.22):
    # Interface tick: tiny sine blip plus click.
    t = tt(0.06)
    s = sine(2600 + 0 * t, t) * env(t, 0.0005, 0.012)
    m.place(s, at, g, pan=0.2, send=0.1)


def swish(m, at, g=0.5, dur=0.35, up=True):
    n = m.noise(dur)
    s = sweep(n, 600, 6000, "bandpass", curve=1.0, q=0.35) if up else sweep(n, 6000, 500, "bandpass", curve=1.0, q=0.35)
    t = tt(dur)
    s *= np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    m.place(s, at - dur * 0.6, g, pan=-0.3 if up else 0.3, send=0.3)


def thud(m, at, g=0.7):
    t = tt(1.2)
    f = 38 + 70 * np.exp(-t * 9)
    m.place(np.tanh(sine(f, t) * env(t, 0.002, 0.45) * 1.8), at, g, send=0.2)


def stamp(m, at, g=0.45):
    # A punchy "stamp": low tom + paper slap.
    t = tt(0.35)
    tom = sine(110 + 60 * np.exp(-t * 30), t) * env(t, 0.001, 0.12)
    slap = filt(m.noise(0.35), "bandpass", [700, 3500]) * env(t, 0.0005, 0.04)
    m.place(tom * 0.8 + slap * 0.6, at, g, send=0.2)


def impact(m, at, g=1.0, tail=3.0):
    # Big hit: sub drop, noise crash, metallic ring.
    t = tt(tail)
    sub = np.tanh(sine(30 + 90 * np.exp(-t * 6), t) * env(t, 0.002, 1.1) * 2.2)
    crash = filt(filt(m.noise(tail), "highpass", 1800), "lowpass", 11000) * env(t, 0.001, 0.55)
    ring = sum(sine(f + 0 * t, t) * env(t, 0.001, d) for f, d in [(587.3, 1.6), (880.0, 1.2), (1318.5, 0.8), (2093.0, 0.5)]) * 0.18
    m.place(sub, at, g)
    m.place(crash * 0.3, at, g, send=0.4)
    m.place(ring, at, g * 0.8, pan=0.1, send=0.6)


def riser(m, start, end, g=0.4):
    d = end - start
    n = m.noise(d)
    s = sweep(n, 300, 9000, "bandpass", curve=2.2, q=0.25)
    t = tt(d)
    s *= (t / d) ** 2.2
    tone = saw(hz(50) * (1 + 1.0 * (t / d) ** 2), t)
    tone = filt(tone, "lowpass", 2000) * (t / d) ** 2 * 0.25
    m.place(s + tone, start, g, send=0.3)


def drone(m, start, end, g=0.25, root=38, swell=True):
    d = end - start
    t = tt(d)
    v = sum(saw(hz(n) * (1 + det), t) for n in (root, root + 7, root + 12) for det in (-0.004, 0.003))
    v = filt(v, "lowpass", 700)
    shape = np.minimum(1, t / min(2.0, d / 2)) * np.minimum(1, (d - t) / 0.6)
    if swell:
        shape *= 0.6 + 0.4 * (t / d)
    m.place(v * shape * 0.15, start, g, send=0.4)


def pad(m, start, end, notes, g=0.2, cutoff=(500, 2400)):
    d = end - start
    t = tt(d)
    v = sum(saw(hz(n) * (1 + det), t) for n in notes for det in (-0.006, 0.0, 0.005))
    v = sweep(v, cutoff[0], cutoff[1], "lowpass", curve=1.0)
    shape = np.minimum(1, t / 1.2) * np.minimum(1, (d - t) / 1.0)
    st = np.stack([v * shape, np.roll(v, 300) * shape], axis=1) * 0.05
    m.place(st, start, g, send=0.5)


def pluck(m, at, note, g=0.3, decay=0.996, pan=0.0, bright=0.5):
    # Karplus-Strong string, koto-like.
    f = hz(note)
    p = max(2, int(SR / f))
    n = int(1.6 * SR)
    buf = m.rng.uniform(-1, 1, p)
    buf = filt(buf, "lowpass", 2000 + 6000 * bright) if p > 12 else buf
    out = np.zeros(n)
    out[:p] = buf
    for i in range(p, n):
        out[i] = decay * 0.5 * (out[i - p] + out[i - p + 1 if i - p + 1 < i else i - p])
    out *= np.exp(-np.arange(n) / SR * 1.6)
    m.place(out, at, g, pan=pan, send=0.35)


def bell(m, at, note, g=0.15, pan=0.0):
    t = tt(2.5)
    f = hz(note)
    s = sine(f + 0 * t, t) * env(t, 0.001, 1.2) + 0.5 * sine(f * 2.76 + 0 * t, t) * env(t, 0.001, 0.4) + 0.25 * sine(f * 5.4 + 0 * t, t) * env(t, 0.001, 0.15)
    m.place(s, at, g, pan=pan, send=0.55)


def bass(m, at, note, dur, g=0.35):
    t = tt(dur + 0.05)
    v = saw(hz(note) + 0 * t, t) * 0.6 + np.sign(sine(hz(note) + 0 * t, t)) * 0.25
    v = filt(v, "lowpass", 380) * env(t, 0.004, dur * 0.9)
    m.place(np.tanh(v * 1.5), at, g)


def glitch(m, at, g=0.3):
    # Stutter: a few tiny repeated grains.
    grain = filt(m.noise(0.03), "bandpass", [1200, 6000]) * np.hanning(int(0.03 * SR))
    for k in range(6):
        m.place(grain * (1 - k * 0.12), at + k * 0.035, g, pan=(-1) ** k * 0.4)


def silence(m, start, end):
    i, j = int(start * SR), int(end * SR)
    m.dry[i:j] *= np.linspace(1, 0, j - i)[:, None] ** 4
    m.verb[i:j] *= np.linspace(1, 0, j - i)[:, None] ** 2


# ------------------------------------------------------------------ patterns
BASSLINE = [0, 0, 5, 0, 3, 0, 4, 3]  # degrees (8ths) over one bar
MELODY = [(0, 10), (1, 9), (2, 7), (3, 8), (4, 7), (5, 5), (6, 6), (7, 7)]  # (8th index, degree) one bar
MELODY_B = [(0, 7), (2, 8), (3, 9), (4, 10), (6, 8), (7, 7)]


def groove(m, start, end, kick_on=True, hats=True, claps=False, bassline=True, melody=None, half=False):
    t = start
    bar = 0
    while t < end - 1e-6:
        for b in range(4):
            bt = t + b * BEAT
            if bt >= end:
                break
            if kick_on and (not half or b % 2 == 0):
                kick(m, bt, 0.95)
            if hats:
                hat(m, bt + BEAT / 2, 0.11, open_=(b == 3))
                hat(m, bt, 0.05, pan=-0.2)
            if claps and b in (1, 3):
                clap(m, bt, 0.33)
        if bassline:
            for i, deg in enumerate(BASSLINE):
                at = t + i * BEAT / 2
                if at < end:
                    bass(m, at, in_note(deg, 1), BEAT / 2 * 0.9, 0.32)
        if melody:
            pat = MELODY if bar % 2 == 0 else MELODY_B
            for i, deg in pat:
                at = t + i * BEAT / 2
                if at < end:
                    pluck(m, at, in_note(deg, 3), 0.22 * melody, pan=0.25 * ((i % 2) * 2 - 1), bright=0.6)
        t += 4 * BEAT
        bar += 1


# ------------------------------------------------------------------ cuts
def full():
    c = CUES["cuts"]["full"]
    m = Mix(c["duration"], 7)
    # 1 · the internet after dark
    drone(m, 0.4, 8.0, 0.9)
    for bt in (1.0, 3.0, 5.0):
        thud(m, bt, 0.35)
    for h in (2.0, 2.5, 3.0, 3.5, 4.0):
        swish(m, h, 0.45)
        stamp(m, h, 0.28)
    thud(m, 4.5, 0.7)
    swish(m, 5.5, 0.4, up=False)
    riser(m, 6.0, 8.0, 0.5)
    # 2 · enter YORU
    impact(m, 8.0, 1.0)
    for i, deg in enumerate([10, 12, 11, 9, 10, 8, 7, 9]):
        bell(m, 8.6 + i * BEAT * 0.75, in_note(deg, 3), 0.11, pan=0.3 * np.sin(i))
    pad(m, 8.0, 15.0, [in_note(0, 3), in_note(3, 3), in_note(5, 3)], 0.5, (400, 1800))
    thud(m, 11.0, 0.5)
    groove(m, 12.0, 15.0, hats=False, bassline=False)
    swish(m, 15.0, 0.5)
    # 3–5 · the app
    groove(m, 15.0, 25.0, claps=False)
    groove(m, 25.0, 35.0, claps=True, melody=1.0)
    groove(m, 35.0, 45.0, claps=True, melody=1.2)
    pad(m, 25.0, 45.0, [in_note(0, 3), in_note(4, 3), in_note(5, 3)], 0.28, (600, 2200))
    for h in (26.0, 27.0, 28.0, 29.0):
        stamp(m, h, 0.4)
    # 6 · breakdown
    groove(m, 45.0, 52.0, half=True, hats=True, bassline=True, claps=False)
    glitch(m, 47.0, 0.35)
    for h in (48.5, 49.7, 50.8):
        glitch(m, h, 0.3)
    groove(m, 52.0, 55.0, claps=True, melody=0.8)
    # 7 · YORU Pro: calmer, refined
    pad(m, 55.0, 68.5, [in_note(0, 3), in_note(3, 3), in_note(5, 3), in_note(8, 3)], 0.7, (300, 3200))
    for i in range(int((68 - 55.5) / (BEAT / 2))):
        at = 55.5 + i * BEAT / 2
        deg = [5, 7, 8, 10, 9, 7, 8, 6][i % 8]
        pluck(m, at, in_note(deg, 3), 0.11, pan=0.5 * np.sin(i * 0.7), bright=0.35, decay=0.997)
    for bt in np.arange(56.0, 68.0, 2.0):
        thud(m, bt, 0.28)
    # 8 · build, silence, final impact
    for k in range(16):
        snare(m, 68.0 + k * (4.4 / 16) * (1 - k / 40), 0.18 + k * 0.02, 0.1)
    for bt in np.arange(68.0, 72.0, BEAT / 2):
        kick(m, bt, 0.6)
    riser(m, 69.0, 72.4, 0.7)
    silence(m, 72.0, 72.5)
    impact(m, 72.5, 1.15, tail=6.0)
    pad(m, 72.6, 80.0, [in_note(0, 2), in_note(5, 3), in_note(10, 3)], 0.6, (2400, 600))
    for i, deg in enumerate([10, 9, 7, 5]):
        bell(m, 74.0 + i * 1.0, in_note(deg, 3), 0.12, pan=-0.2 + i * 0.15)
    for h in c["hits"]:
        if 15 <= h < 55 and h not in (25.0,):
            tick(m, h, 0.16)
    return m


def short():
    c = CUES["cuts"]["short"]
    m = Mix(c["duration"], 11)
    drone(m, 0.1, 3.6, 0.9)
    for h in (1.0, 1.25, 1.5, 1.75, 2.0):
        swish(m, h, 0.4)
        stamp(m, h, 0.25)
    riser(m, 2.2, 3.5, 0.5)
    impact(m, 3.5, 1.0)
    for i, deg in enumerate([10, 12, 11, 9]):
        bell(m, 3.9 + i * 0.36, in_note(deg, 3), 0.1)
    pad(m, 3.5, 7.0, [in_note(0, 3), in_note(3, 3), in_note(5, 3)], 0.5)
    groove(m, 5.0, 7.0, hats=False, bassline=False)
    groove(m, 7.0, 19.0, claps=True, melody=1.0)
    pad(m, 7.0, 19.0, [in_note(0, 3), in_note(4, 3), in_note(5, 3)], 0.25)
    for h in c["hits"]:
        if 7 <= h < 19:
            tick(m, h, 0.16)
    pad(m, 19.0, 22.2, [in_note(0, 3), in_note(3, 3), in_note(5, 3), in_note(8, 3)], 0.7, (300, 3000))
    for i in range(12):
        pluck(m, 19.2 + i * BEAT / 2, in_note([5, 7, 8, 10][i % 4], 3), 0.1, bright=0.35)
    riser(m, 20.6, 21.9, 0.6)
    silence(m, 21.85, 22.2)
    impact(m, 22.2, 1.1, tail=3.8)
    pad(m, 22.3, 26.0, [in_note(0, 2), in_note(5, 3), in_note(10, 3)], 0.55, (2400, 700))
    return m


# ------------------------------------------------------------------ master
def reverb_ir(seconds=2.6, seed=3):
    r = np.random.default_rng(seed)
    t = tt(seconds)
    ir = r.standard_normal((len(t), 2)) * np.exp(-t / (seconds / 5.5))[:, None]
    ir[:, 0] = filt(ir[:, 0], "lowpass", 6000)
    ir[:, 1] = filt(ir[:, 1], "lowpass", 5500)
    return ir / np.sqrt((ir ** 2).sum(axis=0))


def master(m, name):
    ir = reverb_ir()
    wet = np.stack([signal.fftconvolve(m.verb[:, k], ir[:, k])[: m.N] for k in range(2)], axis=1)
    mix = m.dry + wet * 0.55
    mix = np.stack([filt(mix[:, k], "highpass", 28) for k in range(2)], axis=1)
    # Gentle bus compression via soft clip, then normalise to -1 dBFS.
    mix = np.tanh(mix * 0.9)
    fade = int(0.6 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    mix *= 10 ** (-1 / 20) / max(1e-9, np.abs(mix).max())
    pcm = (mix * 32767).astype(np.int16)
    out = ROOT / "audio" / name
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("wrote", out, f"{m.dur:.1f}s")


if __name__ == "__main__":
    master(full(), "welcome-full.wav")
    master(short(), "welcome-short.wav")
