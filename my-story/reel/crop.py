"""Turns landscape selfie takes into vertical clips: finds the face in a few
frames of each take (MediaPipe face detector), crops a 9:16 window that puts
the face in the upper middle, and writes photos/<project>/raw/<clip>.mp4 for
reel/grade.py. Also measures the mean skin colour and prints it for
grade.json.

  python3 reel/crop.py <project> <models dir> [clip …]

Takes come from photos/<project>/src/<clip>.mp4."""

import json
import pathlib
import subprocess
import sys

import mediapipe as mp
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
PROJECT, MODELS = sys.argv[1], pathlib.Path(sys.argv[2])
P = HERE.parent / "photos" / PROJECT
(P / "raw").mkdir(exist_ok=True)

det = mp.tasks.vision.FaceDetector.create_from_options(mp.tasks.vision.FaceDetectorOptions(
    base_options=mp.tasks.BaseOptions(model_asset_path=str(MODELS / "face.tflite")), min_detection_confidence=0.4))


def frames(src, n=6):
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                               capture_output=True, text=True).stdout)
    for k in range(n):
        t = dur * (k + 0.5) / n
        raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", f"{t:.2f}", "-i", str(src), "-frames:v", "1",
                              "-vf", "scale=816:-2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
        if raw:
            yield np.frombuffer(raw, np.uint8).reshape(-1, 816, 3)


TOP = 210  # where the 3:4 picture starts in the 9:16 frame
info = {}
for src in sorted((P / "src").glob("*.mp4")):
    clip = src.stem
    if len(sys.argv) > 3 and clip not in sys.argv[3:]:
        continue
    w, h = map(int, subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                                    "-of", "csv=p=0", str(src)], capture_output=True, text=True).stdout.strip().split(","))
    cx, cy, fh, skins = [], [], [], []
    for a in frames(src):
        r = det.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(a)))
        if not r.detections:
            continue
        bb = max(r.detections, key=lambda d: d.bounding_box.width).bounding_box
        cx.append((bb.origin_x + bb.width / 2) / a.shape[1])
        cy.append((bb.origin_y + bb.height / 2) / a.shape[0])
        fh.append(bb.height / a.shape[0])
        # skin: the cheeks and nose, the middle of the face box
        x0, y0 = bb.origin_x + bb.width * 0.3, bb.origin_y + bb.height * 0.45
        patch = a[int(y0): int(y0 + bb.height * 0.3), int(x0): int(x0 + bb.width * 0.4)].reshape(-1, 3)
        skins.append(patch.mean(axis=0))
    if not cx:
        print(clip, "no face: centred crop")
        fx, fy, size = 0.5, 0.45, 0.4
    else:
        fx, fy, size = float(np.median(cx)), float(np.median(cy)), float(np.median(fh))
    # a 9:16 window, full height (or tighter when the face is small), face centre at 40% from the top.
    # A face this close (over 55% of the height) leaves no room in 9:16: take a 3:4 window instead and
    # sit it across the full width, over a blurred copy of itself that fills the top and bottom.
    wide = size > 0.55
    ch = h if size > 0.35 else int(h * max(0.75, size / 0.35))
    ch -= ch % 2
    cw = int(ch * (3 / 4 if wide else 9 / 16))
    cw -= cw % 2
    x = int(np.clip(fx * w - cw / 2, 0, w - cw))
    y = int(np.clip(fy * h - ch * 0.4, 0, h - ch))
    vf = f"crop={cw}:{ch}:{x}:{y}"
    if wide:
        fh_px = round(1080 * ch / cw / 2) * 2
        vf = (f"crop={cw}:{ch}:{x}:{y},split[a][b];[a]scale=1080:{fh_px}:flags=lanczos[fg];"
              f"[b]scale=-2:1920,crop=1080:1920,boxblur=30:3,eq=brightness=-0.06:saturation=0.9[bg];"
              f"[bg][fg]overlay=0:{TOP}")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-filter_complex" if wide else "-vf", vf, "-c:v", "libx264",
                    "-crf", "14", "-preset", "fast", "-an", str(P / "raw" / f"{clip}.mp4")], check=True)
    skin = [round(float(v), 1) for v in np.mean(skins, axis=0)] if skins else None
    info[clip] = {"face": [round(fx, 3), round(fy, 3), round(size, 3)], "crop": [cw, ch, x, y], "wide": wide, "skin": skin}
    print(clip, info[clip])
(P / "crop.json").write_text(json.dumps(info, indent=1))
