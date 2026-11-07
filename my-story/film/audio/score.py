"""Score for the founder story (71.4 s), placed on cues.json (the timeline the
picture uses). D minor, opening into F major at "I'm me."

Instruments are the CC0 VS Chamber Orchestra: Community Edition samples
(upright piano, violin/viola/cello sections, contrabass, harp, glockenspiel,
timpani), loaded through never-background/film/audio/bank.py; sound effects are
Mixkit (free licence). Both are fetched by never-background/fetch-assets.sh and
never committed.

  0–4.3    the hook: a few piano notes over a low D
  4.3–12.4 childhood: warm F-major arpeggios, cello, glockenspiel
  12.4–20.1 the colour drains: the harmony darkens, a low pulse
  20.1     "Then I turned 7.": everything falls away
  21.5     the crack: glass, timpani, a low string hit
  22.4–37.6 grief: slow piano, cello; darker under the bad path
  37.6     dawn: a harp, the strings warm
  39.2–46.4 "I still love my dad": the strings swell, bittersweet
  48.15    silence, one heartbeat: "It's not."
  49.3–54.4 the rise: piano ostinato, pulse, timpani roll
  54.4     the impact; 58.6 a breath; 59.8 "I'm me.": F major, full
  61.4–67.4 building it: a hopeful piano ostinato with a light pulse
  67.4–71.4 resolve

Output: film/audio/story.wav (48 kHz stereo 16-bit).
"""

import json
import pathlib
import sys

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import kit  # noqa: E402
from kit import (SR, Mix, env, fade, filt, glock, harp, hat, kick, m, piano, reverb_ir, riser, section,  # noqa: E402
                 seed, sfx, stereo, strings, timpani, tt, up, master, write)

HERE = pathlib.Path(__file__).resolve().parent
FILM = HERE.parent
C = json.loads((FILM / "cues.json").read_text())
A = C["audio"]
DUR = C["duration"]
N = int(round(DUR * SR))
BEAT = 60.0 / C["bpm"]
seed(2009)
M = Mix(DUR)
place = M.place


def sub(at_list, gain, f=52, lp=220):
    for at in at_list:
        t = tt(0.5)
        p = np.sin(2 * np.pi * f * t) * env(t, 0.006, 0.16)
        place(filt(p, "lowpass", lp), at, gain, 0, 0.1)


TRIADS = {
    "F": ["F3", "A3", "C4"], "C": ["E3", "G3", "C4"], "Dm": ["D3", "F3", "A3"], "Bb": ["D3", "F3", "Bb3"],
    "Gm": ["D3", "G3", "Bb3"], "A": ["E3", "A3", "C#4"], "Am": ["E3", "A3", "C4"], "Fadd9": ["F3", "A3", "C4", "G4"],
}
ROOT = {"F": "F2", "C": "C2", "Dm": "D2", "Bb": "Bb1", "Gm": "G1", "A": "A1", "Am": "A1", "Fadd9": "F2"}


def arpeggio(ch, st, dur, step, vel, gain, pattern=(0, 1, 2, 3, 4, 3, 2, 1)):
    notes = [ROOT[ch][:-1] + "3"] + [up(n) for n in TRIADS[ch][:3]] + [up(TRIADS[ch][0], 2)]
    i = 0
    while i * step < dur - 0.02:
        nm = notes[pattern[i % len(pattern)] % len(notes)]
        place(piano(nm, step * 2.5, vel), st + i * step, gain * (1.0 if i % 4 == 0 else 0.8), 0.25 if i % 2 else -0.2, 0.5)
        i += 1


def pad(ch, st, dur, gain, vel=0.45, hi="violas", attack=0.6, release=0.8, bass=True):
    voices = [(hi, n) for n in TRIADS[ch][:3]]
    place(section(voices, dur, vel, attack=attack, release=release), st, gain, 0.15, 0.6)
    if bass:
        place(strings("cellos", up(ROOT[ch]), dur, vel, attack=attack, release=release), st, gain * 1.1, -0.25, 0.5)


