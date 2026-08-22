"""Key green screen from CTA empty shells → transparent device diagram (no UI)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
V3 = ROOT / "public" / "marketing" / "v3"
SRC = V3 / "cta-shell-empty.png"
OUT = V3 / "cta-devices.png"
BAK = V3 / "cta-devices.png.before-empty-shells.png"


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    if OUT.exists():
        BAK.write_bytes(OUT.read_bytes())

    arr = np.array(im).astype(np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]

    # Chroma green plate
    green = (g > 140) & (g > r + 35) & (g > b + 35)
    soft = (g > 110) & (g > r + 20) & (g > b + 20) & ~green
    a_out = a.copy()
    a_out[green] = 0
    fade = np.clip(255 - (g - 110) * 4, 0, 255)
    a_out[soft] = np.minimum(a_out[soft], fade[soft])

    # Kill residual green fringe on edges
    fringe = (g > r + 15) & (g > b + 10) & (g > 80) & (a_out > 0) & (a_out < 250)
    # Despill RGB toward luminance
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    r2, g2, b2 = r.copy(), g.copy(), b.copy()
    r2[fringe] = np.maximum(r[fringe], lum[fringe] * 0.9)
    g2[fringe] = np.minimum(g[fringe], lum[fringe] * 1.05)
    b2[fringe] = np.maximum(b[fringe], np.minimum(b[fringe], lum[fringe] * 1.05))
    a_out[fringe] *= 0.55

    out = np.stack([r2, g2, b2, a_out], axis=-1)
    out = np.clip(out, 0, 255).astype(np.uint8)

    # Soften silhouette slightly
    alpha = Image.fromarray(out[:, :, 3], "L").filter(ImageFilter.GaussianBlur(0.45))
    soft_a = np.array(alpha).astype(np.float32)
    subject = out[:, :, 3] > 20
    edge = subject & ~(
        np.array(
            Image.fromarray((subject.astype(np.uint8) * 255), "L").filter(
                ImageFilter.MinFilter(3)
            )
        )
        > 0
    )
    blended = out[:, :, 3].astype(np.float32)
    blended[edge] = 0.5 * blended[edge] + 0.5 * soft_a[edge]
    out[:, :, 3] = np.clip(blended, 0, 255).astype(np.uint8)

    Image.fromarray(out, "RGBA").save(OUT, optimize=True)
    print("wrote", OUT, "transparent", int((out[:, :, 3] == 0).sum()))


if __name__ == "__main__":
    main()
