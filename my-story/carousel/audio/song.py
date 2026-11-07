"""An original song for the slides video, 90 BPM, cut to the slide timeline in
carousel/slides.json (each slide lasts a whole number of beats, so every
swipe lands on a beat). C major for the good years and the way back; A minor
with a beat under it for the lost years.

  childhood      soft piano, the theme, strings creeping in
  the split      the piano thins out, minor, low strings
  the lost years a beat drops: kick, clap, hats, sub, a dark piano ostinato;
                 harder from "always out"
  what nobody saw  everything cuts out but a low drone
  realising      piano and strings, slow
  the flip       an impact, a timpani roll, a riser
  dad            the theme returns with the strings
  building it    the groove comes back, in major, brighter
  the ending     the biggest chord in the song, then let go

Output: carousel/audio/song.wav (48 kHz stereo 16-bit).
"""

import pathlib
import sys

import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from band import CH, Band, chords  # noqa: E402  (also puts film/audio on the path)
import kit  # noqa: E402
from kit import SR, filt, glock, harp, kick, piano, riser, section, sfx, strings, timpani, tt, up  # noqa: E402

B = Band(HERE.parent / "slides.json", 1212)
BEAT, TOTAL = B.beat, B.total
at, slide, place = B.at, B.slide, B.place
arp, pad, subbass, drums = B.arp, B.pad, B.subbass, B.drums


def theme(b0, vel, gain, bend=None, strings_too=False):
    mel = [(0, "E5", 1), (1, "G5", 1), (2, "E5", 1.5), (3.5, "D5", 0.5), (4, "D5", 2), (6, "C5", 1), (7, "D5", 1),
           (8, "E5", 1), (9, "C5", 1), (10, "A4", 2), (12, "C5", 1), (13, "D5", 1), (14, "C5", 2)]
    for b, nm, d in mel:
        if bend is not None and b0 + b >= bend:
            break
        place(piano(nm, d * BEAT + 0.9, vel), at(b0 + b), gain, 0.05, 0.6)
        if strings_too:
            place(strings("violins", up(nm), d * BEAT * 0.98, 0.42, attack=0.1, release=0.35), at(b0 + b), gain * 0.55, 0.2, 0.6)


# ------------------------------------------------------------------ childhood (slides 1–3)
A0, A1 = 0, slide(4)
for c, b, n in chords([("C", 4), ("G", 4), ("Am", 4), ("F", 4), ("C", 1)], A0):
    arp(c, b, n, 0.42, 0.62)
    if b >= 6:
        pad(c, b, n, 0.45, 0.4, attack=1.0)
theme(A0 + 0.0, 0.52, 0.66, bend=A1)
for b, nm in ((0, "G6"), (8, "E6"), (12, "C6")):
    place(glock(nm, 0.35), at(b), 0.18, 0.35, 0.7)

# ------------------------------------------------------------------ the split (slides 4–6)
B.level = 1.75
B0, B1 = A1, slide(7)
split = chords([("Am", 4), ("F", 4), ("Dm", 3), ("E", 2), ("Am", 3), ("F", 2), ("E", 2)], B0)
for c, b, n in split:
    tones, root = CH[c]
    for i in range(n):
        place(piano(up(tones[i % 3]), BEAT * 2.2, 0.32), at(b + i), 0.62, 0.12, 0.6)
    place(piano(up(root, 1), at(n) + 1.0, 0.36), at(b), 0.62, -0.15, 0.55)
    pad(c, b, n, 0.72, 0.42, attack=0.8)
place(strings("basses", "A1", at(B1 - slide(6)), 0.35, attack=1.0, release=0.6), at(slide(6)), 0.4, -0.1, 0.5)  # dad left
place(strings("violins", "E5", at(B1 - slide(6)) + 0.3, 0.28, attack=2.0, release=0.4), at(slide(6)), 0.2, 0.25, 0.75)
place(riser(at(1.5), 400, 5000), at(B1 - 1.5), 0.05, 0, 0.4)

