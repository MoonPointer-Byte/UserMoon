import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

repo = sys.argv[1]
folder = sys.argv[2]
root = Path(r"D:\usermoon-src")
root.mkdir(parents=True, exist_ok=True)
dest = root / folder
zip_path = root / f"{folder}.zip"
if dest.exists() and any(dest.iterdir()):
    print(dest)
    raise SystemExit(0)

if zip_path.exists():
    zip_path.unlink()
with zip_path.open("wb") as handle:
    subprocess.check_call(["gh", "api", f"repos/{repo}/zipball"], stdout=handle)
tmp = root / f"_tmp_{folder}"
if tmp.exists():
    shutil.rmtree(tmp)
tmp.mkdir()
with zipfile.ZipFile(zip_path) as archive:
    archive.extractall(tmp)
inner = next(path for path in tmp.iterdir() if path.is_dir())
if dest.exists():
    shutil.rmtree(dest)
shutil.move(str(inner), dest)
shutil.rmtree(tmp, ignore_errors=True)
zip_path.unlink(missing_ok=True)
print(dest)
