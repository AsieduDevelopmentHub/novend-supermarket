"""Composite real Novend dashboard onto empty device shells (transparent BG)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public" / "marketing" / "v3"
DASHBOARD = ROOT / "public" / "marketing" / "dashboard.png"


def chroma_key(im: Image.Image) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3].copy()
    green = (g > 160) & (g > r + 30) & (g > b + 30)
    white = (r > 248) & (g > 248) & (b > 248)
    a[green | white] = 0
    soft_g = (g > 130) & (g > r + 18) & (g > b + 18) & ~green
    fade = np.clip(255 - (g.astype(np.int16) - 130) * 5, 0, 255).astype(np.uint8)
    a[soft_g] = np.minimum(a[soft_g], fade[soft_g])
    # mute residual green floor glow
    glow = (g > r + 20) & (g > b + 10) & (g > 70) & (a > 0) & ~green
    a[glow] = (a[glow].astype(np.float32) * 0.2).astype(np.uint8)
    out = arr.copy()
    out[:, :, 3] = a
    return Image.fromarray(out, "RGBA")


def cover_fit(src: Image.Image, size: tuple[int, int], top_bias: float = 0.08) -> Image.Image:
    tw, th = size
    sw, sh = src.size
    scale = max(tw / sw, th / sh)
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - tw) // 2
    top = int(max(0, (nh - th) * top_bias))
    top = min(top, max(0, nh - th))
    return resized.crop((left, top, left + tw, top + th)).convert("RGBA")


def black_screen_mask(im: Image.Image) -> np.ndarray:
    arr = np.array(im)
    a = arr[:, :, 3]
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    # Strict black glass (screens), not dark grey chassis
    return (a > 200) & (r < 35) & (g < 35) & (b < 35)


def fill_mask_with_image(base: Image.Image, mask: np.ndarray, ui: Image.Image) -> Image.Image:
    """Paste UI into the bbox of mask, only where mask is True."""
    ys, xs = np.where(mask)
    if xs.size < 200:
        return base
    l, t, r, b = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
    w, h = r - l + 1, b - t + 1
    fitted = cover_fit(ui, (w, h))
    fitted_arr = np.array(fitted)
    local = mask[t : b + 1, l : r + 1]
    out = np.array(base)
    # Where local mask, replace RGB and keep opaque
    region = out[t : b + 1, l : r + 1]
    region[local] = fitted_arr[local]
    region[local, 3] = 255
    out[t : b + 1, l : r + 1] = region
    return Image.fromarray(out, "RGBA")


def composite_hero() -> None:
    shell = chroma_key(Image.open(V3 / "hero-shell-empty.png"))
    mask = black_screen_mask(shell)
    # Keep only the largest contiguous horizontal band (the panel), drop stand shadows
    # Restrict to upper 72% of image so stand base isn't included
    h = mask.shape[0]
    mask[int(h * 0.72) :, :] = False
    out = fill_mask_with_image(shell, mask, Image.open(DASHBOARD))
    out.save(V3 / "hero-monitor.png", optimize=True)
    ys, xs = np.where(mask)
    print("hero screen", xs.min(), ys.min(), xs.max(), ys.max(), "px", xs.size)


def composite_cta() -> None:
    shell = chroma_key(Image.open(V3 / "cta-shell-empty.png"))
    mask = black_screen_mask(shell)
    h, w = mask.shape
    # Split: laptop is left ~70%, phone is right ~30% and taller aspect
    left = mask.copy()
    left[:, int(w * 0.62) :] = False
    # Drop keyboard darkness — only upper portion of left
    left[int(h * 0.58) :, :] = False

    right = mask.copy()
    right[:, : int(w * 0.62)] = False
    # Phone is tall — keep vertical strip
    right[: int(h * 0.08), :] = False

    out = fill_mask_with_image(shell, left, Image.open(DASHBOARD))
    out = fill_mask_with_image(out, right, Image.open(DASHBOARD))
    out.save(V3 / "cta-devices.png", optimize=True)
    for name, m in (("laptop", left), ("phone", right)):
        ys, xs = np.where(m)
        if xs.size:
            print(name, xs.min(), ys.min(), xs.max(), ys.max(), "px", xs.size)
        else:
            print(name, "EMPTY")


def main() -> None:
    composite_hero()
    composite_cta()


if __name__ == "__main__":
    main()
