"""The parts the slide songs share: a Mix on the slide timeline's beat grid
(each slide lasts a whole number of beats, so every swipe lands on a beat),
chords, piano arpeggios, string pads, a pumped sub, drums and the soft swipe
between slides. Instruments come from film/audio/kit.py."""

import json
import pathlib
import sys

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "film" / "audio"))
import kit  # noqa: E402
from kit import Mix, env, filt, hat, kick, master, piano, reverb_ir, section, strings, tt, up, write  # noqa: E402

CH = {  # chord tones (low to high) and bass
    "C": (["C4", "E4", "G4"], "C2"), "G": (["B3", "D4", "G4"], "G1"), "Am": (["A3", "C4", "E4"], "A1"),
    "F": (["A3", "C4", "F4"], "F1"), "Dm": (["A3", "D4", "F4"], "D2"), "E": (["G#3", "B3", "E4"], "E2"),
    "D": (["A3", "D4", "F#4"], "D2"), "Em": (["G3", "B3", "E4"], "E2"), "Bm": (["B3", "D4", "F#4"], "B1"),
    "Cmaj7": (["E4", "G4", "B4"], "C2"), "Gsus": (["C4", "D4", "G4"], "G1"),
    "Bb": (["Bb3", "D4", "F4"], "Bb1"), "Gm": (["G3", "Bb3", "D4"], "G1"), "A": (["A3", "C#4", "E4"], "A1"),
}


def chords(seq, start):
    """[(chord, beats), …] from `start` -> [(chord, start beat, beats)]."""
    out, b = [], start
    for c, n in seq:
        out.append((c, b, n))
        b += n
    return out


def clap():
    t = tt(0.3)
    n = filt(kit.rng.standard_normal(len(t)), "bandpass", [900, 5000])
    e = sum(env(np.maximum(0, t - o), 0.001, 0.02) * (t >= o) for o in (0, 0.012, 0.024)) + env(t, 0.03, 0.12) * 0.6
    return n * e


class Band:
    def __init__(self, slides_json, seed):
        """slides_json: a slides file, or a dict with "bpm" and "slides" (each with "beats")."""
        d = slides_json if isinstance(slides_json, dict) else json.loads(pathlib.Path(slides_json).read_text())
        self.slides = d["slides"]
        self.beat = 60.0 / d["bpm"]
        self.starts = np.cumsum([0] + [s["beats"] for s in self.slides])  # in beats; the last entry is the end
        self.total = int(self.starts[-1])
        kit.seed(seed)
        self.mix = Mix(self.total * self.beat)
        self.level = 1.0  # each section's level, set where the section starts

    def place(self, sig, t, gain=1.0, pan=0.0, send=0.0):
        self.mix.place(sig, t, gain * self.level, pan, send)

    def at(self, beat):
        return beat * self.beat

    def slide(self, i):  # slide i (1-based) starts on this beat
        return int(self.starts[i - 1])

    def arp(self, ch, b0, n, vel, gain, step=0.5, pattern=(0, 1, 2, 3, 2, 1, 2, 3), dur=None, lp=None):
        tones, bass = CH[ch]
        notes = [up(bass, 1)] + tones + [up(tones[0])]
        i = 0
        while i * step < n - 1e-6:
            nm = notes[pattern[i % len(pattern)] % len(notes)]
            x = piano(nm, dur or step * self.beat * 2.4, vel)
            if lp:
                x = filt(x, "lowpass", lp)
            self.place(x, self.at(b0 + i * step), gain * (1.0 if i % 4 == 0 else 0.82), 0.22 if i % 2 else -0.18, 0.45)
            i += 1

    def pad(self, ch, b0, n, gain, vel=0.45, hi="violas", attack=0.6, release=0.8, bass=True):
        tones, root = CH[ch]
        voices = [(hi, up(t) if hi == "violins" else t) for t in tones]
        self.place(section(voices, self.at(n), vel, attack=attack, release=release), self.at(b0), gain, 0.15, 0.6)
        if bass:
            self.place(strings("cellos", up(root, 1), self.at(n), vel, attack=attack, release=release), self.at(b0), gain * 1.05, -0.25, 0.5)

    def subbass(self, ch, b0, n, gain):
        _, root = CH[ch]
        f = 440 * 2 ** ((kit.m(root) - 69) / 12)
        t = tt(self.at(n) + 0.05)
        x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
        # pumped under the kick on every beat
        pump = 1 - 0.55 * np.exp(-((t % self.beat) / 0.09))
        self.place(filt(x * pump * np.minimum(1, t / 0.02) * np.minimum(1, (t[-1] - t + 1e-3) / 0.05), "lowpass", 180), self.at(b0), gain, 0, 0.0)

    def drums(self, b0, b1, gain, kick_pat=(0, 1.5, 2.5), clap_on=(1, 3), hats=0.5, open_hat=False):
        b = b0
        while b < b1 - 1e-6:
            bar_pos = (b - b0) % 4
            for k in kick_pat:
                if abs(bar_pos - k) < 1e-6:
                    self.place(kick(), self.at(b), 0.3 * gain, 0)
            for c in clap_on:
                if abs(bar_pos - c) < 1e-6:
                    self.place(clap(), self.at(b), 0.4 * gain, 0.05, 0.3)
            if hats and abs(((b - b0) / hats) - round((b - b0) / hats)) < 1e-6:
                self.place(hat(), self.at(b), (0.07 if abs(bar_pos % 1) < 1e-6 else 0.045) * gain, 0.3)
            if open_hat and abs(bar_pos - 3.5) < 1e-6:
                self.place(hat(0.25), self.at(b), 0.05 * gain, -0.3, 0.2)
            b += 0.25

    def swipes(self):
        """A soft swipe on every slide change."""
        for i in range(2, len(self.slides) + 1):
            t = tt(0.26)
            x = filt(kit.rng.standard_normal(len(t)), "bandpass", [900, 5200]) * np.sin(np.pi * t / 0.26) ** 2
            self.place(x, self.at(self.slide(i)) - 0.12, 0.018, 0.3, 0.2)

    def write(self, path, verb=0.5, ir_seconds=2.8, fade_out=1.2):
        write(path, master(self.mix.wet(verb, reverb_ir(ir_seconds)), self.mix.n, fade_out=fade_out))
