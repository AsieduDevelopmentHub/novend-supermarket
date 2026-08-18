from pathlib import Path
from collections import Counter
from PIL import Image
import colorsys

im = Image.open(
    Path(r"C:\Users\Asiedu\Desktop\Dev\Software\novend-pos\docs\design\branding\logo_no_bg.png")
).convert("RGB")
w, h = im.size
px = im.load()

def sat(r, g, b):
    h_, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return s, v

# bucket by rounded rgb
buckets = Counter()
blueish = 0
whiteish = 0
dark = 0
grayish = 0
for y in range(0, h, 2):
    for x in range(0, w, 2):
        r, g, b = px[x, y]
        s, v = sat(r, g, b)
        key = (r // 16, g // 16, b // 16)
        buckets[key] += 1
        if s > 0.25 and b > r and b > 80:
            blueish += 1
        elif v > 0.92 and s < 0.12:
            whiteish += 1
        elif v < 0.22:
            dark += 1
        elif s < 0.08 and 0.55 < v < 0.85:
            grayish += 1

print("blueish", blueish, "whiteish", whiteish, "dark", dark, "grayish", grayish)
print("top buckets")
for k, n in buckets.most_common(15):
    print(tuple(c * 16 for c in k), n)

# find bounding boxes of saturated blue
xs, ys = [], []
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        s, v = sat(r, g, b)
        if s > 0.28 and b > 90 and (b > r + 10 or g > r):
            xs.append(x)
            ys.append(y)
print("blue bbox", min(xs), min(ys), max(xs), max(ys), "count", len(xs))

# white text bbox (exclude very gray)
wxs, wys = [], []
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        s, v = sat(r, g, b)
        if v > 0.93 and s < 0.08 and r > 230:
            wxs.append(x)
            wys.append(y)
print("white bbox", (min(wxs), min(wys), max(wxs), max(wys)) if wxs else None, "count", len(wxs))

dxs, dys = [], []
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        s, v = sat(r, g, b)
        if v < 0.28 and (s > 0.15 or v < 0.12):
            dxs.append(x)
            dys.append(y)
print("dark bbox", (min(dxs), min(dys), max(dxs), max(dys)) if dxs else None, "count", len(dxs))
