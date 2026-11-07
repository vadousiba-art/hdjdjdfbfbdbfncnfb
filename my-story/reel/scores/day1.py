"""Reel 4, Day 1 ("you decide"): A minor, 92 BPM, night lo-fi. A soft pad and
keys under the typed hook, the groove arriving with "I'm 17", a lift into the
A/B choice, the drums dropping out on "tomorrow", and the bell under 夜."""

import numpy as np

import kit
from band import Band, chords
from kit import filt, glock, piano, section
from sfx import keys, swish


def music(ctx):
    beat, DUR, N, E = ctx.beat, ctx.DUR, ctx.N, ctx.E
    BPM = 92
    BEAT = 60 / BPM
    B = Band({"bpm": BPM, "slides": [{"beats": int(np.ceil(DUR / BEAT)) + 4}]}, 5505)
    place = B.place

    def bt(sec):
        return int(round(sec / BEAT))

    END = bt(E["speech_end"]) + 1
    g0 = bt(beat["H1"]["pieces"][0]["at"] + 0.9)          # "17"
    drop = bt(beat["H7"]["start"])                         # "tomorrow"
    lift = bt(beat["H4"]["start"])                         # the choice
    prog = [("Am", 4), ("F", 4), ("C", 4), ("G", 4)] * 6
    for c, b, n in chords(prog, 0):
        if b >= END:
            break
        n = min(n, END - b)
        B.pad(c, b, n, 0.24, 0.42, attack=0.4, bass=False)
        if b >= g0:
            B.arp(c, b, n, 0.42 if b >= lift else 0.36, 0.32, pattern=(0, 2, 4, 2, 3, 2, 4, 1))
            B.subbass(c, b, n, 0.09)
    B.drums(g0, lift, 0.6, kick_pat=(0, 2.5), hats=0.4)
    B.drums(lift, drop, 0.8, kick_pat=(0, 1.5, 2.5), hats=0.55)
    B.drums(drop + 4, END, 0.7, kick_pat=(0, 1.5, 2.5), hats=0.5, open_hat=True)
    # 夜: the bell, a last chord ringing into the loop
    t = E["speech_end"] + 0.5
    for i, nm in enumerate(["A5", "E6"]):
        place(glock(nm, 0.3), t + i * 0.25, 0.2, 0.1, 0.85)
    place(section([("violins", "E5"), ("violas", "A4"), ("cellos", "A2")], DUR - t + 0.5, 0.3, attack=0.2, release=1.0), t - 0.1, 0.35, 0, 0.7)
    place(piano("A3", 3.0, 0.3), t, 0.25, 0, 0.8)
    B.level = 1.8
    return B.mix.wet(0.45, kit.reverb_ir(2.6))[:N].mean(axis=1)


def effects(ctx):
    beat, put = ctx.beat, ctx.put
    # keys under the typed hook, until he speaks
    h1 = beat["H1"]
    put(filt(keys(1.3), "lowpass", 7000), h1["start"], 0.05)
    for b in beat.values():
        for it in b["broll"]:
            if it["type"] == "big":
                put(swish(), it["at"] - 0.1, 0.05)
            elif it["type"] == "choice":
                put(swish(), it["at"] - 0.1, 0.08)
                put(glock("E6" if it["letter"] == "A" else "G6", 0.25), it["at"] + 0.1, 0.07)
            elif it["type"] == "vote":
                put(glock("C7", 0.25), it["at"] + 0.05, 0.06)
