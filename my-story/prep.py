"""Crop the photos out of the Facebook viewer screenshots (dark gradient
above and below, UI at the edges). Finds the photo as the rows whose pixels
vary across the width; plain photos are copied as they are."""
import pathlib
import numpy as np
from PIL import Image

RAW = pathlib.Path(__file__).parent / "photos" / "raw"
OUT = pathlib.Path(__file__).parent / "photos" / "cropped"
OUT.mkdir(parents=True, exist_ok=True)
for p in sorted(RAW.iterdir()):
    im = Image.open(p).convert("RGB")
    if im.size != (1080, 2424):
        im.save(OUT / (p.stem + ".png"))
        print(p.name, "kept", im.size)
        continue
    a = np.asarray(im).astype(float)
    spread = a.std(axis=1).mean(axis=1)          # how much each row varies left-to-right
    rows = np.where(spread > 14)[0]
    rows = rows[(rows > 260) & (rows < 2150)]     # ignore the viewer's header and footer
    top, bot = rows.min(), rows.max()
    # trim to the longest run of busy rows (the photo itself)
    busy = spread > 14
    best, cur, start = (0, 0, 0), 0, None
    for y in range(260, 2150):
        if busy[y]:
            start = y if cur == 0 else start
            cur += 1
            if cur > best[0]:
                best = (cur, start, y)
        else:
            cur = 0
    _, top, bot = best
    crop = im.crop((0, top + 2, 1080, bot - 1))
    crop.save(OUT / (p.stem + ".png"))
    print(p.name, "cropped", (top, bot), crop.size)
