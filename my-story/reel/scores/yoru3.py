"""YORU Reel 3 ("Still waiting for it to pop?"): A minor, 96 BPM. Tension
first: a low drone, a clock ticking with the countdown, the heart creaking
as the needle presses. A beat comes in under the speaker and the app
graphics, drops away for the final countdown (just the drone and a heartbeat
getting faster), a held breath of silence, then the pop and a bright A major
resolve under the logo and "send this to the friend"."""

import numpy as np

import kit
from band import Band, chords
from kit import SR, filt, glock, harp, kick, section, strings, timpani, tt
from sfx import keys, swish


def items(beat, kind):
    return [it for b in beat.values() for it in b["broll"] if it["type"] == kind]


def pop_time(beat):
    p = items(beat, "pop")
    return p[0]["at"] + p[0].get("delay", 0) if p else None


def music(ctx):
    beat, DUR, N = ctx.beat, ctx.DUR, ctx.N
    BPM = 96
    BEAT = 60 / BPM
    B = Band({"bpm": BPM, "slides": [{"beats": int(np.ceil(DUR / BEAT)) + 4}]}, 3301)
    place = B.place
    POP = pop_time(beat)

    def bt(sec):
        return int(round(sec / BEAT))

    groove0, groove1 = bt(beat["F1"]["start"]), bt(beat["V3"]["start"])
    # the drone under the heart: from the first frame to the pop, swelling
    place(section([("cellos", "A2"), ("basses", "A1"), ("violas", "E3")], POP + 0.2, 0.32, attack=0.5, release=0.1), 0, 0.5, 0, 0.5)
    place(strings("violins", "E5", beat["V1"]["end"] - 2.0, 0.22, attack=4.0, release=1.0), 2.0, 0.22, 0.2, 0.6)
    # a beat under the speaker and the app
    for c, b, n in chords([("Am", 4), ("F", 4), ("C", 4), ("G", 4)] * 2, groove0):
        n = min(n, groove1 - b)
        if n > 0:
            B.arp(c, b, n, 0.4, 0.32, pattern=(0, 2, 4, 2, 3, 2, 4, 1))
            B.pad(c, b, n, 0.22, 0.4, attack=0.3, bass=False)
            B.subbass(c, b, n, 0.09)
    B.drums(groove0, groove1, 0.75, kick_pat=(0, 1.5, 2.5), hats=0.5)
    # the final countdown: strings rising to the pop
    place(section([("violins", "A5"), ("violins", "E5"), ("violas", "C4")], POP - beat["V3"]["start"], 0.3, attack=1.5, release=0.05), beat["V3"]["start"], 0.42, 0, 0.5)
    # the pop resolves to A major: everything at once, then the groove under the logo
    end = bt(DUR) + 2
    place(section([("violins", "C#6"), ("violins", "A5"), ("violas", "E4"), ("cellos", "A2"), ("basses", "A1")], DUR - POP + 0.5, 0.5, attack=0.02, release=1.0), POP + 0.02, 0.55, 0, 0.7)
    for i, nm in enumerate(["A5", "C#6", "E6", "A6"]):
        place(glock(nm, 0.5), POP + 0.1 + i * 0.09, 0.28, -0.3 + i * 0.2, 0.8)
    for i, nm in enumerate(["A3", "C#4", "E4", "A4", "C#5", "E5"]):
        place(harp(nm, 0.7), POP + 0.4 + i * 0.05, 0.25, -0.4 + i * 0.15, 0.6)
    g0 = bt(POP) + 1
    for c, b, n in chords([("A", 4), ("D", 4)] * 2, g0):
        n = min(n, end - b)
        if n > 0:
            B.arp(c, b, n, 0.45, 0.34, pattern=(0, 2, 4, 2, 3, 2, 4, 1))
            B.subbass(c, b, n, 0.1)
    B.drums(g0, end, 0.8, kick_pat=(0, 1.5, 2.5), hats=0.55, open_hat=True)
    B.level = 2.2
    out = B.mix.wet(0.4, kit.reverb_ir(2.4))[:N].mean(axis=1)
    # the held breath: nothing for a moment before the pop
    a, b = int((POP - 0.22) * SR), int(POP * SR)
    out[a:b] *= np.linspace(1, 0, b - a) ** 2
    return out