# ------------------------------------------------------------------ the lost years (slides 7–13 start)
B.level = 1.0
C0, C1 = B1, slide(13)
HARD = slide(10)  # "always out. always moving."
lost = chords([("Am", 4), ("F", 4), ("C", 4), ("E", 4)] * 2, C0)
for c, b, n in lost:
    n = min(n, C1 - b)
    if n <= 0:
        break
    hard = b >= HARD
    arp(c, b, n, 0.5 if hard else 0.42, 0.46 if hard else 0.42, pattern=(0, 3, 1, 3, 2, 3, 1, 3),
        dur=0.22, lp=None if hard else 1800)
    subbass(c, b, n, 0.11 if hard else 0.09)
    pad(c, b, n, 0.36 if hard else 0.3, 0.42, attack=0.5, bass=False)
drums(C0, HARD, 0.8, hats=0.5)
drums(HARD, C1, 1.0, kick_pat=(0, 1.5, 2.5, 3.75), hats=0.25, open_hat=True)
place(strings("violins", "E6", at(C1 - slide(12)), 0.3, attack=1.5, release=0.2), at(slide(12)), 0.14, 0.3, 0.7)
place(riser(at(2)), at(C1 - 2), 0.05, 0, 0.5)

# ------------------------------------------------------------------ what nobody saw (slide 13)
B.level = 1.6
R0, R1 = C1, slide(14)
place(timpani(False, 3), at(R0), 0.55, 0, 0.5)
place(section([("cellos", "A2"), ("basses", "A1")], at(R1 - R0), 0.4, attack=0.05, release=1.2), at(R0), 0.5, 0, 0.6)
for b, nm in ((1, "E5"), (3, "C5"), (5.5, "B4"), (8, "A4")):
    place(piano(nm, 2.4, 0.3), at(R0 + b), 0.32, 0.2, 0.85)
t = tt(at(R1 - R0))
hb = np.zeros_like(t)
for b in range(0, R1 - R0, 2):  # a slow pulse, like a heartbeat
    for o in (0, 0.28):
        tt0 = t - (at(b) + o)
        hb += np.where(tt0 >= 0, np.sin(2 * np.pi * 48 * tt0) * np.exp(-np.maximum(tt0, 0) / 0.09), 0) * (1 if o == 0 else 0.7)
place(filt(hb, "lowpass", 140), at(R0), 0.35, 0, 0)

# ------------------------------------------------------------------ realising (slides 14–15)
B.level = 1.8
E0, E1 = R1, slide(16)
for c, b, n in chords([("F", 4), ("C", 4), ("G", 4)], E0):
    n = min(n, E1 - b)
    arp(c, b, n, 0.34, 0.65, step=1, pattern=(0, 2, 1, 3))
    pad(c, b, n, 0.66, 0.42, attack=0.9)
place(strings("violins", "C6", at(E1 - slide(15)), 0.3, attack=1.6, release=0.3), at(slide(15)), 0.16, 0.25, 0.75)

# ------------------------------------------------------------------ the flip (slide 16)
B.level = 1.1
F0, F1 = E1, slide(17)
place(timpani(False, 5), at(F0), 0.9, 0, 0.45)
place(sfx(788)[int(2.16 * SR):], at(F0) - 0.02, 0.35, 0, 0.35)
place(section([("cellos", "F2"), ("basses", "F1"), ("violas", "C4")], 1.0, 0.8, attack=0.01, release=0.8), at(F0), 0.55, 0, 0.5)
for c, b, n in chords([("F", 3), ("G", 3)], F0):
    arp(c, b, n, 0.45 + 0.1 * (b - F0) / 3, 0.36, pattern=(0, 2, 3, 4, 3, 2))
