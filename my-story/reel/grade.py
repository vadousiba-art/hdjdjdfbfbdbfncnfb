"""Grades a project's phone clips into 30 fps frame sequences (1080x1920, or "size" in grade.json)
(photos/<project>/frames/<clip>/0001.jpg…): non-local-means denoise for the
grain, a white balance taken from the skin rather than the room (grey-world
turned faces teal), an exposure curve that brings each face to a set
brightness, a touch of sharpening.

  python3 reel/grade.py <project> [clip …]

Settings per clip come from reel/<project>/grade.json:
  {"skin_ratios": [g/r, b/r to aim for],
   "clips": {"<clip>": {"skin": [mean skin R, G, B measured on a frame], "target": face brightness 0-255},
             "<clip>": {"manual": "<ffmpeg filters>"}}}"""

import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
project = sys.argv[1]
P = HERE.parent / "photos" / project
G = json.loads((HERE / project / "grade.json").read_text())
TG, TB = G.get("skin_ratios", [0.80, 0.68])


def look(clip):
    c = G["clips"][clip]
    if "manual" in c:
        return c["manual"]
    (r, g, b), target = c["skin"], c["target"]
    gg, gb = TG / (g / r), TB / (b / r)
    x = min(0.299 * r + 0.587 * g * gg + 0.114 * b * gb, 250) / 255
    y = target / 255
    curve = f"0/0.012 {x * 0.45:.3f}/{y * 0.5:.3f} {x:.3f}/{y:.3f} 1/0.985" if x < y else f"0/0 {x:.3f}/{y:.3f} 1/0.96"
    return f"colorchannelmixer=rr=1:gg={gg:.3f}:bb={gb:.3f},curves=all='{curve}',eq=saturation=1.05:contrast={c.get('contrast', 1.0)}"


for clip in sys.argv[2:] or list(G["clips"]):
    out = P / "frames" / clip
    out.mkdir(parents=True, exist_ok=True)
    denoise = G["clips"][clip].get("denoise", "nlmeans=s=4:p=7:r=13")
    vf = f"fps=30,scale={G.get('size', '1080:1920')}:flags=lanczos,{denoise},{look(clip)},unsharp=5:5:0.45"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(P / "raw" / f"{clip}.mp4"), "-vf", vf, "-q:v", "2", str(out / "%04d.jpg")], check=True)
    print(clip, len(list(out.glob("*.jpg"))), "frames")