def progression(chs, st, each):
    return [(c, st + i * each, each) for i, c in enumerate(chs)]


# ------------------------------------------------------------------ 0 – 4.3: the hook
place(strings("cellos", "D3", 4.6, 0.3, attack=1.6, release=1.0), 0.0, 0.42, -0.2, 0.6)
place(strings("basses", "D2", 4.6, 0.3, attack=2.0, release=1.0), 0.2, 0.32, -0.1, 0.5)
for at, nm, v in ((0.3, "A4", 0.38), (1.15, "F4", 0.3), (1.9, "E4", 0.36), (2.7, "D4", 0.32), (3.5, "A3", 0.26)):
    place(piano(nm, 2.4, v), at, 0.55, 0.1, 0.65)
place(piano("D3", 4.0, 0.3), 0.3, 0.35, -0.1, 0.6)
place(riser(0.9, 800, 6000), A["warm"] - 0.9, 0.035, 0, 0.6)

# ------------------------------------------------------------------ 4.3 – 12.4: childhood, warm
warm = progression(["F", "C", "Dm", "Bb", "F", "C"], A["warm"], 2 * BEAT)
for ch, st, d in warm:
    end = min(st + d, A["drain"])
    arpeggio(ch, st, end - st, BEAT / 2, 0.42, 0.42)
    pad(ch, st, end - st + 0.2, 0.5, 0.4, attack=0.5)
for at, nm in ((A["warm"] + 0.02, "C6"), (7.3, "A5"), (10.4, "F6"), (11.2, "C6")):
    place(glock(nm, 0.4), at, 0.22, 0.35, 0.7)
for at in (6.7, 8.6, 10.4):  # little harp lifts on the cuts
    for i, nm in enumerate(["F4", "A4", "C5", "F5"]):
        place(harp(nm, 0.5), at - 0.12 + i * 0.04, 0.28, -0.3 + i * 0.2, 0.6)
mel = [(0, "C5", 2), (2, "A4", 1), (3, "F4", 1), (4, "G4", 1.5), (5.5, "A4", 0.5), (6, "F4", 2), (8, "D5", 1.5), (9.5, "C5", 0.5), (10, "A4", 2)]
for b, nm, d in mel:
    at = A["warm"] + 0.75 + b * BEAT
    if at < A["drain"] - 0.2:
        place(piano(nm, d * BEAT + 0.9, 0.5), at, 0.4, 0.05, 0.55)

# ------------------------------------------------------------------ 12.4 – 20.1: the colour drains
drain = progression(["Bb", "Gm", "Dm", "A"], A["drain"], 1.35)
for ch, st, d in drain:
    for i in range(int(d / BEAT + 0.5)):
        nm = [up(n) for n in TRIADS[ch]][i % 3]
        place(piano(nm, BEAT * 2, 0.32), st + i * BEAT, 0.34, 0.1, 0.6)
    place(piano(ROOT[ch][:-1] + "2", 2.5, 0.35), st, 0.38, -0.15, 0.5)
    pad(ch, st, d + 0.3, 0.42, 0.4, attack=0.8)
place(strings("violins", "A5", 5.0, 0.28, attack=2.5, release=0.8), 13.0, 0.26, 0.3, 0.75)
tension = progression(["Dm", "Bb"], A["tension"], 1.15)
for ch, st, d in tension:
    pad(ch, st, d + 0.2, 0.36, 0.45, attack=0.4)
place(strings("violins", "E5", 2.3, 0.3, attack=1.0, release=0.4), A["tension"], 0.16, 0.3, 0.7)
place(strings("violins", "F5", 1.4, 0.3, attack=0.6, release=0.3), A["tension"] + 1.0, 0.15, -0.3, 0.7)
sub([A["tension"] + i * BEAT / 2 for i in range(int((A["turned7"] - A["tension"]) / (BEAT / 2)))], 0.08)
for i in range(int((A["turned7"] - A["tension"]) / BEAT)):
    place(piano("D2", 1.0, 0.3), A["tension"] + i * BEAT, 0.17, -0.2, 0.4)

