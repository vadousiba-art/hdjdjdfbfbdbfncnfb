"""Transcribes recordings with word timestamps (faster-whisper, on the CPU):
python3 carousel/transcribe.py a.wav b.wav … -> a.json, b.json next to each.
Expects 16 kHz mono WAV (ffmpeg -i in -ac 1 -ar 16000 out.wav)."""

import json
import pathlib
import sys

import numpy as np
from faster_whisper import WhisperModel
from scipy.io import wavfile

model = WhisperModel("small.en", device="cpu", compute_type="int8")
for path in sys.argv[1:]:
    sr, x = wavfile.read(path)
    assert sr == 16000, f"{path}: expected 16 kHz"
    audio = (x / 32768.0).astype(np.float32)
    segments, _ = model.transcribe(audio, word_timestamps=True, vad_filter=False, beam_size=5)
    out = [{"start": s.start, "end": s.end, "text": s.text.strip(),
            "words": [{"w": w.word.strip(), "s": w.start, "e": w.end, "p": w.probability} for w in s.words]} for s in segments]
    pathlib.Path(path).with_suffix(".json").write_text(json.dumps(out, indent=1))
    print(f"== {path}")
    for s in out:
        print(f"  {s['start']:6.2f}-{s['end']:6.2f}  {s['text']}")
