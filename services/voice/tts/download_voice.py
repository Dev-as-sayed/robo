import os
import sys
import urllib.request

DEFAULT_VOICE = "en_US-lessac-medium"
BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main"


def voice_url(voice: str, suffix: str) -> str:
    try:
        locale, name, quality = voice.split("-", 2)
    except ValueError as error:
        raise SystemExit(f"invalid voice id: {voice}") from error

    language = locale.split("_")[0]
    return f"{BASE_URL}/{language}/{locale}/{name}/{quality}/{voice}{suffix}"


def download(voice: str, data_dir: str) -> None:
    os.makedirs(data_dir, exist_ok=True)

    for suffix in (".onnx", ".onnx.json"):
        target = os.path.join(data_dir, f"{voice}{suffix}")
        if os.path.exists(target):
            continue

        url = voice_url(voice, suffix)
        print(f"downloading {url}")
        temporary = f"{target}.part"
        urllib.request.urlretrieve(url, temporary)
        os.replace(temporary, target)


if __name__ == "__main__":
    download(os.getenv("TTS_VOICE", DEFAULT_VOICE), os.getenv("TTS_DATA_DIR", "/models"))
    sys.exit(0)
