"""The soundtrack for the motivation reel: the reference reel's own piano, looped.

  python3 scripts/motivation-music.py <version>

The music comes from the creator's best-performing reel (the reference): its voice was
separated out with HTDemucs (scripts/separate-reference.py), leaving the piano and the
closing boom in public/recordings/motivation/ref-music.wav. That piano is a short figure
that repeats every bar; measured on a log spectrogram it matches itself 0.93 two bars on
(3.104 s), so it loops cleanly on a chord attack.

Same plan as the reference:
  - the hook is dry: no music under it
  - the piano comes in on the first word after the hook (its own opening two bars, which
    start from silence), then loops two bars (attack at 5.8747 s to attack at 8.9786 s)
  - it fades out with the last word, a short silence, then the reference's boom on the
    cut to black

Writes music.wav (the music alone) and mix.wav (voice + music through a limiter, the
track the reel plays) beside the version's edit.json.
"""

import json
import pathlib
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy import signal

ROOT = pathlib.Path(__file__).resolve().parent.parent
VERSION = sys.argv[1]
REC = ROOT / "public" / "recordings" / "motivation"
OUT = REC / VERSION
EDIT = json.loads((OUT / "edit.json").read_text())
SR = 48000
CARD = 1.6               # the black end card after the a-roll, in seconds

# measured in ref-music.wav (44.1 kHz)
INTRO = (2.7734, 5.8747)  # the piano's own first two bars, from silence
LOOP = (5.8747, 8.9786)   # two bars, attack to attack
BOOM = (16.85, 18.45)     # the boom; it starts at 16.88
BOOM_ONSET = 16.88
PRE = 0.004               # start each piece this far before its attack
XFADE = 0.012             # equal-power crossfade at every splice
OUTRO_FADE = 0.25         # the piano fades out over this after the last word

PIANO_LUFS = -15.0        # just under the -14 LUFS voice before ducking (the reference had it louder than the voice)
BOOM_OVER_PIANO = 6.3     # dB, as in the reference (-8.0 vs -14.3 LUFS)
DUCK_MARGIN = 1.5         # the voice stays at least this many dB above the piano
DUCK_MAX = 6.0            # the piano never dips more than this


def read(path):
    with wave.open(str(path)) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64).reshape(-1, ch) / 32768
    return sr, x


def write(path, x):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())


def lufs(x):
    with tempfile.TemporaryDirectory() as tmp:
        p = pathlib.Path(tmp) / "x.wav"
        write(p, x)
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(p), "-af", "loudnorm=print_format=json", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
        return float(json.loads(r[r.rindex("{"): r.rindex("}") + 1])["input_i"])


src_sr, ref = read(REC / "ref-music.wav")
ref = signal.resample_poly(ref, SR, src_sr, axis=0)          # 44.1 -> 48 kHz
xf = int(XFADE * SR)
# each piece: its nominal length (attack to next attack) plus an XFADE tail that overlaps the next piece's head
span = lambda a, b: (int(round((a - PRE) * SR)), int(round((b - PRE) * SR)))
(i0, i1), (l0, l1) = span(*INTRO), span(*LOOP)
intro, loop = ref[i0:i1 + xf], ref[l0:l1 + xf]
intro_len, loop_len = i1 - i0, l1 - l0
boom = ref[int(BOOM[0] * SR):int(BOOM[1] * SR)]

words = EDIT["words"]
drop = next(w for w in words if w["seg"] == 1)["startMs"] / 1000       # first word after the hook
stop = max(w["endMs"] for w in words) / 1000                           # the last word ends
boom_at = EDIT["frames"] / EDIT["fps"]                                 # the cut to black
N = int(round((boom_at + CARD) * SR))
music = np.zeros((N, 2))
up, down = np.sin(np.linspace(0, np.pi / 2, xf))[:, None], np.cos(np.linspace(0, np.pi / 2, xf))[:, None]


