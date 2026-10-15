"""Generate the Millie's tab favicon (cart crop) from the brandmark.

PWA / Electron squares are owned by scripts/sync-branding-from-master.mjs.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "branding" / "brandmark.png"
OUT = ROOT / "public" / "favicon.png"


def is_bg(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    return a < 8 or (r > 245 and g > 245 and b > 245)


def trim(im: Image.Image) -> Image.Image:
    px = im.load()
    assert px is not None
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            if not is_bg(px[x, y]):
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    return im.crop((minx, miny, maxx + 1, maxy + 1))


def square_pad(im: Image.Image, pad_ratio: float = 0.12) -> Image.Image:
    cw, ch = im.size
    side = max(cw, ch)
    pad = int(side * pad_ratio)
    side2 = side + pad * 2
    sq = Image.new("RGBA", (side2, side2), (255, 255, 255, 255))
    sq.paste(im, ((side2 - cw) // 2, (side2 - ch) // 2), im)
    return sq


def main() -> None:
    full = trim(Image.open(SRC).convert("RGBA"))
    fw, fh = full.size
    cart = trim(full.crop((0, 0, fw, int(fh * 0.42))))
    favicon = square_pad(cart).resize((32, 32), Image.Resampling.LANCZOS)
    favicon.save(OUT, optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
