"""3 a.m. thoughts #1 ("If you knew you were a hundred posts away"): almost
nothing. A low A minor drone under the whole thing, a few slow piano notes
that ring into the black pauses, and a soft bell when 夜 appears."""

import numpy as np

import kit
from band import Band
from kit import glock, piano, section, strings


def music(ctx):
    beat, DUR, N, E = ctx.beat, ctx.DUR, ctx.N, ctx.E
    B = Band({"bpm": 60, "slides": [{"beats": int(DUR) + 4}]}, 4404)
    place = B.place
    place(section([("cellos", "A2"), ("basses", "A1"), ("violas", "E3")], DUR + 0.5, 0.3, attack=1.2, release=1.5), 0, 0.5, 0, 0.6)
    place(strings("violins", "E5", DUR - 6, 0.16, attack=5.0, release=2.0), 4.0, 0.16, 0.2, 0.7)
    # a piano note into each black pause, and one under the last line
    for k in ("B1", "B2"):
        if k in beat:
            t = beat[k]["start"]
            for i, nm in enumerate(["A3", "E4", "C5"]):
                place(piano(nm, 3.0, 0.32), t - 0.1 + i * 0.18, 0.32, -0.2 + i * 0.2, 0.75)
    a = beat["A"]
    place(piano("A2", 4.0, 0.3), a["end"] - 1.4, 0.3, 0, 0.7)
    place(piano("E4", 4.0, 0.25), a["end"] - 1.2, 0.22, 0.2, 0.7)
    # 夜: a soft bell
    t = E["speech_end"] + 0.5
    for i, nm in enumerate(["A5", "E6"]):
        place(glock(nm, 0.3), t + i * 0.25, 0.18, 0.1, 0.85)
    place(piano("A3", 3.0, 0.3), t, 0.25, 0, 0.8)
    B.level = 1.4
    return B.mix.wet(0.6, kit.reverb_ir(3.2))[:N].mean(axis=1)


def effects(ctx):
    pass
