"""Cut the Japanese pack's watermarks out of the reference painting.

Ink on rice paper: each pixel is treated as ink laid over the paper colour,
and the paper is lifted out (colour-to-alpha), so each element keeps its
own brushwork and colour and sits on any page. Crop edges are feathered so
no piece shows a hard rectangle.

    python3 tools/cut-ja-art.py path/to/painting.jpg

Writes packs/ja/art/*.webp and a small paper-tone readout.
"""
import sys, os
import numpy as np
from PIL import Image

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "packs", "ja", "art")

# name: (x0, y0, x1, y1) in the 765x1024 painting
CROPS = {
    "crane":    (0, 0, 420, 345),      # crane over the old pine
    "fuji":     (345, 78, 578, 282),   # Fuji above the clouds
    "heiwa":    (546, 100, 702, 422),  # 平和, "peace"
    "koi":      (192, 462, 505, 845),  # the two koi in the stream
    "blossom":  (0, 255, 322, 505),    # cherry on the pine's lower branch
    "pine":     (378, 280, 582, 472),  # pine branch over the water
    "bamboo":   (538, 452, 765, 782),  # bamboo with plum
    "iris":     (88, 728, 335, 965),   # iris and mossy stones
    "stream":   (240, 815, 765, 1005), # swirling water
    "seal":     (590, 784, 666, 864),  # the artist's seal
}
FEATHER = 0.14     # fraction of the crop's short side faded at the edges
GRAIN = 0.10       # alpha below this is paper texture, not ink
GLINT = 0.30       # paper lighter than this is grain too; only real white paint counts
SEAL = "seal"      # the seal is cut on its own and painted out of every other piece


def paper_colour(a):
    # the brightest common colour along the border is the paper
    border = np.concatenate([a[:12].reshape(-1, 3), a[-12:].reshape(-1, 3),
                             a[:, :12].reshape(-1, 3), a[:, -12:].reshape(-1, 3)])
    lum = border.mean(1)
    return np.median(border[lum > np.percentile(lum, 60)], axis=0)


def colour_to_alpha(rgb, paper):
    c = rgb.astype(np.float32)
    p = paper.astype(np.float32)
    darker = np.where(c < p, (p - c) / np.maximum(p, 1), 0)
    lighter = np.where(c > p, (c - p) / np.maximum(255 - p, 1), 0)
    lighter = np.clip((lighter - GLINT) / (1 - GLINT), 0, 1)
    alpha = np.maximum(darker, lighter).max(axis=2)
    alpha = np.clip((alpha - GRAIN) / (1 - GRAIN), 0, 1)
    a3 = alpha[..., None]
    fg = np.where(a3 > 0.001, (c - (1 - a3) * p) / np.maximum(a3, 0.001), 0)
    return np.clip(fg, 0, 255), alpha


def feather(h, w):
    k = FEATHER * min(h, w)
    y = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None] / k
    x = np.minimum(np.arange(w), np.arange(w)[::-1])[None, :] / k
    m = np.clip(np.minimum(x, y), 0, 1)
    return m * m * (3 - 2 * m)          # smoothstep


def main():
    im = np.asarray(Image.open(SRC).convert("RGB"))
    paper = paper_colour(im)
    print("paper", "#%02X%02X%02X" % tuple(int(v) for v in paper))
    os.makedirs(OUT, exist_ok=True)
    clean = im.copy()
    sx0, sy0, sx1, sy1 = CROPS[SEAL]
    clean[sy0:sy1, sx0:sx1] = paper
    for name, (x0, y0, x1, y1) in CROPS.items():
        src = im if name == SEAL else clean
        fg, alpha = colour_to_alpha(src[y0:y1, x0:x1], paper)
        if name != SEAL:
            alpha = alpha * feather(*alpha.shape)
        rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
        path = os.path.join(OUT, name + ".webp")
        Image.fromarray(rgba, "RGBA").save(path, "WEBP", quality=86, method=6)
        print(f"{name:8s} {x1-x0}x{y1-y0}  {os.path.getsize(path)//1024} KB")


main()
