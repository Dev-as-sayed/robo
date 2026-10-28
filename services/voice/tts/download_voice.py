import os
import sys
import urllib.request
from pathlib import Path

DEFAULT_VOICE = "en_US-lessac-medium"
PATH_PREFIX = "rhasspy/piper-voices/resolve/main"
DEFAULT_BASES = (
    "https://huggingface.co",
    "https://hf-mirror.com",
)


def voice_path(voice: str) -> str:
    try:
        locale, name, quality = voice.split("-", 2)
    except ValueError as error:
        raise SystemExit(f"invalid voice id: {voice}") from error

    language = locale.split("_")[0]
    return f"{language}/{locale}/{name}/{quality}/{voice}"


def base_urls() -> list[str]:
    override = os.getenv("PIPER_VOICE_BASE_URL")
    return [override.rstrip("/")] if override else list(DEFAULT_BASES)


def download_file(url: str, target: Path, timeout: float) -> None:
    temporary = target.with_suffix(f"{target.suffix}.part")
    request = urllib.request.Request(url, headers={"User-Agent": "robo-voice-downloader/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        with open(temporary, "wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
    os.replace(temporary, target)


def download(voice: str, data_dir: str) -> None:
    directory = Path(data_dir)
    directory.mkdir(parents=True, exist_ok=True)
    timeout = float(os.getenv("PIPER_VOICE_DOWNLOAD_TIMEOUT", "60"))

    for suffix in (".onnx", ".onnx.json"):
        target = directory / f"{voice}{suffix}"
        if target.exists():
            continue

        errors: list[str] = []
        for base in base_urls():
            url = f"{base}/{PATH_PREFIX}/{voice_path(voice)}{suffix}"
            print(f"downloading {url}")
            try:
                download_file(url, target, timeout)
                break
            except Exception as error:  # noqa: BLE001
                errors.append(f"{url}: {error}")
                print(f"failed: {error}")

        if not target.exists():
            raise SystemExit("voice download failed:\n" + "\n".join(errors))


def configured_voices() -> list[str]:
    raw = os.getenv("TTS_VOICES") or os.getenv("TTS_VOICE") or DEFAULT_VOICE
    voices = [voice.strip() for voice in raw.split(",") if voice.strip()]
    return list(dict.fromkeys(voices))


if __name__ == "__main__":
    for configured in configured_voices():
        download(configured, os.getenv("TTS_DATA_DIR", "/models"))
    sys.exit(0)