# ------------------------------------------------------------------ 20.1 – 21.5: "Then I turned 7."
place(piano("D6", 2.5, 0.3), A["turned7"] + 0.05, 0.32, 0.2, 0.9)
place(strings("violins", "D6", 1.4, 0.25, attack=0.3, release=0.2), A["turned7"], 0.12, 0.2, 0.9)
place(riser(A["crack"] - A["turned7"] - 0.2, 300, 4000), A["turned7"] + 0.2, 0.05, 0, 0.5)

# ------------------------------------------------------------------ 21.5: the crack
K = A["crack"]
place(sfx(759), K - 0.02, 0.5, 0.0, 0.35)
place(timpani(False, 3), K, 0.9, 0, 0.45)
place(section([("cellos", "D3"), ("basses", "D2"), ("violas", "A3")], 1.0, 0.85, attack=0.01, release=0.8), K, 0.6, 0, 0.5)
t = tt(2.8)
place(np.sin(2 * np.pi * np.cumsum(28 + 45 * np.exp(-t / 0.2)) / SR) * env(t, 0.001, 1.0), K, 0.5, 0, 0.3)

# ------------------------------------------------------------------ 22.4 – 37.6: grief
grief = progression(["Dm", "Bb", "F", "C", "Dm", "Bb"], A["sad"], 4 * BEAT / 2 * 1.4)
for ch, st, d in grief:
    if st >= A["path"]:
        break
    d = min(d, A["path"] - st + 0.3)
    for i in range(int(d / BEAT)):
        nm = ([ROOT[ch][:-1] + "3"] + [up(n) for n in TRIADS[ch]])[(0, 2, 1, 3)[i % 4]]
        place(piano(nm, BEAT * 2.2, 0.3), st + i * BEAT, 0.34, -0.1 if i % 2 else 0.15, 0.6)
    place(strings("cellos", up(ROOT[ch]), d, 0.42, attack=0.9, release=0.9), st, 0.55, -0.25, 0.6)
    if st >= A["left"]:
        place(strings("basses", up(ROOT[ch]), d, 0.35, attack=1.0, release=0.9), st, 0.4, -0.1, 0.5)
lament = [(0, "A4", 3), (3, "G4", 1), (4, "F4", 2), (6, "E4", 2), (8, "F4", 1.5), (9.5, "E4", 0.5), (10, "D4", 3),
          (13, "C5", 2), (15, "Bb4", 1), (16, "A4", 3)]
for b, nm, d in lament:
    at = A["sad"] + 0.4 + b * BEAT
    if at < A["path"] - 0.3:
        place(piano(nm, d * BEAT + 1.0, 0.45), at, 0.46, 0.1, 0.65)
place(strings("violins", "A5", 3.6, 0.3, attack=1.8, release=1.0), A["left"] + 3.4, 0.22, 0.25, 0.75)  # "haven't seen him since"
dark = progression(["Gm", "Dm", "Bb", "A"], A["path"], 1.65)
for ch, st, d in dark:
    pad(ch, st, d + 0.3, 0.3, 0.38, attack=0.9)
    place(piano(ROOT[ch][:-1] + "2", 3.0, 0.32), st, 0.3, -0.15, 0.6)
    place(strings("basses", up(ROOT[ch]), d, 0.35, attack=0.8, release=0.8), st, 0.26, -0.1, 0.5)
sub([A["path"] + i * BEAT for i in range(int((A["dawn"] - A["path"]) / BEAT))], 0.09, 48, 160)
for at, nm, d in ((A["rushed"] + 0.2, "F5", 1.2), (A["rushed"] + 1.1, "E5", 0.8), (A["rushed"] + 1.9, "D5", 1.6), (A["rushed"] + 3.1, "C#5", 1.4)):
    place(strings("violins", nm, d, 0.32, attack=0.35, release=0.6), at, 0.24, 0.25, 0.75)
