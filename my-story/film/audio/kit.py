"""Shared instruments and mixing for the scores in this project.

Instruments are the CC0 VS Chamber Orchestra: Community Edition samples
(upright piano, violin/viola/cello sections, contrabass, harp, glockenspiel,
timpani), loaded through never-background/film/audio/bank.py; sound effects are
Mixkit (free licence). Both are fetched by never-background/fetch-assets.sh and
never committed.

A score calls seed() first, makes a Mix, places sounds on it, then master()s it.
"""

import pathlib
import sys
import wave

import numpy as np
from scipy import signal

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3] / "never-background" / "film" / "audio"))
import bank as B  # noqa: E402

SR = B.SR
BANK = B.build()
rng = np.random.default_rng(0)


def seed(n):
    global rng
    rng = np.random.default_rng(n)


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def stereo(sig, pan=0.0):
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    if sig.ndim == 2:
        return sig * np.array([l, r]) * np.sqrt(2)
    return np.stack([sig * l, sig * r], 1) * np.sqrt(2)


class Mix:
    """A dry bus and a reverb send, `dur` seconds long plus a tail."""

    def __init__(self, dur, tail=4.0):
        self.n = int(round(dur * SR))
        self.dry = np.zeros((self.n + int(tail * SR), 2))
        self.verb = np.zeros_like(self.dry)

    def place(self, sig, at, gain=1.0, pan=0.0, send=0.0):
        sig = stereo(sig, pan)
        i = int(round(at * SR))
        if i < 0:
            sig, i = sig[-i:], 0
        j = min(len(self.dry), i + len(sig))
        if i >= j:
            return
        seg = sig[: j - i] * gain
        self.dry[i:j] += seg
        if send:
            self.verb[i:j] += seg * send

    def wet(self, amount, ir):
        w = np.stack([signal.fftconvolve(self.verb[:, c], ir[:, c])[: len(self.verb)] for c in range(2)], 1)
        return self.dry + w * amount


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


NOTE = {"C": 0, "C#": 1, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "Ab": 8, "A": 9, "Bb": 10, "B": 11}


def m(name):
    return 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]


def up(name, k=1):
    return name[:-1] + str(int(name[-1]) + k)


# ------------------------------------------------------------------ instruments
def nearest(inst, note, layer=None):
    rows = BANK[inst]
    if layer is not None:
        rows = [r for r in rows if r["layer"] == layer] or BANK[inst]
    return min(rows, key=lambda r: (abs(r["midi"] - note), r["layer"]))


def piano(name, dur=2.5, vel=0.6):
    n = m(name) if isinstance(name, str) else name
    layer = 1 if vel < 0.4 else 2 if vel < 0.75 else 3
    r = nearest("piano", n, layer)
    x = B.shift(B.sample(r["file"]), n - r["midi"])[: int((dur + 0.6) * SR)]
    return fade(x, 0.001, min(0.6, dur * 0.5)) * (0.6 + 0.5 * vel)


def strings(inst, name, dur, vel=0.6, attack=0.25, release=0.6, start=0.12):
    n = m(name) if isinstance(name, str) else name
    layer = None
    if inst in ("violins", "violas"):
        layer = 1 if vel < 0.6 else 2
    elif inst in ("cellos", "basses"):
        layer = 1 if vel < 0.6 else 3
    r = nearest(inst, n, layer)
    x = B.shift(B.sample(r["file"])[int(start * SR):], n - r["midi"])
    need = int((dur + release) * SR)
    if len(x) < need:  # extend long notes with a crossfaded loop of the body
        body = x[int(0.6 * SR): int(min(len(x), 6 * SR))]
        k = int(0.25 * SR)
        rmp = np.linspace(0, 1, k)[:, None]
        while len(x) < need:
            x = np.vstack([x[:-k], x[-k:] * (1 - rmp) + body[:k] * rmp, body[k:]])
    return fade(x[:need], attack, release) * vel


def section(notes, dur, vel=0.5, **kw):
    parts = [strings(inst, nm, dur, vel, **kw) for inst, nm in notes]
    out = np.zeros((max(len(x) for x in parts), 2))
    for x in parts:
        out[: len(x)] += x
    return out / np.sqrt(len(parts))


def harp(name, vel=0.7):
    n = m(name)
    r = nearest("harp", n)
    return fade(B.shift(B.sample(r["file"]), n - r["midi"])[: int(3.5 * SR)], 0.001, 1.0) * vel


def glock(name, vel=0.5):
    n = m(name)
    r = nearest("glock", n)
    return fade(B.shift(B.sample(r["file"]), n - r["midi"])[: int(3.0 * SR)], 0.001, 1.2) * vel


def timpani(roll=False, idx=0):
    files = BANK["timpani_roll" if roll else "timpani_hit"]
    return B.sample(files[idx % len(files)])


def sfx(i, start=0.0, dur=None):
    x = B.load_mp3(B.STOCK / "sfx" / f"{i}.mp3")[int(start * SR):]
    return x[: int(dur * SR)] if dur else x


def kick(f0=90, f1=40, d=0.45):
    t = tt(d)
    ph = 2 * np.pi * np.cumsum(f1 + (f0 - f1) * np.exp(-t / 0.05)) / SR
    return np.sin(ph) * env(t, 0.001, 0.22)


def hat(d=0.06):
    t = tt(d)
    return filt(rng.standard_normal(len(t)), "highpass", 8000) * env(t, 0.0005, 0.02)


def riser(dur, lo=500, hi=7000):
    t = tt(dur)
    k = np.linspace(0, 1, len(t))
    return filt(rng.standard_normal(len(t)), "bandpass", [lo, hi]) * k**2.6


# ------------------------------------------------------------------ mix
def reverb_ir(seconds=3.2, predelay=0.025):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = np.stack([filt(rng.standard_normal(n) * np.exp(-t / (seconds / 6.5)), "lowpass", 6000) for _ in range(2)], 1)
    ir = np.vstack([np.zeros((int(predelay * SR), 2)), ir])
    return ir / np.sqrt((ir**2).sum(axis=0))


def master(mix, n, threshold=-24, ratio=2.0, fade_out=0.8):
    """High-pass, gentle RMS compression so it holds up on phone speakers, soft clip, normalise, fade."""
    mix = filt(mix[:n], "highpass", 30)
    lvl = np.sqrt(signal.sosfiltfilt(signal.butter(1, 6 / (SR / 2), output="sos"), (mix**2).mean(1)) + 1e-12)
    db = 20 * np.log10(lvl / (np.max(lvl) + 1e-12))
    gr = np.where(db > threshold, (db - threshold) * (1 - 1 / ratio), 0.0)
    mix *= (10 ** (-gr / 20))[:, None]
    mix = np.tanh(mix * 1.1) / np.tanh(1.1)
    mix = mix / np.max(np.abs(mix)) * 0.89
    fo = int(fade_out * SR)
    mix[-fo:] *= np.linspace(1, 0, fo)[:, None] ** 1.5
    return mix


def write(path, mix):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"wrote {path}  {len(mix) / SR:.1f}s  rms {20 * np.log10(np.sqrt(np.mean(mix**2))):.1f} dBFS")
