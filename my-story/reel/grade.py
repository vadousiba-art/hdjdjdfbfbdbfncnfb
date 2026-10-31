"""Grades the phone clips into 1080x1920 30 fps frame sequences
(photos/part3/frames/<clip>/0001.jpg…): non-local-means denoise for the grain,
a white balance taken from the skin rather than the room (grey-world turned
faces teal), an exposure curve that brings each face to a set brightness, a
touch of sharpening. The skin colours were measured from a frame of each clip."""

import pathlib
import subprocess
import sys

P = pathlib.Path(__file__).resolve().parents[1] / "photos" / "part3"
TG, TB = 0.80, 0.68  # the skin ratios to aim for: green/red, blue/red
FACE = {  # mean skin RGB measured on a frame, face brightness to aim for
    "c1-200322": ((82.7, 62.4, 61.8), 140),
    "c2-200447": ((64.0, 53.0, 62.5), 136),
    "c3-200516": ((96.6, 78.8, 81.6), 140),
    "c5-200907": ((182.8, 141.9, 120.3), 150),
}
# the turn was shot under a strong orange light and blown out: cool it and pull the highlights down instead
MANUAL = {"c4-200747": "colorchannelmixer=rr=0.88:gg=0.94:bb=1.02,curves=all='0/0 0.45/0.36 0.85/0.72 1/0.92',eq=saturation=0.9:gamma=0.95"}


def look(name):
    if name in MANUAL:
        return MANUAL[name]
    (r, g, b), target = FACE[name]
    gg, gb = TG / (g / r), TB / (b / r)
    x = min(0.299 * r + 0.587 * g * gg + 0.114 * b * gb, 250) / 255
    y = target / 255
    curve = f"0/0.012 {x * 0.45:.3f}/{y * 0.5:.3f} {x:.3f}/{y:.3f} 1/0.985" if x < y else f"0/0 {x:.3f}/{y:.3f} 1/0.96"
    return f"colorchannelmixer=rr=1:gg={gg:.3f}:bb={gb:.3f},curves=all='{curve}',eq=saturation=1.05"


for name in sys.argv[1:] or [*FACE, *MANUAL]:
    out = P / "frames" / name
    out.mkdir(parents=True, exist_ok=True)
    vf = f"fps=30,scale=1080:1920:flags=lanczos,nlmeans=s=4:p=7:r=13,{look(name)},unsharp=5:5:0.45"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(P / "raw" / f"{name}.mp4"), "-vf", vf, "-q:v", "2", str(out / "%04d.jpg")], check=True)
    print(name, len(list(out.glob("*.jpg"))), "frames")
