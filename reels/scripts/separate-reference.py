"""Separate the voice from the music in the reference reel with HTDemucs (the fine-tuned
vocals model), loaded from safetensors (plain tensors, no pickle). Writes vocals.wav and
music.wav (= mix - vocals) into <dir>.

  python3 scripts/separate-reference.py <dir>

<dir> must hold ref44.wav (the reference's audio, 44.1 kHz stereo), htdemucs_ft.safetensors
and htdemucs_ft_config.json. The weights are the official htdemucs_ft vocals checkpoint
converted to safetensors (huggingface.co/AEmotionStudio/htdemucs-models, MIT); they are
never committed. Needs torch (CPU build), demucs 4.0.1 and safetensors.

The music.wav it made is public/recordings/motivation/ref-music.wav (git-ignored).
"""
import json
import sys
import wave

import numpy as np
import torch
from safetensors.torch import load_file
from demucs.htdemucs import HTDemucs
from demucs.apply import apply_model

here = sys.argv[1]
cfg = json.load(open(f"{here}/htdemucs_ft_config.json"))
kw = dict(cfg["kwargs"])
model = HTDemucs(**kw)
state = {k.removeprefix("state."): v for k, v in load_file(f"{here}/htdemucs_ft.safetensors").items()}
model.load_state_dict(state, strict=True)
print("weights loaded (strict)")
model.eval()

with wave.open(f"{here}/ref44.wav") as w:
    sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32).reshape(-1, 2).T / 32768
mix = torch.from_numpy(x)
ref = mix.mean(0)
mix_n = (mix - ref.mean()) / ref.std()
with torch.no_grad():
    out = apply_model(model, mix_n[None], shifts=2, split=True, overlap=0.5, progress=False)[0]
out = out * ref.std() + ref.mean()
srcs = kw["sources"]
voc = out[srcs.index("vocals")].numpy()
music = x - voc
for name, y in [("vocals", voc), ("music", music)]:
    with wave.open(f"{here}/{name}.wav", "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((np.clip(y.T, -1, 1) * 32767).astype("<i2").tobytes())
print("done", {s: float(out[i].pow(2).mean().sqrt()) for i, s in enumerate(srcs)})