for at, nm in ((A["rushed"] + 0.25, "A5"), (A["rushed"] + 2.0, "F5")):
    place(piano(nm, 2.4, 0.3), at, 0.3, 0.2, 0.75)

# ------------------------------------------------------------------ 37.6 – 39.2: dawn
D0 = A["dawn"]
for i, nm in enumerate(["F3", "C4", "F4", "A4", "C5", "F5", "A5"]):
    place(harp(nm, 0.45), D0 + 0.15 + i * 0.16, 0.36, -0.4 + i * 0.13, 0.75)
place(section([("violins", "C5"), ("violas", "A4"), ("cellos", "F3")], A["love"] - D0 + 0.4, 0.4, attack=1.2, release=0.4), D0, 0.42, 0.1, 0.7)

# ------------------------------------------------------------------ 39.2 – 46.4: "I still love my dad"
love = progression(["Bb", "F", "C", "Dm", "Bb"], A["love"], 1.5)
for ch, st, d in love:
    d = min(d, A["thin"] - st)
    if d <= 0:
        break
    voices = [("violins", up(n)) for n in TRIADS[ch][:3]]
    sw = 0.7 + 0.5 * (st - A["love"]) / (A["thin"] - A["love"])  # the swell
    place(section(voices, d + 0.25, 0.55, attack=0.5, release=0.6), st, 0.8 * sw, 0.15, 0.65)
    place(section([("cellos", up(ROOT[ch])), ("basses", up(ROOT[ch]))], d + 0.25, 0.55, attack=0.4, release=0.6), st, 0.8 * sw, -0.2, 0.55)
    arpeggio(ch, st, d, BEAT / 2, 0.4, 0.38, (0, 2, 3, 2, 1, 3, 2, 3))
theme = [(0, "D5", 1.5), (1.5, "C5", 0.5), (2, "F5", 2), (4, "E5", 1), (5, "C5", 1), (6, "D5", 2), (8, "A4", 1)]
for b, nm, d in theme:
    at = A["love"] + 0.2 + b * BEAT
    if at < A["thin"] - 0.2:
        place(piano(nm, d * BEAT + 0.9, 0.6), at, 0.62, 0.05, 0.6)
        place(strings("violins", up(nm), d * BEAT * 0.98, 0.45, attack=0.12, release=0.35), at, 0.42, 0.2, 0.6)

# ------------------------------------------------------------------ 46.4 – 49.3: it thins out; silence; a heartbeat
place(strings("cellos", "D3", A["hush"][0] - A["thin"] + 0.1, 0.35, attack=0.3, release=0.8), A["thin"], 0.45, -0.2, 0.7)
place(piano("A4", 2.0, 0.28), A["thin"] + 0.15, 0.32, 0.1, 0.8)
place(piano("F4", 2.0, 0.24), A["thin"] + 1.0, 0.26, 0.1, 0.8)

# ------------------------------------------------------------------ 49.3 – 54.4: the rise
R0, I0 = A["rise"], A["impact"]
rise = [("Dm", R0, 1.5), ("Bb", R0 + 1.5, 1.5), ("F", R0 + 3.0, 0.9), ("C", R0 + 3.9, I0 - R0 - 3.9)]
for ch, st, d in rise:
    k = (st - R0) / (I0 - R0)
    arpeggio(ch, st, d, BEAT / 2, 0.45 + 0.3 * k, 0.4 + 0.15 * k, (0, 2, 3, 4, 3, 2, 3, 1))
    pad(ch, st, d + 0.15, 0.5 + 0.3 * k, 0.5 + 0.2 * k, hi="violins", attack=0.3, release=0.3)
    for e in range(int(d / (BEAT / 2))):
        s = strings("cellos", up(ROOT[ch]), BEAT * 0.36, 0.7, attack=0.01, release=0.07, start=0.05)
        place(s, st + e * BEAT / 2, (0.18 + 0.2 * k) * (1 if e % 2 == 0 else 0.7), -0.35, 0.2)
