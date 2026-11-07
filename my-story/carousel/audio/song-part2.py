"""An original song for part 2 (the people who stayed), 86 BPM in G major,
cut to carousel/slides-part2.json. Warmer than part 1: no dark beat, just a
gentle groove that falls away for the hard slides and comes back fuller.

  who stayed     solo piano, the theme
  mom, sister    warm arpeggios, strings, glockenspiel; a soft groove grows
  childhood
  the hard part  the groove falls away: piano and cello, minor-leaning
  anger          a low drone and a slow pulse
  worth it       a harp sweep, the strings open into G major
  yoru           the groove comes back, brighter
  mom. sis.      the biggest moment: full strings and timpani under the theme
  part 3         a forward pulse, then let go

Output: carousel/audio/song-part2.wav (48 kHz stereo 16-bit).
"""

import pathlib
import sys

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from band import CH, Band, chords  # noqa: E402  (also puts film/audio on the path)
from kit import filt, glock, harp, kick, piano, riser, section, strings, timpani, tt, up  # noqa: E402

B = Band(HERE.parent / "slides-part2.json", 2009)
BEAT, TOTAL = B.beat, B.total
at, slide, place = B.at, B.slide, B.place
arp, pad, drums = B.arp, B.pad, B.drums


def theme(b0, vel, gain, until=None, strings_too=False):
    mel = [(0, "B4", 1), (1, "D5", 1), (2, "G5", 1.5), (3.5, "F#5", 0.5), (4, "E5", 2), (6, "D5", 1), (7, "B4", 1),
           (8, "C5", 1), (9, "B4", 1), (10, "A4", 1.5), (11.5, "G4", 0.5), (12, "A4", 2), (14, "B4", 2)]
    for b, nm, d in mel:
        if until is not None and b0 + b >= until:
            break
        place(piano(nm, d * BEAT + 0.9, vel), at(b0 + b), gain, 0.05, 0.6)
        if strings_too:
            place(strings("violins", up(nm), d * BEAT * 0.98, 0.42, attack=0.1, release=0.35), at(b0 + b), gain * 0.55, 0.2, 0.6)


def lift(b, gain=0.3):
    for i, nm in enumerate(["G4", "B4", "D5", "G5"]):
        place(harp(nm, 0.5), at(b) - 0.12 + i * 0.04, gain, -0.3 + i * 0.2, 0.6)


# ------------------------------------------------------------------ who stayed (slides 1–2)
B.level = 2.0
H1 = slide(3)
for c, b, n in chords([("G", 4), ("Em", 4), ("C", 4)], 0):
    n = min(n, H1 - b)
    place(piano(up(CH[c][1], 1), at(n) + 1.2, 0.35), at(b), 0.42, -0.15, 0.6)
    for i, t in enumerate(CH[c][0]):
        place(piano(up(t), at(n) + 0.8, 0.3), at(b) + 0.06 * i, 0.26, 0.1, 0.6)
theme(0, 0.48, 0.5, until=H1)
place(section([("violas", "G3"), ("violas", "D4"), ("cellos", "G2")], at(H1 - slide(2)), 0.38, attack=1.4, release=0.6), at(slide(2)), 0.45, 0, 0.7)

# ------------------------------------------------------------------ mom, sister, childhood (slides 3–10)
B.level = 1.15
C0, C1 = H1, slide(11)
for c, b, n in chords([("G", 4), ("D", 4), ("Em", 4), ("C", 4)] * 3, C0):
    n = min(n, C1 - b)
    if n <= 0:
        break
    arp(c, b, n, 0.42, 0.5)
    pad(c, b, n, 0.42, 0.42, attack=0.7)
theme(slide(5), 0.55, 0.5, until=C1)
lift(slide(3))
lift(slide(4))
drums(slide(5), slide(7), 0.4, kick_pat=(), clap_on=(), hats=0.5)
drums(slide(7), C1, 0.6, kick_pat=(0, 2), clap_on=(1, 3), hats=0.5)
for i in (3, 5, 7, 9):
    place(glock(["D6", "G6", "B5", "E6"][i % 4], 0.35), at(slide(i)), 0.18, 0.3, 0.7)

# ------------------------------------------------------------------ the hard part (slides 11–15)
B.level = 1.85
D0, D1 = C1, slide(16)
for c, b, n in chords([("Em", 4), ("C", 5), ("G", 4), ("D", 5), ("C", 6), ("G", 6)], D0):
    n = min(n, D1 - b)
    if n <= 0:
        break
    tones, root = CH[c]
    for i in range(int(n)):
        place(piano(up(tones[(0, 2, 1)[i % 3]]), BEAT * 2.2, 0.32), at(b + i), 0.48, 0.12, 0.6)
    place(piano(up(root, 1), at(n) + 1.0, 0.36), at(b), 0.5, -0.15, 0.55)
    pad(c, b, n, 0.5, 0.42, attack=0.9)
place(strings("violins", "B5", at(slide(13) - slide(12)) + 0.4, 0.3, attack=1.4, release=0.5), at(slide(12)), 0.2, 0.25, 0.75)
for b, nm in ((slide(13) + 1, "G5"), (slide(13) + 2.5, "B5")):  # "handsome son"
    place(glock(nm, 0.3), at(b), 0.18, 0.3, 0.8)
place(glock("D6", 0.3), at(slide(14) + 1.5), 0.16, -0.2, 0.8)
place(strings("violins", "D6", at(D1 - slide(15)), 0.3, attack=1.5, release=0.3), at(slide(15)), 0.18, 0.25, 0.75)

