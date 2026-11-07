"""Builds the Halloween edition of the YORU logo and app icons from the
official artwork in public/brand/yoru (run: python3 scripts/brand/halloween.py).

The "O" becomes a jack-o'-lantern (pumpkin-orange crescent, carved glowing
face, a stem on top) and a few bats fly off the 夜. The app icon's red moon
turns into an orange harvest moon with bats crossing it. Everything is drawn
in wordmark coordinates, so each asset just passes where the wordmark sits.
"""

import colorsys
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
SRC = os.path.join(ROOT, "public", "brand", "yoru")
OUT = os.path.join(SRC, "halloween")
SS = 4  # supersampling for the drawn parts

# Wordmark-space geometry (public/brand/yoru/wordmark.png is 868x213).
CRESCENT_BOX = (204, 38, 294, 164)
LEFT_EYE = [(259, 91), (279, 91), (272, 75)]
RIGHT_EYE = [(317, 91), (297, 91), (304, 75)]
NOSE = [(284, 103), (292, 103), (288, 96)]
MOUTH = [
    (262, 107), (270, 112), (276, 107), (282, 113), (288, 108), (294, 113), (300, 107), (306, 112), (314, 107),
    (311, 115), (304, 123), (298, 119), (292, 126), (286, 120), (280, 126), (274, 120), (268, 122), (263, 114),
]
STEM = [(274, 19), (286, 19), (289, 4), (295, -8), (290, -12), (282, -2)]
LEAF = [(289, 0), (300, -6), (311, -4), (303, 3), (293, 4)]
PAD_TOP = 44  # room above the letters for the stem and the bats
BATS_WORDMARK = [((708, 24 - PAD_TOP), 62, -10), ((790, 16 - PAD_TOP), 44, 8), ((848, 30 - PAD_TOP), 30, -6)]

FACE = (255, 196, 64)
FACE_GLOW = (255, 120, 0)
FACE_ON_LIGHT = (214, 82, 0)  # a glow washes out on white, so it's carved dark instead
STEM_RGB = (96, 150, 52)
LEAF_RGB = (70, 118, 38)

# A bat, width 1, centred on its body.
_RIGHT_WING = [(0.05, -0.08), (0.18, -0.22), (0.34, -0.30), (0.50, -0.20), (0.44, -0.10), (0.38, -0.02),
               (0.30, -0.06), (0.24, 0.04), (0.16, -0.02), (0.10, 0.08), (0.05, 0.10)]
BAT = ([(-0.035, -0.17), (-0.015, -0.11), (0.015, -0.11), (0.035, -0.17)] + _RIGHT_WING + [(0.0, 0.16)]
       + [(-x, y) for x, y in reversed(_RIGHT_WING)])


def _tx(points, s, ox, oy):
    return [((x * s + ox) * SS, (y * s + oy) * SS) for x, y in points]


def _bat(center, width, tilt_deg):
    a = np.radians(tilt_deg)
    ca, sa = np.cos(a), np.sin(a)
    cx, cy = center
    return [(cx + (x * ca - y * sa) * width, cy + (x * sa + y * ca) * width) for x, y in BAT]


def _downsample_onto(img, layer):
    img.alpha_composite(layer.resize(img.size, Image.LANCZOS))


def pumpkin_crescent(img, s, ox, oy):
    """Recolors the red crescent of the O to pumpkin orange (top lighter)."""
    a = np.array(img).astype(np.float32)
    x0, y0, x1, y1 = CRESCENT_BOX
    X0, Y0 = int(x0 * s + ox), int(max(0, y0 * s + oy))
    X1, Y1 = int(x1 * s + ox), int(y1 * s + oy)
    region = a[Y0:Y1, X0:X1]
    r, g, b = region[..., 0], region[..., 1], region[..., 2]
    red = (r > 120) & (r > g + 50) & (r > b + 40)
    h, w = red.shape
    for yy in range(h):
        t = yy / max(1, h - 1)
        for xx in np.where(red[yy])[0]:
            pr, pg, pb = region[yy, xx, :3] / 255
            _, l, sat = colorsys.rgb_to_hls(pr, pg, pb)
            hue = (34 - 14 * t) / 360  # amber at the top to deep orange at the bottom
            nr, ng, nb = colorsys.hls_to_rgb(hue, min(0.6, l * 1.18), min(1, sat * 1.05))
            region[yy, xx, :3] = (nr * 255, ng * 255, nb * 255)
    a[Y0:Y1, X0:X1] = region
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")


