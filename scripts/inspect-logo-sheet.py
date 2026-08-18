from pathlib import Path
from PIL import Image

path = Path(r"C:\Users\Asiedu\Desktop\Dev\Software\novend-pos\docs\design\branding\logo_generated.png")
im = Image.open(path)
print("size", im.size, "mode", im.mode)