def lay(piece, at):
    """Add a piece at sample `at`; its first XFADE crossfades with the previous piece's tail."""
    piece = piece.copy()
    end = min(N, at + len(piece))
    piece = piece[: end - at]
    if len(piece) > xf:
        music[at:at + xf] *= down
        piece[:xf] *= up
    music[at:end] += piece


pos = int(round((drop - PRE) * SR))
lay(intro, pos)
pos += intro_len
stop_n = int(round(stop * SR))
while pos < stop_n:
    lay(loop, pos)
    pos += loop_len
fade = int(OUTRO_FADE * SR)
music[stop_n:stop_n + fade] *= np.linspace(1, 0, fade)[:, None]
music[stop_n + fade:] = 0
music[: int(round((drop - PRE) * SR))] = 0                            # the hook stays dry

g = 10 ** ((PIANO_LUFS - lufs(music[int(drop * SR):stop_n])) / 20)
music *= g

# ducking: wherever a word is quieter than the piano, the piano dips (up to DUCK_MAX dB) so the
# voice stays at least DUCK_MARGIN dB on top; between words it plays at full strength
voice = subprocess.run(["ffmpeg", "-v", "error", "-i", str(OUT / "aroll.mp4"), "-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"],
                       capture_output=True, check=True).stdout
voice = np.frombuffer(voice, np.int16).astype(np.float64) / 32768 / np.sqrt(2)   # as it sits in each stereo channel
hop = int(0.01 * SR)
frames = N // hop
def env_db(x):
    x = np.pad(x, (0, max(0, frames * hop - len(x))))[: frames * hop].reshape(frames, hop)
    return 10 * np.log10(np.mean(x ** 2, axis=1) + 1e-12)
v_db = np.convolve(env_db(voice), np.ones(15) / 15, mode="same")       # word-length (150 ms) levels
p_db = np.convolve(env_db(music.mean(axis=1)), np.ones(15) / 15, mode="same")
want = np.where(v_db > -45, np.clip(v_db - DUCK_MARGIN - p_db, -DUCK_MAX, 0), 0.0)
gain = np.zeros(frames)
for k in range(frames):                      # fast down (20 ms), slow up (180 ms)
    prev = gain[k - 1] if k else 0.0
    a = 1 - np.exp(-1 / (2 if want[k] < prev else 18))
    gain[k] = prev + a * (want[k] - prev)
duck = np.repeat(10 ** (gain / 20), hop)
duck = np.pad(duck, (0, N - len(duck)), constant_values=1.0)
music *= duck[:, None]
print(f"ducking: deepest {gain.min():.1f} dB, piano lowered on {np.mean(gain < -0.5) * 100:.0f}% of frames")
boom_gain = 10 ** ((PIANO_LUFS + BOOM_OVER_PIANO - lufs(boom)) / 20)
b0 = int(round((boom_at - (BOOM_ONSET - BOOM[0])) * SR))
seg = boom[: N - b0] * boom_gain
music[b0:b0 + len(seg)] += seg
write(OUT / "music.wav", music)

# the reel's track: the cleaned voice (already -14 LUFS; in both channels at -3 dB, the pan law) + the music, peak-limited
mix = music.copy()
mix[: len(voice)] += voice[:N, None]
with tempfile.TemporaryDirectory() as tmp:
    raw = pathlib.Path(tmp) / "raw.wav"
    write(raw, np.clip(mix, -4, 4) / 4)                                  # headroom for the limiter, gain restored below
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", "volume=4,alimiter=limit=0.84:attack=2:release=60:level=disabled",
                    "-ar", str(SR), str(OUT / "mix.wav")], check=True)
_, m = read(OUT / "mix.wav")
print(f"{VERSION}: piano in at {drop:.3f}s, out at {stop:.3f}s, boom {boom_at:.3f}s | piano {lufs(music[int(drop * SR):stop_n]):.1f} LUFS, "
      f"mix {lufs(m):.1f} LUFS, peak {20 * np.log10(np.abs(m).max()):.1f} dBFS, {int(np.ceil((stop - drop - intro_len / SR) / (loop_len / SR)))} loops")