def jack_o_lantern(img, s, ox, oy, glow=True, face_rgb=FACE):
    """Carves the face into the O and puts a stem on top."""
    W, H = img.size
    face = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(face)
    for shape in (LEFT_EYE, RIGHT_EYE, NOSE, MOUTH):
        d.polygon(_tx(shape, s, ox, oy), fill=face_rgb + (255,))
    if glow:
        halo = Image.new("RGBA", face.size, (0, 0, 0, 0))
        hd = ImageDraw.Draw(halo)
        for shape in (LEFT_EYE, RIGHT_EYE, NOSE, MOUTH):
            hd.polygon(_tx(shape, s, ox, oy), fill=FACE_GLOW + (255,))
        halo = halo.filter(ImageFilter.GaussianBlur(7 * s * SS))
        alpha = np.array(halo)[..., 3].astype(np.float32) * 0.85
        halo_arr = np.array(halo)
        halo_arr[..., 3] = alpha.clip(0, 255).astype(np.uint8)
        _downsample_onto(img, Image.fromarray(halo_arr))
    stem = Image.new("RGBA", face.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(stem)
    sd.polygon(_tx(STEM, s, ox, oy), fill=STEM_RGB + (255,))
    sd.polygon(_tx(LEAF, s, ox, oy), fill=LEAF_RGB + (255,))
    _downsample_onto(img, stem)
    _downsample_onto(img, face)
    return img


def bats(img, specs, s, ox, oy, rgb):
    W, H = img.size
    layer = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for (cx, cy), width, tilt in specs:
        pts = _bat((cx * s + ox, cy * s + oy), width * s, tilt)
        d.polygon([(x * SS, y * SS) for x, y in pts], fill=rgb + (255,))
    _downsample_onto(img, layer)
    return img


def letter_color(img):
    a = np.array(img)
    mask = a[..., 3] > 200
    return tuple(int(v) for v in np.median(a[mask][:, :3], axis=0))


def wordmark(name):
    src = Image.open(os.path.join(SRC, name)).convert("RGBA")
    ink = letter_color(src)
    img = Image.new("RGBA", (src.width, src.height + PAD_TOP), (0, 0, 0, 0))
    img.alpha_composite(src, (0, PAD_TOP))
    img = pumpkin_crescent(img, 1, 0, PAD_TOP)
    light = name.endswith("-light.png")
    img = jack_o_lantern(img, 1, 0, PAD_TOP, glow=not light, face_rgb=FACE_ON_LIGHT if light else FACE)
    img = bats(img, BATS_WORDMARK, 1, 0, PAD_TOP, ink)
    return img


def mark(scale=1.0):
    """The O on its own (the original mark.png is the O cropped at 201,10)."""
    src = Image.open(os.path.join(SRC, "mark.png")).convert("RGBA")
    pad = 26
    img = Image.new("RGBA", (src.width, src.height + pad), (0, 0, 0, 0))
    img.alpha_composite(src, (0, pad))
    ox, oy = -201, -10 + pad
    img = pumpkin_crescent(img, 1, ox, oy)
    img = jack_o_lantern(img, 1, ox, oy)
    if scale != 1.0:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    return img


def app_icon():
    """The 1024 icon: the wordmark sits at 1:1 at (85, 419)."""
    img = Image.open(os.path.join(SRC, "app-icon-1024.png")).convert("RGBA")
    a = np.array(img).astype(np.float32)
    # The moon (top right) becomes an orange harvest moon.
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    moon = (xx > 470) & (yy < 470) & (r > 40) & (r > g * 1.6) & (r > b * 1.4)
    for y, x in zip(*np.where(moon)):
        pr, pg, pb = a[y, x, :3] / 255
        _, l, sat = colorsys.rgb_to_hls(pr, pg, pb)
        t = min(1.0, max(0.0, (y - 90) / 360))
        nr, ng, nb = colorsys.hls_to_rgb((30 - 10 * t) / 360, min(0.6, l * 1.1), sat)
        a[y, x, :3] = (nr * 255, ng * 255, nb * 255)
    img = Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")
    img = bats(img, [((720, 195), 150, -12), ((858, 268), 84, 10)], 1, 0, 0, (6, 6, 6))
    img = pumpkin_crescent(img, 1, 85, 419)
    img = jack_o_lantern(img, 1, 85, 419)
    return img


def tile(size, mark_img, rounded_from=None, bg=(8, 8, 8, 255)):
    if rounded_from:
        base = Image.open(rounded_from).convert("RGBA").resize((size, size), Image.LANCZOS)
        a = np.array(base)
        a[..., :3] = np.where(a[..., 3:4] > 0, np.array(bg[:3], dtype=np.uint8), a[..., :3])
        base = Image.fromarray(a, "RGBA")
    else:
        base = Image.new("RGBA", (size, size), bg)
    # Centre on the O itself, not on the stem above it.
    stem_pad = round(26 * mark_img.width / 159)
    x = (size - mark_img.width) // 2
    y = (size - (mark_img.height - stem_pad)) // 2 - stem_pad
    base.alpha_composite(mark_img, (x, y))
    return base


def main():
    os.makedirs(OUT, exist_ok=True)
    wordmark("wordmark.png").save(os.path.join(OUT, "wordmark.png"), optimize=True)
    wordmark("wordmark-light.png").save(os.path.join(OUT, "wordmark-light.png"), optimize=True)
    mark().save(os.path.join(OUT, "mark.png"), optimize=True)

    icon = app_icon()
    icon.save(os.path.join(OUT, "app-icon-1024.png"), optimize=True)
    icon.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, "app-icon-512.png"), optimize=True)
    icon.convert("RGB").resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, "apple-icon.png"), optimize=True)

    # Maskable keeps the O inside the safe zone; the favicon shows it larger.
    tile(512, mark(1.0)).save(os.path.join(OUT, "maskable-512.png"), optimize=True)
    tile(512, mark(1.75), rounded_from=os.path.join(SRC, "favicon-512.png")).save(
        os.path.join(OUT, "favicon-512.png"), optimize=True)
    print("wrote", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()
