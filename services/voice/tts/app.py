import json
import os
import subprocess

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="Robo TTS", version="1.0.0")

DATA_DIR = os.getenv("TTS_DATA_DIR", "/models")
DEFAULT_VOICE = os.getenv("TTS_VOICE", "en_US-lessac-medium")


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    voice: str | None = None
    language: str | None = None
    sampleRate: int | None = None
    format: str = "pcm16"


def model_path(voice: str) -> str:
    return os.path.join(DATA_DIR, f"{voice}.onnx")


def model_sample_rate(voice: str) -> int:
    config_path = os.path.join(DATA_DIR, f"{voice}.onnx.json")
    try:
        with open(config_path, encoding="utf-8") as config_file:
            config = json.load(config_file)
        return int(config["audio"]["sample_rate"])
    except (OSError, KeyError, TypeError, ValueError) as error:
        raise HTTPException(status_code=500, detail="voice config is invalid") from error


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "voice": DEFAULT_VOICE}


@app.post("/synthesize")
def synthesize(request: SynthesizeRequest) -> Response:
    if request.format != "pcm16":
        raise HTTPException(status_code=415, detail="only pcm16 is supported")

    voice = request.voice or DEFAULT_VOICE
    path = model_path(voice)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"voice {voice} is not installed")

    try:
        result = subprocess.run(
            ["piper", "--model", path, "--output_raw"],
            input=request.text.encode("utf-8"),
            capture_output=True,
            check=False,
            timeout=60,
        )
    except subprocess.TimeoutExpired as error:
        raise HTTPException(status_code=504, detail="piper timed out") from error

    if result.returncode != 0:
        detail = result.stderr.decode("utf-8", errors="replace")[-500:]
        raise HTTPException(status_code=500, detail=f"piper failed: {detail}")

    if not result.stdout:
        raise HTTPException(status_code=500, detail="piper returned no audio")

    return Response(
        content=result.stdout,
        media_type="application/octet-stream",
        headers={
            "X-Audio-Codec": "pcm16",
            "X-Sample-Rate": str(model_sample_rate(voice)),
        },
    )
