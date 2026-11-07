"""Cuts the person out of every graded frame, so titles can sit behind them:
MediaPipe's selfie segmenter on photos/<project>/frames/<clip>/NNNN.jpg ->
photos/<project>/masks/<clip>/NNNN.png (opaque = person, half resolution,
softened at the edge and steadied over neighbouring frames so it doesn't
shimmer).

  python3 reel/mask.py <project> <models dir> [clip …]"""

import pathlib
import sys

import mediapipe as mp
import numpy as np
from scipy import ndimage
from PIL import Image, ImageFilter

HERE = pathlib.Path(__file__).resolve().parent
PROJECT, MODELS = sys.argv[1], pathlib.Path(sys.argv[2])
P = HERE.parent / "photos" / PROJECT
seg = mp.tasks.vision.ImageSegmenter.create_from_options(mp.tasks.vision.ImageSegmenterOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=str(MODELS / "selfie_multiclass.tflite")),
    output_confidence_masks=True, output_category_mask=False))

for clip in sorted(d for d in (P / "frames").iterdir() if d.is_dir()):
    if len(sys.argv) > 3 and clip.name not in sys.argv[3:]:
        continue
    out = P / "masks" / clip.name
    out.mkdir(parents=True, exist_ok=True)
    prev = None
    files = sorted(clip.glob("*.jpg"))
    for f in files:
        im = Image.open(f).convert("RGB")
        small = im.resize((im.width // 2, im.height // 2))
        r = seg.segment(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(np.asarray(small))))
        # multiclass: 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes, 5 accessories
        person = 1 - r.confidence_masks[0].numpy_view()[..., 0]
        m = np.clip((person - 0.35) / 0.3, 0, 1)
        lab, n = ndimage.label(m > 0.5)  # keep the person, drop stray patches (white bedding reads as a shirt)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(m), lab, range(1, n + 1))
            keep = ndimage.binary_dilation(lab == 1 + int(np.argmax(sizes)), iterations=6)
            m = m * keep
        if prev is not None:
            m = 0.6 * m + 0.4 * prev  # steadier edges
        prev = m
        alpha = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
        Image.merge("LA", (Image.new("L", alpha.size, 255), alpha)).save(out / f"{f.stem}.png")  # the canvas reads alpha
    print(clip.name, len(files), "masks")
