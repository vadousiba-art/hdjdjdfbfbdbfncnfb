"""YORU Reel 1 ("4 things my app does that Instagram never will"): 100 BPM,
A minor. The groove starts on the first frame (the hook), carries the list,
falls away to a soft night pad under "I built it at night", and comes back
for the send prompt. Every keyword gets a whoosh, numbers a low thump, each
phone screen a swish, emoji bursts a run of pops, the stamp a hit."""

import numpy as np

import kit
from band import Band, chords
from kit import filt, glock, harp, section, timpani
from sfx import keys, swish


def music(ctx):
    beat, DUR, N = ctx.beat, ctx.DUR, ctx.N
    BPM = 100
    BEAT = 60 / BPM
    B = Band({"bpm": BPM, "slides": [{"beats": int(np.ceil(DUR / BEAT)) + 4}]}, 2201)
    place = B.place

    def bt(sec):
        return int(round(sec / BEAT))

    END = bt(DUR) + 1
    night0 = bt(beat["H7"]["start"] + 0.9)  # "I built it at night"
    night1 = bt(beat["H8"]["start"])
    prog = [("Am", 4), ("F", 4), ("C", 4), ("G", 4)] * 6
    for c, b, n in chords(prog, 0):
        if b >= END:
            break
        if night0 <= b < night1:
            continue
        n = min(n, END - b, night0 - b if b < night0 else n)
        B.arp(c, b, n, 0.42, 0.34, pattern=(0, 2, 4, 2, 3, 2, 4, 1))
        B.pad(c, b, n, 0.26, 0.4, attack=0.25, bass=False)
        B.subbass(c, b, n, 0.1)
    B.drums(0, night0, 0.8, kick_pat=(0, 1.5, 2.5), hats=0.55)
    B.drums(night1, END, 0.85, kick_pat=(0, 1.5, 2.5), hats=0.55, open_hat=True)
    # the night: strings and a harp under the laptop shot
    for c, b, n in chords([("F", 4), ("Am", 4)], night0):
        n = min(n, night1 - b)
        if n > 0:
            B.pad(c, b, n, 0.34, 0.45, hi="violins", attack=0.5)
    for i, nm in enumerate(["A4", "C5", "E5", "A5", "C6"]):
        place(harp(nm, 0.6), B.at(night0) + i * 0.07, 0.3, -0.3 + i * 0.15, 0.6)
    place(section([("violins", "E5"), ("violas", "A4"), ("cellos", "A2")], B.at(night1 - night0) + 0.3, 0.4, attack=0.3, release=0.4), B.at(night0), 0.45, 0, 0.6)
    B.level = 2.0
    return B.mix.wet(0.4, kit.reverb_ir(2.2))[:N].mean(axis=1)


def effects(ctx):
    beat, put = ctx.beat, ctx.put
    rng = np.random.default_rng(7)
    notes = ["C6", "D6", "E6", "G6", "A6", "C7"]
    for b in beat.values():
        for it in b["broll"]:
            at = it["at"]
            if it["type"] == "big":
                put(swish(), at - 0.1, 0.06)
                if it["text"].isdigit() or it["text"] == "夜":
                    put(timpani(False, 2), at, 0.16)
            elif it["type"] == "phone":
                put(swish(), at - 0.12, 0.09 if not it.get("swap") else 0.04)
                if it.get("swap"):
                    put(glock("E6", 0.2), at, 0.06)
            elif it["type"] == "burst":
                for i in range(8):
                    put(glock(notes[int(rng.integers(len(notes)))], 0.18), at + i * 0.07 + rng.uniform(0, 0.03), 0.04)
            elif it["type"] == "stamp":
                put(timpani(False, 4), at, 0.25)
                put(filt(kit.rng.standard_normal(int(0.08 * kit.SR)), "bandpass", [500, 4000]) * np.exp(-np.arange(int(0.08 * kit.SR)) / (0.015 * kit.SR)), at, 0.12)
            elif it["type"] == "dots":
                put(glock("A6", 0.15), at + 0.05, 0.05)
            elif it["type"] == "footage":
                put(filt(keys(it["until"] - at), "lowpass", 7000), at, 0.04)
            elif it["type"] == "share":
                put(swish(), at, 0.06)
                put(glock("C7", 0.3), at + 1.5, 0.07)
