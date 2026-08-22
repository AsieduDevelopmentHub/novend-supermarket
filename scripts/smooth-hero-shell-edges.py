"""Smooth silhouette edges on the hero shell PNG; keep glow + screen intact."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public" / "marketing" / "v3"
SRC = V3 / "hero-shell-empty-no-bg.png"
BAK = V3 / "hero-shell-empty-no-bg.pre-smooth.png"


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    BAK.write_bytes(SRC.read_bytes())

    arr = np.array(im)
    r = arr[:, :, 0].astype(np.float32)
    g = arr[:, :, 1].astype(np.float32)
    b = arr[:, :, 2].astype(np.float32)
    a = arr[:, :, 3].astype(np.float32)

    # Cyan / lime base glow — never strip
    is_glow = (g > 70) & ((g > r + 12) | (b > r + 12)) & ((g + b) > r + 40)

    subject = a > 20
    subj_img = Image.fromarray((subject.astype(np.uint8) * 255), "L")
    eroded = np.array(subj_img.filter(ImageFilter.MinFilter(3))) > 0
    dilated = np.array(subj_img.filter(ImageFilter.MaxFilter(5))) > 0
    edge_band = subject & ~eroded

    alpha_soft = np.array(
        Image.fromarray(a.astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(radius=0.9))
    ).astype(np.float32)

    a_out = a.copy()
    # Soften jagged silhouette only on the edge band
    a_out[edge_band] = 0.4 * a[edge_band] + 0.6 * alpha_soft[edge_band]

    # Kill dark matte fringe (leftover black plate on edges)
    dark_edge = edge_band & (r < 35) & (g < 35) & (b < 35) & ~is_glow
    a_out[dark_edge] *= 0.12

    # Orphan near-black outside the dilated subject
    orphan_dark = (
        ~dilated & (r < 40) & (g < 40) & (b < 40) & (a_out > 0) & ~is_glow
    )
    a_out[orphan_dark] = 0
    a_out[a < 2] = 0

    # Keep glow strength
    glow_keep = is_glow & (a > 10)
    a_out[glow_keep] = np.maximum(a_out[glow_keep], a[glow_keep] * 0.94)

    out = arr.copy()
    out[:, :, 3] = np.clip(a_out, 0, 255).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(SRC, optimize=True)

    print("saved", SRC)
    print("backup", BAK)
    print(
        "zeroA",
        int((out[:, :, 3] == 0).sum()),
        "partialA",
        int(((out[:, :, 3] > 0) & (out[:, :, 3] < 255)).sum()),
    )


if __name__ == "__main__":
    main()
