import shutil
from pathlib import Path

p = Path("scripts") / "_debug"
if p.exists():
    shutil.rmtree(p)
    print("removed", p)
