"""Part 3 ("the build"): 80 BPM, A minor into C major. A low pulse under the
hook, slow piano for the context, a soft lo-fi groove for YORU and the build
that stutters out on "broken", strings alone for the turn and warmth on "now
i'm doing it", strings under the family photos, the full groove to the end."""

import numpy as np

import kit
from band import CH, Band, chords
from kit import filt, glock, harp, piano, riser, section, strings, timpani, up
from sfx import flash_sound, glitch, keys, swish


def music(ctx):
    E, beat, cap_at, DUR, N = ctx.E, ctx.beat, ctx.cap_at, ctx.DUR, ctx.N
    BPM = 80
    BEAT = 60 / BPM
    TOTAL = int(np.ceil(DUR / BEAT)) + 2
    B = Band({"bpm": BPM, "slides": [{"beats": TOTAL}]}, 1031)
    place = B.place

    def bt(sec):  # seconds -> nearest beat
        return int(round(sec / BEAT))

    S = {k: bt(v["start"]) for k, v in beat.items()}
    END = bt(E["speech_end"])

    # hook: a low pulse and held strings
    B.level = 1.0
    place(section([("cellos", "A2"), ("basses", "A1"), ("violas", "E3")], beat["A1"]["end"] + 0.4, 0.4, attack=0.8, release=0.6), 0, 0.5, 0, 0.6)
    for i in range(S["A2"]):
        place(piano("A2", 1.4, 0.32), B.at(i), 0.3 if i % 2 == 0 else 0.18, -0.1, 0.4)
    place(piano("E5", 2.5, 0.3), 0.1, 0.25, 0.2, 0.8)
    # context: slow piano over Am F C G
    for c, b, n in chords([("Am", 4), ("F", 4), ("C", 4), ("G", 4)], S["A2"]):
        n = min(n, S["A3"] - b)
        if n > 0:
            B.arp(c, b, n, 0.34, 0.34, step=1, pattern=(0, 2, 1, 3))
            B.pad(c, b, n, 0.3, 0.38, attack=0.9)
    # about yoru: a soft lo-fi groove comes in
    for c, b, n in chords([("C", 4), ("G", 4), ("Am", 4), ("F", 4)] * 2, S["A3"]):
        n = min(n, S["VO1"] - b)
        if n > 0:
            B.arp(c, b, n, 0.4, 0.36)
            B.pad(c, b, n, 0.3, 0.4, attack=0.5)
            B.subbass(c, b, n, 0.08)
    B.drums(S["A3"] + 2, S["VO1"], 0.55, kick_pat=(0, 2.5), hats=0.5)
    # the build: the groove carries on, then stutters out on "broken"
    broke = bt(cap_at("i've broken")["s"])
    for c, b, n in chords([("Am", 4), ("F", 4), ("C", 4), ("G", 4)] * 3, S["VO1"]):
        n = min(n, broke - b)
        if n > 0:
            B.arp(c, b, n, 0.44, 0.38, pattern=(0, 3, 1, 3, 2, 3, 1, 3), dur=0.25)
            B.pad(c, b, n, 0.26, 0.4, attack=0.4, bass=False)
            B.subbass(c, b, n, 0.09)
    B.drums(S["VO1"], broke, 0.7, kick_pat=(0, 1.5, 2.5), hats=0.5)
    place(section([("cellos", "A2"), ("basses", "A1")], B.at(S["A4"] - broke) + 0.3, 0.35, attack=0.05, release=0.6), B.at(broke), 0.4, 0, 0.6)
    # the turn: strings alone, then warmth on "now i'm doing it"
    now = cap_at("now i'm doing it")["s"]
    place(section([("violins", "E5"), ("violas", "A4"), ("cellos", "A2")], now - beat["A4"]["start"] + 0.3, 0.38, attack=1.0, release=0.5), beat["A4"]["start"], 0.5, 0, 0.7)
    for i, nm in enumerate(["C4", "E4", "G4", "C5", "E5", "G5"]):
        place(harp(nm, 0.5), now - 0.15 + i * 0.05, 0.3, -0.3 + i * 0.12, 0.6)
    place(section([("violins", "G5"), ("violins", "E5"), ("violas", "C4"), ("cellos", "C3")], beat["VO2"]["start"] - now + 0.5, 0.45, attack=0.4, release=0.8), now, 0.55, 0, 0.7)
    build = cap_at("that will")["s"] + 0.25
    place(timpani(False, 3), build, 0.45, 0, 0.5)
    # the why: strings swell under the theme
    for c, b, n in chords([("F", 4), ("C", 4), ("G", 4), ("Am", 4)] * 2, S["VO2"]):
        n = min(n, S["A5"] - b)
        if n > 0:
            voices = [("violins", up(x)) for x in CH[c][0]]
            place(section(voices, B.at(n) + 0.3, 0.45, attack=0.5, release=0.7), B.at(b), 0.45, 0.15, 0.65)
            place(strings("cellos", up(CH[c][1], 1), B.at(n) + 0.3, 0.45, attack=0.5, release=0.7), B.at(b), 0.42, -0.2, 0.55)
            B.arp(c, b, n, 0.36, 0.3, step=1, pattern=(0, 2, 3, 2))
    for b, nm, d in ((0, "C5", 2), (2, "E5", 2), (4, "D5", 3), (8, "C5", 2), (10, "A4", 2), (12, "G4", 3)):
        place(piano(nm, d * BEAT + 0.8, 0.45), B.at(S["VO2"] + b), 0.32, 0.05, 0.65)
    # the ending: the full groove, resolving on C as the speech ends
    for c, b, n in chords([("C", 4), ("G", 4), ("Am", 4), ("F", 4)] * 3, S["A5"]):
        n = min(n, END - b)
        if n > 0:
            B.arp(c, b, n, 0.5, 0.4, pattern=(0, 2, 4, 2, 3, 2, 4, 1))
            B.pad(c, b, n, 0.34, 0.46, hi="violins", attack=0.3)
            B.subbass(c, b, n, 0.09)
    B.drums(S["A5"], END, 0.8, kick_pat=(0, 1.5, 2.5), hats=0.5, open_hat=True)
    B.level = 1.8  # the end card has no voice over it: let the last chord be heard
    place(section([("violins", "E5"), ("violins", "G5"), ("violas", "C4"), ("cellos", "C3"), ("basses", "C2")], DUR - B.at(END) + 0.5, 0.5, attack=0.1, release=1.2), B.at(END), 0.55, 0, 0.7)
    for nm in ("C3", "G3", "E4", "C5"):
        place(piano(nm, 2.5, 0.5), B.at(END), 0.32, 0, 0.7)
    for i, nm in enumerate(["C6", "E6", "G6"]):
        place(glock(nm, 0.4), B.at(END) + 0.3 + i * 0.14, 0.22, 0.2, 0.8)
    return B.mix.wet(0.5, kit.reverb_ir(2.6))[:N].mean(axis=1)



def effects(ctx):
    beat, put = ctx.beat, ctx.put
    for item in beat["A2"]["broll"]:
        if item["type"] == "flash":
            put(flash_sound(), item["at"], 0.16)
    for item in beat["A3"]["broll"] + beat["VO1"]["broll"]:
        if item["type"] in ("phone", "code"):
            put(swish(), item["at"] - 0.1, 0.05)
    for item in beat["VO1"]["broll"]:
        if item["type"] == "code" and not item.get("glitch"):
            put(filt(keys(item["until"] - item["at"]), "lowpass", 7000), item["at"], 0.035)
        if item.get("glitch"):
            put(glitch(), item["at"], 0.07)
    for item in beat["VO2"]["broll"]:
        put(swish(), item["at"] - 0.12, 0.02)
    put(riser(0.9, 500, 6000), beat["A4"]["start"] - 0.9, 0.03)

