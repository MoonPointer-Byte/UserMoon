#!/usr/bin/env python3
import zipfile
from pathlib import Path

zip_path = Path("/tmp/Ideaface-src.zip")
dest = Path("/home/ubuntu/usermoon-src/Ideaface")
dest.mkdir(parents=True, exist_ok=True)

with zipfile.ZipFile(zip_path) as z:
    for info in z.infolist():
        name = info.filename.replace("\\", "/").lstrip("/")
        if not name:
            continue
        target = dest / name
        if info.is_dir() or name.endswith("/"):
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        with z.open(info) as src, open(target, "wb") as out:
            out.write(src.read())

print("ok", dest)
print("frontend", (dest / "interview-frontend").is_dir())
print("agent", (dest / "interview-agent").is_dir())
