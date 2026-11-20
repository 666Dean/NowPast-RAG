"""Install the optional Windows x64 / macOS inference engine. Python 3.11.8+."""
import concurrent.futures
import hashlib
import os
from pathlib import Path
import platform
import sys
import tarfile
import tempfile
import time
import urllib.request
import zipfile

MODEL = (
    "model.gguf", 491400032, "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db",
    ["https://modelscope.cn/models/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/master/qwen2.5-0.5b-instruct-q4_k_m.gguf",
     "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf"],
)
RUNTIME = (
    "llama.zip", 24876565, "2f3dcb3aea4f52bf734f52040d2a688bdd76c2f762ae200a159646b37d84e393",
    ["https://github.com/ggml-org/llama.cpp/releases/download/b12559/llama-b12559-bin-win-cpu-x64.zip"],
)
MAC_RUNTIMES = {
    "arm64": ("llama.tar.gz", 16449886, "d8ab6a83e23e6b66cee98849c4d2593777895440bc5b045a9518035c1b0aa0bc",
              ["https://github.com/ggml-org/llama.cpp/releases/download/b12559/llama-b12559-bin-macos-arm64.tar.gz"]),
    "x86_64": ("llama.tar.gz", 12227467, "a094948a61922a8ad69658683c6a5862310f2ed82c166f65b142645bfb497996",
               ["https://github.com/ggml-org/llama.cpp/releases/download/b12559/llama-b12559-bin-macos-x64.tar.gz"]),
}


def file_hash(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def fetch(cache, asset):
    name, size, digest, urls = asset
    target = cache / name
    if target.exists() and target.stat().st_size == size and file_hash(target) == digest:
        return target
    # Small verified ranges survive a dropped long-lived connection. Retrying a
    # slice cannot overwrite another slice; the published digest verifies assembly.
    block = 2 * 1024 * 1024
    with tempfile.NamedTemporaryFile(prefix=name + ".", suffix=".part", dir=cache, delete=False) as temp:
        temp.truncate(size)
        staged = Path(temp.name)

    def read_range(start):
        end = min(start + block, size) - 1
        header = f"bytes {start}-{end}/{size}"
        for attempt in range(6):
            try:
                url = urls[attempt % len(urls)] + f"?segment={start}&attempt={attempt}"
                request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
                with urllib.request.urlopen(request, timeout=35) as response:
                    if response.status != 206 or response.headers.get("Content-Range") != header:
                        raise ValueError("Unexpected range response")
                    data = response.read(end - start + 2)
                if len(data) != end - start + 1:
                    raise ValueError("Unexpected range length")
                with staged.open("r+b") as output:
                    output.seek(start)
                    output.write(data)
                return
            except (OSError, ValueError) as exc:
                if attempt == 5:
                    raise RuntimeError(f"Download failed for {name} at byte {start}") from exc
                time.sleep(0.4 * (attempt + 1))

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            for _ in pool.map(read_range, range(0, size, block)):
                pass
        if file_hash(staged) != digest:
            raise ValueError(f"SHA-256 mismatch for {name}")
        staged.replace(target)
        return target
    finally:
        staged.unlink(missing_ok=True)


if __name__ == "__main__":
    if sys.version_info < (3, 11, 8):
        sys.exit("Python 3.11.8 or newer is required.")
    machine = platform.machine().lower()
    if sys.platform == "darwin" and machine in MAC_RUNTIMES:
        asset = MAC_RUNTIMES[machine]
        default_cache = Path.home() / "Library" / "Caches" / "NowPast" / "models"
        executable = "llama-server"
    elif sys.platform == "win32" and machine in ("amd64", "x86_64"):
        asset = RUNTIME
        default_cache = Path(os.environ["LOCALAPPDATA"]) / "NowPast" / "models"
        executable = "llama-server.exe"
    else:
        sys.exit("Supported platforms: Windows x64 and macOS arm64/x64.")
    cache = Path(os.getenv("NOWPAST_MODEL_HOME") or default_cache)
    cache.mkdir(parents=True, exist_ok=True)
    print("Verifying Qwen 2.5 weights and llama.cpp CPU runtime...", flush=True)
    fetch(cache, MODEL)
    archive_path = fetch(cache, asset)
    runtime = cache / "b12559"
    ready = runtime / ".verified-archive"
    if not (ready.is_file() and ready.read_text() == asset[2] and any(runtime.rglob(executable))):
        # Compare existing files with ZIP member CRCs before rewriting: on
        # Windows a running model process keeps executable files locked.
        import zlib
        if sys.platform == "darwin":
            runtime.mkdir(parents=True, exist_ok=True)
            with tarfile.open(archive_path) as archive:
                archive.extractall(runtime, filter="data")
        else:
            with zipfile.ZipFile(archive_path) as archive:
                for member in archive.infolist():
                    target = runtime / member.filename
                    if member.is_dir() or not target.is_file() or target.stat().st_size != member.file_size or zlib.crc32(target.read_bytes()) != member.CRC:
                        archive.extract(member, runtime)
        ready.write_text(asset[2])
    print(f"Model ready in {cache}")
