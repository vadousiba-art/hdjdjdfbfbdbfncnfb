"""The reel's sound, on reel/edit.json: the cleaned voice cut to the edit (short
fades at every cut), an original score ducked under the voice, and a few
effects (camera flashes on the callbacks, swipes onto the app, keys under the
code, a glitch on "broken", a low hit on "build me").

Voice: photos/part3/clean/<src>.wav (made with ffmpeg: high-pass, FFT noise
reduction, EQ, compression, de-ess, -17 LUFS each, so every take matches).
Output: reel/audio/reel.wav, mastered to about -14 LUFS for TikTok/Reels."""

import json
import pathlib
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "carousel" / "audio"))
from band import CH, Band, chords  # noqa: E402  (also puts film/audio on the path)
import kit  # noqa: E402
from kit import SR, filt, glock, harp, kick, piano, riser, section, strings, timpani, tt, up  # noqa: E402

E = json.loads((HERE / "edit.json").read_text())
CLEAN = HERE.parent / "photos" / "part3" / "clean"
DUR = E["duration"]
N = int(DUR * SR)
beat = {b["id"]: b for b in E["timeline"]}
cap = E["captions"]


def cap_at(fragment):
    return next(c for c in cap if fragment in c["text"])


# ------------------------------------------------------------------ voice
voice = np.zeros(N)
TRIM = {"c4-200747": 10 ** (2.5 / 20)}  # the turn came out quieter than the rest after cleanup
src_cache = {}
for b in E["timeline"]:
    if b["src"] not in src_cache:
        sr, x = wavfile.read(CLEAN / f"{b['src']}.wav")
        assert sr == SR
        src_cache[b["src"]] = x.astype(np.float64) / 32768 * TRIM.get(b["src"], 1.0)
    x = src_cache[b["src"]]
    for p in b["pieces"]:
        seg = x[int(p["in"] * SR): int(p["out"] * SR)].copy()
        f = min(int(0.012 * SR), len(seg) // 2)
        seg[:f] *= np.linspace(0, 1, f)
        seg[-f:] *= np.linspace(1, 0, f)
        i = int(p["at"] * SR)
        voice[i: i + len(seg)] += seg[: N - i]

# ------------------------------------------------------------------ score (80 BPM, A minor into C major)
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
music = B.mix.wet(0.5, kit.reverb_ir(2.6))[:N].mean(axis=1)

# ------------------------------------------------------------------ effects
fx = np.zeros(N)


def put(sig, t, gain):
    i = int(t * SR)
    if 0 <= i < N:
        sig = sig if sig.ndim == 1 else sig.mean(axis=1)
        fx[i: i + len(sig)] += sig[: N - i] * gain


def flash_sound():
    t = tt(0.35)
    click = filt(kit.rng.standard_normal(len(t)), "highpass", 2500) * np.exp(-t / 0.012)
    swell = filt(kit.rng.standard_normal(len(t)), "bandpass", [1500, 7000]) * np.exp(-t / 0.12) * 0.3
    return click + swell


def swish():
    t = tt(0.28)
    return filt(kit.rng.standard_normal(len(t)), "bandpass", [800, 5000]) * np.sin(np.pi * t / 0.28) ** 2


def keys(dur):
    out = np.zeros(int(dur * SR))
    t = 0.05
    while t < dur - 0.05:
        n = tt(0.03)
        k = filt(kit.rng.standard_normal(len(n)), "bandpass", [1800, 6000]) * np.exp(-n / 0.006)
        i = int(t * SR)
        out[i: i + len(k)] += k[: len(out) - i] * kit.rng.uniform(0.5, 1.0)
        t += kit.rng.uniform(0.07, 0.16)
    return out


def glitch():
    t = tt(0.55)
    x = filt(kit.rng.standard_normal(len(t)), "bandpass", [300, 6000])
    gate = (np.floor(t * 38) % 2 == 0).astype(float)
    tone = np.sign(np.sin(2 * np.pi * 180 * t)) * 0.3
    return (x * gate + tone * (1 - gate)) * np.exp(-t / 0.3)


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

# ------------------------------------------------------------------ mix: duck the music under the voice
env = np.abs(voice)
env = signal.sosfiltfilt(signal.butter(1, 4 / (SR / 2), output="sos"), env)
active = np.clip(env / (np.percentile(env[env > 1e-4], 60) + 1e-9), 0, 1)
# fast down, slow up
duck = np.zeros_like(active)
a_up, a_dn = np.exp(-1 / (0.35 * SR)), np.exp(-1 / (0.04 * SR))
level = 0.0
for i in range(0, len(active), 48):
    target = active[i]
    coef = a_dn if target > level else a_up
    level = target + (level - target) * coef ** 48
    duck[i: i + 48] = level
# the score sits about 6 dB under the voice in the gaps and about 16 dB under it while he talks
rms = lambda x: np.sqrt(np.mean(x[np.abs(x) > 1e-5] ** 2))
music *= rms(voice) * 10 ** (-6 / 20) / rms(music)
fx *= rms(voice) * 10 ** (-10 / 20) / rms(fx)
music_gain = 10 ** (-(10 * duck) / 20)
mix = voice + music * music_gain + fx
fo = int(1.2 * SR)
mix[-fo:] *= np.linspace(1, 0, fo) ** 1.5
mix = np.stack([mix, mix], 1)

out = HERE / "audio"
out.mkdir(exist_ok=True)
tmp = out / "reel-premaster.wav"
wavfile.write(tmp, SR, (np.clip(mix / max(1.0, np.max(np.abs(mix)) * 1.05), -1, 1) * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(tmp), "-af", "loudnorm=I=-14:TP=-1.2:LRA=9", "-ar", str(SR), str(out / "reel.wav")], check=True)
tmp.unlink()
print("wrote", out / "reel.wav", f"{DUR:.1f}s")
