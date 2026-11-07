"""Part 3, the 40-second cut: 80 BPM, A minor into C major. Strings alone under
the hook ("stuff that would destroy me") with warmth arriving on "now i'm
doing it", a low pulse under "no team, no money", a lo-fi groove for YORU and
the build that stutters out on "broken", and the full groove to the end."""

import numpy as np

import kit
from band import Band, chords
from kit import filt, glock, harp, piano, section, timpani
from sfx import glitch, keys, swish


def music(ctx):
    E, beat, cap_at, DUR, N = ctx.E, ctx.beat, ctx.cap_at, ctx.DUR, ctx.N
    BPM = 80
    BEAT = 60 / BPM
    B = Band({"bpm": BPM, "slides": [{"beats": int(np.ceil(DUR / BEAT)) + 2}]}, 1040)
    place = B.place

    def bt(sec):  # seconds -> nearest beat
        return int(round(sec / BEAT))

    S = {k: bt(v["start"]) for k, v in beat.items()}
    END = bt(E["speech_end"])

    # the hook: strings alone, then warmth on "now i'm doing it" and a low hit on "build"
    now = cap_at("now i'm doing it")["s"]
    place(section([("violins", "E5"), ("violas", "A4"), ("cellos", "A2")], now + 0.3, 0.38, attack=0.4, release=0.5), 0, 0.5, 0, 0.7)
    for i, nm in enumerate(["C4", "E4", "G4", "C5", "E5", "G5"]):
        place(harp(nm, 0.5), now - 0.15 + i * 0.05, 0.3, -0.3 + i * 0.12, 0.6)
    place(section([("violins", "G5"), ("violins", "E5"), ("violas", "C4"), ("cellos", "C3")], beat["B2"]["start"] - now + 0.5, 0.45, attack=0.4, release=0.8), now, 0.55, 0, 0.7)
    place(timpani(False, 3), cap_at("that will")["s"] + 0.25, 0.45, 0, 0.5)
    # "no team, no money": a low pulse under slow piano
    for c, b, n in chords([("Am", 4), ("F", 4)], S["B2"]):
        n = min(n, S["B3"] - b)
        if n > 0:
            B.arp(c, b, n, 0.34, 0.34, step=1, pattern=(0, 2, 1, 3))
            B.pad(c, b, n, 0.3, 0.38, attack=0.6)
    for i in range(S["B2"], S["B3"]):
        place(piano("A2", 1.2, 0.32), B.at(i), 0.26 if i % 2 == 0 else 0.16, -0.1, 0.4)
    # YORU and the build: the groove, stuttering out on "broken"
    broke = bt(cap_at("i've broken")["s"])
    for c, b, n in chords([("C", 4), ("G", 4), ("Am", 4), ("F", 4)] * 3, S["B3"]):
        n = min(n, broke - b)
        if n > 0:
            B.arp(c, b, n, 0.44, 0.38, pattern=(0, 2, 4, 2, 3, 2, 4, 1))
            B.pad(c, b, n, 0.28, 0.42, attack=0.4, bass=False)
            B.subbass(c, b, n, 0.09)
    B.drums(S["B3"], broke, 0.75, kick_pat=(0, 1.5, 2.5), hats=0.5)
    place(section([("cellos", "A2"), ("basses", "A1")], B.at(S["B5"] - broke) + 0.3, 0.35, attack=0.05, release=0.6), B.at(broke), 0.4, 0, 0.6)
    # the ending: the full groove, resolving on C as the speech ends
    for c, b, n in chords([("C", 4), ("G", 4), ("Am", 4), ("F", 4)] * 2, S["B5"]):
        n = min(n, END - b)
        if n > 0:
            B.arp(c, b, n, 0.5, 0.4, pattern=(0, 2, 4, 2, 3, 2, 4, 1))
            B.pad(c, b, n, 0.34, 0.46, hi="violins", attack=0.3)
            B.subbass(c, b, n, 0.09)
    B.drums(S["B5"], END, 0.8, kick_pat=(0, 1.5, 2.5), hats=0.5, open_hat=True)
    B.level = 2.0  # the last chord rings into the loop
    place(section([("violins", "E5"), ("violins", "G5"), ("violas", "C4"), ("cellos", "C3"), ("basses", "C2")], DUR - B.at(END) + 0.5, 0.5, attack=0.05, release=0.6), B.at(END), 0.5, 0, 0.6)
    for i, nm in enumerate(["C6", "E6", "G6"]):
        place(glock(nm, 0.4), B.at(END) + i * 0.1, 0.2, 0.2, 0.8)
    return B.mix.wet(0.5, kit.reverb_ir(2.6))[:N].mean(axis=1)


def effects(ctx):
    beat, put = ctx.beat, ctx.put
    for item in beat["B3"]["broll"] + beat["B4"]["broll"]:
        if item["type"] in ("phone", "code"):
            put(swish(), item["at"] - 0.1, 0.05)
    for item in beat["B4"]["broll"]:
        if item.get("glitch"):
            put(glitch(), item["at"], 0.07)
        elif item["type"] == "code":
            put(filt(keys(item["until"] - item["at"]), "lowpass", 7000), item["at"], 0.035)
