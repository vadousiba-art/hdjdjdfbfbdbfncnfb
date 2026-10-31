"""Evens out exposure within each graded clip: phone cameras hunt (the first
second of a clip is often dark) and moving under a lamp swings the face a
stop or more. Measures the face area of every frame, smooths it over half a
second, and writes the brightness gain that brings each frame back to the
clip's typical level (limited to 0.85-2.6x) -> reel/exposure.json."""

import json
import pathlib

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
FR = HERE.parent / "photos" / "part3" / "frames"
out = {}
for clip in sorted(p for p in FR.iterdir() if p.is_dir()):
    lum = []
    for f in sorted(clip.glob("*.jpg")):
        im = Image.open(f).convert("L").resize((108, 192))
        a = np.asarray(im, dtype=float)[29:106, 27:81]  # the face area: upper-middle of the frame
        lum.append(np.percentile(a, 70))
    lum = np.array(lum)
    k = np.ones(15) / 15
    smooth = np.convolve(np.pad(lum, 7, mode="edge"), k, "valid")
    target = np.percentile(smooth, 60)
    gain = np.clip(target / smooth, 0.85, 2.6)
    out[clip.name] = [round(float(g), 3) for g in gain]
    print(f"{clip.name}: face {lum.min():.0f}-{lum.max():.0f}, target {target:.0f}, gain {gain.min():.2f}-{gain.max():.2f}")
(HERE / "exposure.json").write_text(json.dumps(out))
