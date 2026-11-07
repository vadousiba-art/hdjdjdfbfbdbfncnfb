"""Crops the part 2 photos out of their phone screenshots (photos/part2/raw ->
photos/part2): the Facebook viewer's bars, names, captions and the like/comment
buttons that sit over the bottom of some photos are all cut away. Photos that
aren't screenshots are copied as they are."""

import pathlib

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
RAW = HERE.parent / "photos" / "part2" / "raw"
OUT = RAW.parent
BOXES = {  # (left, top, right, bottom) in the 1080x2424 screenshot
    "birthday13": (0, 700, 1080, 1506),
    "bus": (0, 378, 1080, 1555),
    "fishing": (0, 378, 1080, 1555),
    "sweater": (0, 385, 1080, 1555),
    "collage": (0, 673, 1080, 1532),
    "grandma": (5, 1163, 1075, 1980),
}
for p in sorted(RAW.iterdir()):
    im = Image.open(p).convert("RGB")
    if p.stem in BOXES:
        im = im.crop(BOXES[p.stem])
    im.save(OUT / f"{p.stem}.jpg", quality=94)
    print(p.stem, im.size)
