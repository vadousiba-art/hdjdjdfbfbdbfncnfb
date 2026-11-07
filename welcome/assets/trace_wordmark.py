"""Trace the official YORU wordmark (assets/wordmark.png) into vector outlines.

Two layers by colour: the off-white letters and the crimson crescent / divider
/ 夜. Each layer's alpha is upsampled 6x (bicubic), lightly smoothed, then
traced with marching squares and simplified. Output: assets/wordmark.json in
the PNG's own units (868 x 213), filled with the even-odd rule.
"""
import json
import numpy as np
from PIL import Image, ImageFilter
from skimage import measure

UP = 6
im = np.asarray(Image.open("assets/wordmark.png").convert("RGBA")).astype(float) / 255
r, g, b, a = im[..., 0], im[..., 1], im[..., 2], im[..., 3]
red = (r > 0.6) & (g < 0.45) & (b < 0.5)
layers = {"white": a * (~red), "red": a * red}
out = {"w": im.shape[1], "h": im.shape[0], "layers": []}
for name, color in (("white", "#f6efe9"), ("red", "#e5102f")):
    m = Image.fromarray((layers[name] * 255).astype(np.uint8))
    m = m.resize((m.width * UP, m.height * UP), Image.BICUBIC).filter(ImageFilter.GaussianBlur(UP * 0.55))
    arr = np.pad(np.asarray(m).astype(float) / 255, 2)
    paths = []
    for c in measure.find_contours(arr, 0.5):
        if len(c) < 12:
            continue
        c = measure.approximate_polygon(c, tolerance=0.9)
        pts = [[round((x - 2) / UP, 2), round((y - 2) / UP, 2)] for y, x in c]
        paths.append(pts)
    out["layers"].append({"name": name, "color": color, "paths": paths})
    print(name, len(paths), "paths,", sum(len(p) for p in paths), "points")
json.dump(out, open("assets/wordmark.json", "w"), separators=(",", ":"))
