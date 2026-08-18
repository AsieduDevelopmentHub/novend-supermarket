from pathlib import Path
from PIL import Image

root = Path(r"C:\Users\Asiedu\Desktop\Dev\Software\novend-pos")
sheet = Image.open(root / "docs/design/branding/logo_generated.png")
w, h = sheet.size
mx, my = w // 2, h // 2
debug = root / "scripts" / "_debug"
debug.mkdir(exist_ok=True)
sheet.crop((0, 0, mx, my)).save(debug / "tl.png")
sheet.crop((mx, 0, w, my)).save(debug / "tr.png")
sheet.crop((0, my, mx, h)).save(debug / "bl.png")
sheet.crop((mx, my, w, h)).save(debug / "br.png")
print(w, h, mx, my)