def tick():
    t = tt(0.04)
    return filt(kit.rng.standard_normal(len(t)), "bandpass", [2500, 7000]) * np.exp(-t / 0.004)


def creak(dur):
    t = tt(dur)
    f = 90 + 40 * np.sin(2 * np.pi * 0.7 * t) + 15 * kit.rng.standard_normal(len(t)).cumsum() / np.sqrt(len(t))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * 11 * t) ** 2)
    rub = filt(kit.rng.standard_normal(len(t)), "bandpass", [300, 1400])
    return (0.6 * tone + 0.4 * rub) * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.7


def heartbeat():
    return kick() * 1.0


def big_pop():
    t = tt(0.9)
    crack = filt(kit.rng.standard_normal(len(t)), "highpass", 1200) * np.exp(-t / 0.025)
    boom = np.sin(2 * np.pi * (60 + 120 * np.exp(-t / 0.05)) * t) * np.exp(-t / 0.25)
    air = filt(kit.rng.standard_normal(len(t)), "bandpass", [400, 5000]) * np.exp(-t / 0.18) * 0.4
    return crack * 1.2 + boom * 0.9 + air


def click():
    t = tt(0.05)
    return filt(kit.rng.standard_normal(len(t)), "bandpass", [1500, 6000]) * np.exp(-t / 0.006)


def effects(ctx):
    beat, put = ctx.beat, ctx.put
    POP = pop_time(beat)
    # the first frame lands with a low hit, so the opening is never silent
    put(timpani(False, 4), 0.0, 0.22)
    put(big_pop()[: int(0.5 * SR)] * np.exp(-np.arange(int(0.5 * SR)) / (0.08 * SR)), 0.0, 0.08)
    # the clock: a tick every half second while the heart is on screen, before the voice and in the final countdown
    t = 0.5
    while t < beat["INTRO"]["end"]:
        put(tick(), t, 0.08)
        t += 0.5
    # the heart creaks as the needle presses
    v1 = beat["V1"]
    put(creak(v1["end"] - v1["start"] - 3.0), v1["start"] + 3.0, 0.05)
    v3 = beat["V3"]
    put(creak(POP - v3["start"]), v3["start"], 0.07)
    # a heartbeat that speeds up into the pop
    t, gap = v3["start"] + 0.1, 0.6
    while t < POP - 0.3:
        put(heartbeat(), t, 0.22)
        put(heartbeat(), t + 0.16, 0.14)
        t += gap
        gap = max(0.28, gap * 0.82)
    put(big_pop(), POP, 0.5)
    # whooshes on every scene change, taps and blips on the app
    for kind in ("face", "search", "nope", "cards", "phone"):
        for it in items(beat, kind):
            put(swish(), it["at"] - 0.1, 0.07)
    for it in items(beat, "search"):
        put(filt(keys(0.42), "lowpass", 8000), it["at"] + 0.05, 0.05)
    for it in items(beat, "result") + items(beat, "card") + items(beat, "click"):
        put(click(), it["at"] + (0.15 if it["type"] == "click" else 0), 0.12)
    for it in items(beat, "card"):
        put(glock("E6", 0.2), it["at"] + 0.15, 0.06)
    for it in items(beat, "strike"):
        put(swish(), it["at"], 0.09)
        put(timpani(False, 2), it["at"] + 0.05, 0.12)
    for it in items(beat, "big"):
        put(swish(), it["at"] - 0.08, 0.05)
    for it in items(beat, "burst"):
        for i in range(6):
            put(glock(["C6", "E6", "G6", "A6"][i % 4], 0.15), it["at"] + i * 0.08, 0.035)
    for it in items(beat, "join"):
        put(swish(), it["at"] + 0.5, 0.05)
