"""Sample bank for the score: loads the CC0 VSCO-2-CE samples (piano, string
sections, harp, glockenspiel, timpani) and the Mixkit sound effects, resampled
to 48 kHz. String/harp/glock pitches come from the file names, with the octave
checked against a measured fundamental (cached in bank.json)."""

import glob
import json
import pathlib
import re
import subprocess
import warnings

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
ROOT = pathlib.Path(__file__).resolve().parents[2]
STOCK = ROOT / "assets" / "stock"
VSCO = STOCK / "samples" / "vsco"
CACHE = pathlib.Path(__file__).resolve().parent / "bank.json"
NOTES = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def load_wav(path):
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        sr, x = wavfile.read(str(path))
    if x.dtype == np.int16:
        x = x / 32768.0
    elif x.dtype == np.int32:
        x = x / 2147483648.0
    elif x.dtype == np.uint8:
        x = (x - 128) / 128.0
    x = x.astype(np.float64)
    if x.ndim == 1:
        x = np.stack([x, x], 1)
    x = x[:, :2]
    if sr != SR:
        g = np.gcd(SR, sr)
        x = signal.resample_poly(x, SR // g, sr // g, axis=0)
    return x


def load_mp3(path):
    out = STOCK / "sfx-wav" / (pathlib.Path(path).stem + ".wav")
    out.parent.mkdir(parents=True, exist_ok=True)
    if not out.exists():
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(path), "-ar", str(SR), "-ac", "2", str(out)], check=True)
    return load_wav(out)


def f0(x, fmin, fmax):
    m = x.mean(1)
    seg = m[int(0.35 * SR): int(1.15 * SR)]
    if len(seg) < 2048:
        seg = m[: int(0.8 * SR)]
    seg = seg - seg.mean()
    n = 1 << int(np.ceil(np.log2(len(seg) * 2)))
    X = np.fft.rfft(seg * np.hanning(len(seg)), n)
    ac = np.fft.irfft(np.abs(X) ** 2)[: len(seg)]
    ac /= ac[0] + 1e-12
    lo, hi = int(SR / fmax), int(SR / fmin)
    lag = lo + int(np.argmax(ac[lo:hi]))
    return SR / lag


def name_midi(name):
    m = re.match(r"([A-G]#?)(-?\d)", name)
    return 12 * (int(m.group(2)) + 1) + NOTES[m.group(1)]


def build():
    if CACHE.exists():
        return json.loads(CACHE.read_text())
    bank = {}
    specs = {
        "violins": ("Strings/Violin Section/susVib/*.wav", r"_susVib_([A-G]#?\d)_v(\d)", 150, 2200),
        "violas": ("Strings/Viola Section/susvib/*.wav", r"_susvib_([A-G]#?\d)_v(\d)", 100, 1400),
        "cellos": ("Strings/Cello Section/susvib/*.wav", r"susvib_([A-G]#?\d)_v(\d)", 55, 900),
        "basses": ("Strings/Solo Contrabass/SusVib/*.wav", r"_SusVib_([A-G]#?\d)_v(\d)", 28, 400),
        "harp": ("Strings/Harp/*.wav", r"KSHarp_([A-G]#?\d)_", 40, 2500),
        "glock": ("Percussion/Glock/*.wav", r"glock_medium_([A-G]#?\d)", 300, 5000),
    }
    for inst, (pat, rx, fmin, fmax) in specs.items():
        rows = []
        for p in sorted(glob.glob(str(VSCO / pat))):
            m = re.search(rx, p.split("/")[-1])
            if not m:
                continue
            rows.append({"file": p, "named": name_midi(m.group(1)), "layer": int(m.group(2)) if len(m.groups()) > 1 else 1})
        diffs = []
        for r in rows[:: max(1, len(rows) // 8)]:
            hz = f0(load_wav(r["file"]), fmin, fmax)
            meas = 69 + 12 * np.log2(hz / 440)
            diffs.append(meas - r["named"])
        off = int(12 * round(float(np.median(diffs)) / 12))
        for r in rows:
            r["midi"] = r["named"] + off
        bank[inst] = rows
        print(f"{inst}: {len(rows)} samples, name->pitch octave offset {off:+d} (median diff {np.median(diffs):+.2f})")
    bank["piano"] = [
        {"file": str(VSCO / f"Keys/Upright Piano/Player_dyn{d}_rr1_{n:03d}.wav"), "midi": 21 + 2 * n, "layer": d}
        for d in (1, 2, 3) for n in range(0, 45, 2)
    ]
    bank["timpani_hit"] = sorted(glob.glob(str(VSCO / "Percussion/Timpani/Timpani*_Hit*.wav")))
    bank["timpani_roll"] = sorted(glob.glob(str(VSCO / "Percussion/Timpani/Rolls/*.wav")))
    CACHE.write_text(json.dumps(bank, indent=1))
    return bank


_loaded = {}


def sample(path):
    if path not in _loaded:
        _loaded[path] = load_wav(path)
    return _loaded[path]


def shift(x, semis):
    if abs(semis) < 1e-6:
        return x
    r = 2 ** (semis / 12)
    n = int(len(x) / r)
    idx = np.arange(n) * r
    return np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], 1)


if __name__ == "__main__":
    b = build()
    for k, v in b.items():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            print(k, sorted({r["midi"] for r in v})[:6], "...", sorted({r["midi"] for r in v})[-3:], "layers", sorted({r["layer"] for r in v}))
        else:
            print(k, len(v))
