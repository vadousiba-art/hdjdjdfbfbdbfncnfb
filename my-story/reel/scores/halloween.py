"""Halloween ("i stayed home on purpose"): 84 BPM, D minor. A music-box theme
over a soft pad for the hook, nostalgic piano for the Halloweens he used to
love that falls away to one low note on "we are not friends anymore", a low
pulse under "people say you're missing out", a lo-fi groove under the night
montage, strings rising into "i want to spend it building", and the
music-box theme again in D major when the Halloween logo appears."""

import numpy as np

import kit
from band import CH, Band, chords
from kit import SR, filt, glock, harp, piano, riser, section, sfx, strings, timpani, up
from sfx import flash_sound, keys, swish

THEME = [(0, "D6", 0.5), (0.5, "F6", 0.5), (1, "A6", 1), (2, "G6", 0.5), (2.5, "F6", 0.5), (3, "E6", 0.5), (3.5, "C#6", 0.5), (4, "D6", 2)]
THEME_MAJOR = [(0, "D6", 0.5), (0.5, "F#6", 0.5), (1, "A6", 1), (2, "B6", 0.5), (2.5, "A6", 0.5), (3, "F#6", 0.5), (3.5, "E6", 0.5), (4, "D6", 2)]


def music(ctx):
    E, beat, cap_at, DUR, N = ctx.E, ctx.beat, ctx.cap_at, ctx.DUR, ctx.N
    BPM = 84
    BEAT = 60 / BPM
    B = Band({"bpm": BPM, "slides": [{"beats": int(np.ceil(DUR / BEAT)) + 2}]}, 3110)
    place = B.place

    def bt(sec):  # seconds -> nearest beat
        return int(round(sec / BEAT))

    S = {k: bt(v["start"]) for k, v in beat.items()}
    END = bt(E["speech_end"])

    def music_box(notes, b0, gain, until=None):
        for b, nm, d in notes:
            if until is not None and b0 + b >= until:
                break
            place(glock(nm, 0.4), B.at(b0 + b), gain, 0.25, 0.7)
            place(piano(nm, d * BEAT + 0.6, 0.3), B.at(b0 + b), gain * 0.5, -0.1, 0.7)

    # the hook: the music box over a soft D minor pad
    place(section([("violas", "D4"), ("violas", "A3"), ("cellos", "D3")], beat["H1"]["end"] + 0.5, 0.35, attack=0.6, release=0.6), 0, 0.45, 0, 0.7)
    music_box(THEME, 0, 0.32, until=S["H2"] + 1)
    # the Halloweens he used to love: nostalgic piano, until "not friends anymore"
    lost = bt(cap_at("but we are not")["s"])
    for c, b, n in chords([("Dm", 4), ("Bb", 4), ("F", 4), ("C", 4)], S["H2"]):
        n = min(n, lost - b)
        if n > 0:
            B.arp(c, b, n, 0.4, 0.4)
            B.pad(c, b, n, 0.3, 0.4, attack=0.6)
    place(strings("cellos", "D2", B.at(S["H3"] - lost) + 0.6, 0.35, attack=0.2, release=0.8), B.at(lost), 0.5, -0.1, 0.6)
    place(piano("A4", 2.5, 0.3), B.at(lost) + 0.6, 0.3, 0.15, 0.85)
    # "people say you're missing out": a low pulse, tension
    for c, b, n in chords([("Gm", 4), ("Dm", 4)], S["H3"]):
        n = min(n, S["NIGHT"] - b)
        if n > 0:
            B.pad(c, b, n, 0.32, 0.42, attack=0.5)
    for i in range(S["H3"], S["NIGHT"]):
        place(piano("D2", 1.0, 0.32), B.at(i), 0.28 if i % 2 == 0 else 0.18, -0.15, 0.4)
    place(riser(B.at(2)), B.at(S["NIGHT"] - 2), 0.06, 0, 0.5)
    # the night: a lo-fi groove under the montage, carrying on softer
    groove_end = S["H6"]
    for c, b, n in chords([("F", 4), ("C", 4), ("Dm", 4), ("Bb", 4)] * 2, S["NIGHT"]):
        n = min(n, groove_end - b)
        if n > 0:
            hard = b < S["H4"]
            B.arp(c, b, n, 0.48 if hard else 0.4, 0.42 if hard else 0.34, pattern=(0, 2, 4, 2, 3, 2, 4, 1))
            B.pad(c, b, n, 0.3, 0.44, attack=0.3)
            B.subbass(c, b, n, 0.09)
    B.drums(S["NIGHT"], S["H4"], 0.85, kick_pat=(0, 1.5, 2.5), hats=0.5)
    B.drums(S["H4"], groove_end, 0.5, kick_pat=(0, 2), clap_on=(), hats=0.5)
    # "i want to spend it building": the strings rise
    place(section([("violins", "D5"), ("violins", "F5"), ("violas", "Bb3"), ("cellos", "Bb2")], beat["H6"]["end"] - beat["H6"]["start"] + 0.3, 0.5, attack=0.8, release=0.4), beat["H6"]["start"], 0.55, 0, 0.65)
    # the logo: a sparkle, a harp, the music box in D major; resolve under "i've got to build"
    L0 = beat["H7"]["start"]
    for i, nm in enumerate(["D4", "F#4", "A4", "D5", "F#5", "A5", "D6"]):
        place(harp(nm, 0.6), L0 - 0.25 + i * 0.045, 0.42, -0.5 + i * 0.15, 0.6)
    place(timpani(False, 5), L0, 0.5, 0, 0.5)
    music_box(THEME_MAJOR, bt(L0), 0.42)
    for c, b, n in chords([("D", 4), ("G", 4), ("D", END - bt(L0) - 8 + 4)], bt(L0)):
        voices = [("violins", up(x)) for x in CH[c][0]]
        place(section(voices, B.at(n) + 0.4, 0.45, attack=0.4, release=0.8), B.at(b), 0.45, 0.15, 0.65)
        place(strings("cellos", up(CH[c][1], 1), B.at(n) + 0.4, 0.45, attack=0.4, release=0.8), B.at(b), 0.42, -0.2, 0.55)
    B.level = 3.2  # the end card has no voice over it: let the last chord be heard
    place(section([("violins", "F#5"), ("violins", "A5"), ("violas", "D4"), ("cellos", "D3"), ("basses", "D2")], DUR - B.at(END) + 0.5, 0.5, attack=0.1, release=1.2), B.at(END), 0.55, 0, 0.7)
    for i, nm in enumerate(["D6", "F#6", "A6"]):
        place(glock(nm, 0.4), B.at(END) + 0.3 + i * 0.14, 0.22, 0.2, 0.8)
    for nm in ("D3", "A3", "F#4", "D5"):
        place(piano(nm, 2.5, 0.5), B.at(END), 0.3, 0, 0.7)
    return B.mix.wet(0.5, kit.reverb_ir(2.6))[:N].mean(axis=1)


def effects(ctx):
    beat, put = ctx.beat, ctx.put
    for item in beat["H2"]["broll"]:
        if item["type"] == "flash":
            put(flash_sound(), item["at"], 0.16)
    for item in beat["NIGHT"]["broll"]:
        put(swish(), item["at"] - 0.1, 0.05)
        if item["type"] == "code":
            put(filt(keys(item["until"] - item["at"]), "lowpass", 7000), item["at"], 0.035)
    sparkle = sfx(2350)[: int(1.6 * SR)]
    put(sparkle, beat["H7"]["start"] - 0.15, 0.25)