nb = int((I0 - (R0 + 1.9)) / BEAT)
for b in range(nb):
    at = R0 + 1.9 + b * BEAT
    place(kick(), at, 0.25 + 0.25 * b / nb, 0)
    place(hat(), at + BEAT / 2, 0.04, 0.35)
place(fade(timpani(True, 2)[: int(1.1 * SR)], 0.6, 0.05), I0 - 1.05, 0.7, 0, 0.4)
place(riser(1.6), I0 - 1.6, 0.07, 0, 0.5)

# ------------------------------------------------------------------ 54.4 – 58.6: the impact, full
hit = sfx(788)
PEAK788 = 2.18
place(fade(hit[int((PEAK788 - 0.02) * SR):], 0.002, 1.0), I0 - 0.02, 0.45, 0, 0.35)
place(timpani(False, 5), I0, 1.0, 0, 0.45)
full = [("Bb", I0, 1.5), ("C", I0 + 1.5, 1.2), ("Dm", I0 + 2.7, A["drop"][0] - I0 - 2.7)]
for ch, st, d in full:
    voices = [("violins", up(n)) for n in TRIADS[ch][:3]] + [("violas", n) for n in TRIADS[ch][:2]]
    place(section(voices, d + 0.2, 0.75, attack=0.08, release=0.5), st, 0.48, 0.15, 0.6)
    place(section([("cellos", up(ROOT[ch])), ("basses", up(ROOT[ch]))], d + 0.2, 0.75, attack=0.05, release=0.5), st, 0.52, -0.2, 0.5)
    for nm in (ROOT[ch][:-1] + "2", ROOT[ch][:-1] + "3"):
        place(piano(nm, d + 0.5, 0.8), st, 0.28, 0, 0.5)
    for e in range(int(d / (BEAT / 2))):
        s = strings("cellos", up(ROOT[ch]), BEAT * 0.36, 0.8, attack=0.01, release=0.07, start=0.05)
        place(s, st + e * BEAT / 2, 0.24 if e % 2 == 0 else 0.17, -0.35, 0.2)
climb = [(0, "D5"), (1, "F5"), (2, "G5"), (3, "A5"), (4, "C6")]
for b, nm in climb:
    place(piano(nm, BEAT * 1.6, 0.7), I0 + 0.1 + b * BEAT, 0.32, 0.1, 0.55)
nb = int((A["drop"][0] - I0) / BEAT)
for b in range(nb):
    at = I0 + b * BEAT
    place(kick(), at, 0.38, 0)
    place(hat(), at + BEAT / 2, 0.04, 0.35)

# ------------------------------------------------------------------ 58.6 – 59.8: a breath; 59.8 "I'm me."
P0, X0 = A["drop"][0], A["climax"]
place(strings("violins", "A5", X0 - P0 + 0.1, 0.3, attack=0.4, release=0.1), P0, 0.16, 0.2, 0.8)
place(riser(X0 - P0 - 0.1, 600, 9000), P0 + 0.1, 0.09, 0, 0.6)
place(fade(timpani(True, 4)[: int((X0 - P0 - 0.3) * SR)], 0.5, 0.05), P0 + 0.3, 0.45, 0, 0.4)
for i, nm in enumerate(["F3", "A3", "C4", "F4", "A4", "C5", "F5", "A5", "C6"]):
    place(harp(nm, 0.7), X0 - 0.36 + i * 0.045, 0.5, -0.5 + i * 0.12, 0.6)
place(sfx(2350), X0 - 0.12, 0.3, 0, 0.6)
place(timpani(False, 7), X0, 1.05, 0, 0.45)
place(section([("violins", "F5"), ("violins", "C6"), ("violins", "A5"), ("violas", "C5"), ("violas", "F4"), ("cellos", "F3"), ("basses", "F2")],
              A["dev"] - X0 + 0.6, 0.85, attack=0.02, release=1.0), X0, 0.95, 0, 0.65)
