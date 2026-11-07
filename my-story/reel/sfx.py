"""Short effect sounds for the reels, made from noise and tones (kit.rng)."""

import numpy as np

import kit
from kit import SR, filt, tt


def flash_sound():
    t = tt(0.35)
    click = filt(kit.rng.standard_normal(len(t)), "highpass", 2500) * np.exp(-t / 0.012)
    swell = filt(kit.rng.standard_normal(len(t)), "bandpass", [1500, 7000]) * np.exp(-t / 0.12) * 0.3
    return click + swell


def swish():
    t = tt(0.28)
    return filt(kit.rng.standard_normal(len(t)), "bandpass", [800, 5000]) * np.sin(np.pi * t / 0.28) ** 2


def keys(dur):
    out = np.zeros(int(dur * SR))
    t = 0.05
    while t < dur - 0.05:
        n = tt(0.03)
        k = filt(kit.rng.standard_normal(len(n)), "bandpass", [1800, 6000]) * np.exp(-n / 0.006)
        i = int(t * SR)
        out[i: i + len(k)] += k[: len(out) - i] * kit.rng.uniform(0.5, 1.0)
        t += kit.rng.uniform(0.07, 0.16)
    return out


def glitch():
    t = tt(0.55)
    x = filt(kit.rng.standard_normal(len(t)), "bandpass", [300, 6000])
    gate = (np.floor(t * 38) % 2 == 0).astype(float)
    tone = np.sign(np.sin(2 * np.pi * 180 * t)) * 0.3
    return (x * gate + tone * (1 - gate)) * np.exp(-t / 0.3)