place(kit.fade(timpani(True, 2)[: int(at(3) * SR)], 0.8, 0.05), at(F1 - 3), 0.55, 0, 0.4)
place(riser(at(3)), at(F1 - 3), 0.07, 0, 0.5)

# ------------------------------------------------------------------ dad (slides 17–18)
B.level = 1.55
G0, G1 = F1, slide(19)
for c, b, n in chords([("C", 4), ("G", 4), ("Am", 3), ("F", 2)], G0):
    voices = [("violins", up(x)) for x in CH[c][0]]
    place(section(voices, at(n) + 0.2, 0.5, attack=0.4, release=0.6), at(b), 0.72, 0.15, 0.65)
    place(section([("cellos", up(CH[c][1], 1)), ("basses", up(CH[c][1], 1))], at(n) + 0.2, 0.5, attack=0.3, release=0.6), at(b), 0.55, -0.2, 0.55)
    arp(c, b, n, 0.38, 0.38)
theme(G0, 0.6, 0.6, bend=G1, strings_too=True)
drums(G0 + 4, G1, 0.45, kick_pat=(0, 2), clap_on=(), hats=1)

# ------------------------------------------------------------------ building it (slide 19)
B.level = 1.1
H0, H1 = G1, slide(20)
for c, b, n in chords([("C", 2), ("G", 2), ("Am", 2), ("F", 3)], H0):
    arp(c, b, n, 0.55, 0.5, pattern=(0, 2, 4, 2, 3, 2, 4, 1))
    pad(c, b, n, 0.5, 0.48, hi="violins", attack=0.3)
    subbass(c, b, n, 0.11)
drums(H0, H1, 0.85, kick_pat=(0, 1.5, 2.5), hats=0.5)
for b, nm in ((0, "E6"), (2, "D6"), (4, "C6"), (6, "G6")):
    place(glock(nm, 0.4), at(H0 + b), 0.2, 0.3, 0.7)

# ------------------------------------------------------------------ the ending (slide 20)
B.level = 1.0
I0 = H1
for i, nm in enumerate(["C3", "E3", "G3", "C4", "E4", "G4", "C5", "E5", "G5"]):
    place(harp(nm, 0.7), at(I0) - 0.36 + i * 0.045, 0.45, -0.5 + i * 0.12, 0.6)
place(sfx(2350), at(I0) - 0.1, 0.25, 0, 0.6)
place(timpani(False, 7), at(I0), 0.95, 0, 0.45)
place(kick(), at(I0), 0.5, 0)
end = chords([("F", 2), ("G", 2), ("C", TOTAL - I0 - 4)], I0)
for c, b, n in end:
    big = c != "C"
    voices = [("violins", up(x)) for x in CH[c][0]] + [("violas", x) for x in CH[c][0][:2]]
    place(section(voices, at(n) + 0.4, 0.75 if big else 0.6, attack=0.05 if big else 0.4, release=1.2), at(b), 0.7, 0.1, 0.65)
    place(section([("cellos", up(CH[c][1], 1)), ("basses", up(CH[c][1], 1))], at(n) + 0.4, 0.7, attack=0.05, release=1.2), at(b), 0.65, -0.15, 0.55)
    for nm in (up(CH[c][1], 1), up(CH[c][1], 2), up(CH[c][0][2], 1)):
        place(piano(nm, at(n) + 1.0, 0.8 if big else 0.55), at(b), 0.36, 0, 0.55)
place(timpani(False, 9), at(I0 + 4), 0.7, 0, 0.5)
for i, nm in enumerate(["C6", "E6", "G6"]):
    place(glock(nm, 0.4), at(I0 + 4) + 0.06 + i * 0.12, 0.24, 0.3, 0.75)
for b, nm, d in ((5, "E5", 1), (6, "D5", 1), (7, "C5", 3)):
    place(piano(nm, d * BEAT + 1.2, 0.5), at(I0 + b), 0.4, 0.05, 0.7)

B.level = 1.0
B.swipes()
B.write(HERE / "song.wav")
