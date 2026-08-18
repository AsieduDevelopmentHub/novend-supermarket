"""Crop Novend assets from the generated logo sheet.

Sheet is 1027x686, four quadrants. Skip top-left wordmark.
"""

from pathlib import Path
from PIL import Image, ImageChops

ROOT = Path(r"C:\Users\Asiedu\Desktop\Dev\Software\novend-pos")
SHEET = ROOT / "docs" / "design" / "branding" / "logo_generated.png"
OUT = ROOT / "public" / "branding"
ICONS = ROOT / "public" / "icons"
APP = ROOT / "app"
NAVY = (17, 24, 39, 255)


def bbox(im: Image.Image, threshold: int = 20, pad: int = 8) -> tuple[int, int, int, int]:
    gray = im.convert("L")
    w, h = gray.size
    bg = gray.getpixel((2, 2))
    diff = ImageChops.difference(gray, Image.new("L", gray.size, bg))
    mask = diff.point(lambda p: 255 if p > threshold else 0)
    box = mask.getbbox() or (0, 0, w, h)
    l, t, r, b = box
    return max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)


def save(im: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGBA").save(dest, "PNG")
    print("wrote", dest, im.size)


def square(im: Image.Image, fill=NAVY, size: int | None = None) -> Image.Image:
    im = im.convert("RGBA")
    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), fill)
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)
    if size:
        canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)
    return canvas


sheet = Image.open(SHEET).convert("RGB")

# Top-right: icon + wordmark. Drop label (top) and footer bar (bottom).
horizontal = sheet.crop((545, 62, 1008, 292)).crop(
    bbox(sheet.crop((545, 62, 1008, 292)), pad=6)
)

# Bottom-left: dark vertical lockup with tagline.
vertical = sheet.crop((28, 362, 488, 672)).crop(
    bbox(sheet.crop((28, 362, 488, 672)), threshold=12, pad=6)
)

# Brandmark: N icon only from the left of the horizontal lockup.
hw, hh = horizontal.size
icon = horizontal.crop((0, 0, int(hw * 0.30), hh)).crop(
    bbox(horizontal.crop((0, 0, int(hw * 0.30), hh)), threshold=16, pad=4)
)

OUT.mkdir(parents=True, exist_ok=True)
ICONS.mkdir(parents=True, exist_ok=True)

save(horizontal, OUT / "logo_horizontal.png")
save(vertical, OUT / "logo_vertical.png")
save(icon, OUT / "brandmark.png")
save(vertical, OUT / "login_hero.png")

save(square(icon, size=64), ROOT / "public" / "favicon.png")
save(square(icon, size=192), ICONS / "icon-192.png")
save(square(icon, size=512), ICONS / "icon-512.png")
save(square(icon, size=192), APP / "icon.png")
save(square(icon, size=180), APP / "apple-icon.png")