# ------------------------------------------------------------------ anger (slide 16)
B.level = 1.3
A0, A1 = D1, slide(17)
place(section([("cellos", "E2"), ("basses", "E1"), ("violas", "B3")], at(A1 - A0) + 0.2, 0.45, attack=0.6, release=0.4), at(A0), 0.55, 0, 0.6)
for i in range(A1 - A0):
    place(piano("E2", 1.2, 0.35), at(A0 + i), 0.3 if i % 2 == 0 else 0.2, -0.2, 0.4)
t = tt(at(A1 - A0))
hb = np.zeros_like(t)
for b in range(0, A1 - A0, 2):  # a slow pulse, like a heartbeat
    for o, g in ((0, 1.0), (0.28, 0.7)):
        tt0 = t - (at(b) + o)
        hb += np.where(tt0 >= 0, np.sin(2 * np.pi * 48 * tt0) * np.exp(-np.maximum(tt0, 0) / 0.09), 0) * g
place(filt(hb, "lowpass", 140), at(A0), 0.35, 0, 0)
place(riser(at(2)), at(A1 - 2), 0.05, 0, 0.5)

# ------------------------------------------------------------------ worth it (slide 17)
B.level = 1.2
W0, W1 = A1, slide(18)
for i, nm in enumerate(["G3", "B3", "D4", "G4", "B4", "D5", "G5", "B5", "D6"]):
    place(harp(nm, 0.7), at(W0) - 0.36 + i * 0.045, 0.45, -0.5 + i * 0.12, 0.6)
place(timpani(False, 3), at(W0), 0.6, 0, 0.5)
for c, b, n in chords([("G", 4), ("D", 4)], W0):
    voices = [("violins", up(x)) for x in CH[c][0]]
    place(section(voices, at(n) + 0.2, 0.5, attack=0.4, release=0.6), at(b), 0.62, 0.15, 0.65)
    place(section([("cellos", up(CH[c][1], 1)), ("basses", up(CH[c][1], 1))], at(n) + 0.2, 0.5, attack=0.3, release=0.6), at(b), 0.55, -0.2, 0.55)
    arp(c, b, n, 0.4, 0.4)
theme(W0, 0.6, 0.5, until=W1, strings_too=True)

# ------------------------------------------------------------------ yoru (slide 18)
B.level = 1.0
Y0, Y1 = W1, slide(19)
for c, b, n in chords([("Em", 2), ("C", 2), ("G", 2)], Y0):
    arp(c, b, n, 0.52, 0.48, pattern=(0, 2, 4, 2, 3, 2, 4, 1))
    pad(c, b, n, 0.48, 0.48, hi="violins", attack=0.3)
    B.subbass(c, b, n, 0.1)
drums(Y0, Y1, 0.85, kick_pat=(0, 1.5, 2.5), hats=0.5)
for b, nm in ((0, "B5"), (2, "E6"), (4, "D6")):
    place(glock(nm, 0.4), at(Y0 + b), 0.2, 0.3, 0.7)

# ------------------------------------------------------------------ mom. sis. (slide 19)
B.level = 1.0
M0, M1 = Y1, slide(20)
place(timpani(False, 7), at(M0), 0.9, 0, 0.45)
place(kick(), at(M0), 0.45, 0)
for c, b, n in chords([("Cmaj7", 2), ("D", 2)], M0):
    voices = [("violins", up(x)) for x in CH[c][0]] + [("violas", x) for x in CH[c][0][:2]]
    place(section(voices, at(n) + 0.3, 0.75, attack=0.05, release=0.8), at(b), 0.7, 0.1, 0.65)
    place(section([("cellos", up(CH[c][1], 1)), ("basses", up(CH[c][1], 1))], at(n) + 0.3, 0.7, attack=0.05, release=0.8), at(b), 0.65, -0.15, 0.55)
    for nm in (up(CH[c][1], 1), up(CH[c][1], 2)):
        place(piano(nm, at(n) + 0.8, 0.8), at(b), 0.36, 0, 0.55)
for b, nm, d in ((0, "E5", 1), (1, "G5", 1), (2, "F#5", 1), (3, "A5", 1)):
    place(piano(nm, d * BEAT + 0.8, 0.7), at(M0 + b), 0.48, 0.05, 0.6)
    place(strings("violins", up(nm), d * BEAT * 0.98, 0.5, attack=0.08, release=0.3), at(M0 + b), 0.32, 0.2, 0.6)

# ------------------------------------------------------------------ part 3 (slide 20)
B.level = 1.0
E0 = M1
for i, nm in enumerate(["G3", "B3", "D4", "G4", "B4", "D5", "G5"]):
    place(harp(nm, 0.6), at(E0) - 0.3 + i * 0.045, 0.4, -0.5 + i * 0.15, 0.6)
place(timpani(False, 9), at(E0), 0.8, 0, 0.5)
place(section([("violins", "B4"), ("violins", "D5"), ("violas", "G4"), ("cellos", "G2"), ("basses", "G1")], at(TOTAL - E0), 0.55, attack=0.2, release=1.2), at(E0), 0.65, 0, 0.7)
for i in range(TOTAL - E0 - 2):  # a forward pulse that thins out
    place(piano(["G3", "D4", "B4", "D4"][i % 4], BEAT * 1.6, 0.4), at(E0 + i), 0.4 * (1 - i / (TOTAL - E0)), 0.15, 0.6)
    place(kick(80, 38, 0.35), at(E0 + i), 0.22 * (1 - i / (TOTAL - E0)), 0)
for nm in ("G2", "D3", "G3", "B3", "A4", "D5"):
    place(piano(nm, 3.5, 0.4), at(TOTAL - 4), 0.3, 0, 0.75)
for i, nm in enumerate(["G5", "D6"]):
    place(glock(nm, 0.35), at(TOTAL - 3.5) + i * 0.16, 0.22, 0.1, 0.8)

B.level = 1.0
B.swipes()
B.write(HERE / "song-part2.wav")
