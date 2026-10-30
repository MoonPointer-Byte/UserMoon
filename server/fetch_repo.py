import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path
from urllib.request import Request, urlopen

repo = sys.argv[1]
folder = sys.argv[2]
root = Path(
    os.environ.get("USERMOON_SRC_ROOT")
    or (r"D:\usermoon-src" if os.name == "nt" else "/home/ubuntu/usermoon-src")
)
root.mkdir(parents=True, exist_ok=True)
dest = root / folder
zip_path = root / f"{folder}.zip"

# CN mirrors first — raw github.com is often unusable on domestic CVM.
GIT_URLS = [
    f"https://ghproxy.net/https://github.com/{repo}.git",
    f"https://mirror.ghproxy.com/https://github.com/{repo}.git",
    f"https://gitclone.com/github.com/{repo}.git",
    f"https://github.com/{repo}.git",
]

ZIP_URLS = []
# Prefer master: Ideaface (and several MoonPointer repos) use master, not main.
for ref in ("master", "main"):
    # codeload is reachable from Tencent CVM; ghproxy often 403.
    ZIP_URLS.extend(
        [
            f"https://codeload.github.com/{repo}/zip/refs/heads/{ref}",
            f"https://ghproxy.net/https://codeload.github.com/{repo}/zip/refs/heads/{ref}",
            f"https://mirror.ghproxy.com/https://codeload.github.com/{repo}/zip/refs/heads/{ref}",
        ]
    )


def has_source(path: Path) -> bool:
    """Reject .git-only or tiny/wrong-branch checkouts (e.g. empty main)."""
    if not path.is_dir():
        return False
    names = {item.name for item in path.iterdir() if item.name != ".git"}
    if not names:
        return False
    # Real project trees have more than a lone license/readme.
    meaningful = names - {"LICENSE", "README.md", "README", ".gitignore"}
    return bool(meaningful)


if has_source(dest):
    print(dest)
    raise SystemExit(0)

if dest.exists():
    shutil.rmtree(dest, ignore_errors=True)


def via_git() -> bool:
    if shutil.which("git") is None:
        return False
    for url in GIT_URLS:
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=True)
        try:
            subprocess.check_call(
                ["git", "clone", "--depth", "1", url, str(dest)],
                cwd=str(root),
                timeout=180,
            )
            if has_source(dest):
                return True
        except Exception:
            pass
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=True)
    return False


def via_gh_zip() -> bool:
    if shutil.which("gh") is None:
        return False
    if zip_path.exists():
        zip_path.unlink()
    try:
        with zip_path.open("wb") as handle:
            subprocess.check_call(["gh", "api", f"repos/{repo}/zipball"], stdout=handle, timeout=180)
        return zip_path.exists() and zip_path.stat().st_size > 1000
    except Exception:
        zip_path.unlink(missing_ok=True)
        return False


def via_codeload() -> bool:
    for url in ZIP_URLS:
        if zip_path.exists():
            zip_path.unlink()
        try:
            req = Request(url, headers={"User-Agent": "usermoon-fetch"})
            with urlopen(req, timeout=180) as resp, zip_path.open("wb") as handle:
                shutil.copyfileobj(resp, handle)
            if zip_path.exists() and zip_path.stat().st_size > 1000:
                return True
        except Exception:
            zip_path.unlink(missing_ok=True)
    return False


def extract_zip() -> None:
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


# Prefer zip on CN clouds (git clone to github.com often hangs).
ok = via_codeload() or via_gh_zip()
if ok:
    extract_zip()
    if has_source(dest):
        print(dest)
        raise SystemExit(0)
    shutil.rmtree(dest, ignore_errors=True)

if via_git():
    print(dest)
    raise SystemExit(0)

raise SystemExit(f"无法下载仓库 {repo}（需要 git / gh / 外网访问 GitHub）")