for nm in ("F2", "C3", "F3", "A4", "C5", "F5"):
    place(piano(nm, 2.5, 0.85), X0, 0.46, 0, 0.5)
for i, nm in enumerate(["C6", "F6", "A6"]):
    place(glock(nm, 0.5), X0 + 0.06 + i * 0.12, 0.32, 0.3, 0.7)
place(kick(), X0, 0.55, 0)

# ------------------------------------------------------------------ 61.4 – 67.4: building it
V0, E0 = A["dev"], A["end"]
dev = progression(["F", "C", "Dm", "Bb"], V0, (E0 - V0) / 4)
for ch, st, d in dev:
    arpeggio(ch, st, d, BEAT / 2, 0.5, 0.4, (0, 2, 4, 2, 3, 2, 4, 1))
    pad(ch, st, d + 0.2, 0.48, 0.45, hi="violins", attack=0.4)
hope = [(0, "A5", 1), (1, "C6", 1), (2, "A5", 0.5), (2.5, "G5", 1.5), (4, "E5", 1), (5, "F5", 1), (6, "G5", 2)]
for b, nm, d in hope:
    place(piano(nm, d * BEAT + 0.8, 0.5), V0 + 0.75 + b * BEAT, 0.34, 0.1, 0.6)
for b in range(int((E0 - V0) / BEAT)):
    at = V0 + b * BEAT
    place(kick(80, 38, 0.35), at, 0.22, 0)
    place(hat(), at + BEAT / 2, 0.035, 0.35)
for d in C["dev"][1:]:  # each new screen slides in
    t = tt(0.32)
    sw = filt(kit.rng.standard_normal(len(t)), "bandpass", [700, 4500]) * np.sin(np.pi * t / 0.32) ** 2
    place(sw, d["s"] - 0.06, 0.03, 0.2, 0.3)

# ------------------------------------------------------------------ 67.4 – 71.4: resolve
place(section([("violins", "A4"), ("violins", "C5"), ("violas", "F4"), ("cellos", "F3"), ("basses", "F2")], DUR - E0, 0.45, attack=0.6, release=1.0), E0, 0.6, 0, 0.75)
for i, nm in enumerate(["F3", "C4", "A4", "G5", "C5", "F5"]):
    place(piano(nm, 3.5, 0.4), E0 + 0.05 + i * 0.22, 0.32, -0.3 + i * 0.12, 0.7)
place(section([("violins", "D5"), ("violas", "Bb4"), ("cellos", "Bb2")], 1.6, 0.4, attack=0.6, release=0.8), E0 + 1.5, 0.4, 0.1, 0.75)
for nm in ("F2", "C3", "F3", "A3", "G4", "C5"):
    place(piano(nm, 3.0, 0.38), E0 + 2.6, 0.28, 0, 0.75)
for i, nm in enumerate(["F5", "C6"]):
    place(glock(nm, 0.35), C["wordmark"][0] + 0.3 + i * 0.16, 0.22, 0.1, 0.8)


# ------------------------------------------------------------------ mix
mix = M.wet(0.6, reverb_ir())


def duck(t0, t1, fall=0.12, depth=0.0):
    """A gain curve that pulls everything down to `depth` over [t0, t1]."""
    g = np.ones(len(mix))
    a, a2, b = int(t0 * SR), int((t0 + fall) * SR), int(t1 * SR)
    g[a:a2] = np.linspace(1, depth, a2 - a) ** 2
    g[a2:b] = depth
    return g


# near silence under "Then I turned 7." and real silence before "It's not."
g = duck(A["turned7"] - 0.05, A["crack"] - 0.05, 0.2, 0.18) * duck(A["hush"][0], A["hush"][1] - 0.02, 0.15, 0.0)
mix *= g[:, None]
# then the one heartbeat, alone in the silence
x = stereo(sfx(490), 0) * 0.6
i0 = int((A["heartbeat"] - 0.02) * SR)
mix[i0: i0 + len(x)] += x[: len(mix) - i0]

write(HERE / "story.wav", master(mix, N))
