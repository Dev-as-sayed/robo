import os
import struct
import tempfile
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Request
from starlette.concurrency import run_in_threadpool

app = FastAPI(title="Robo STT", version="1.0.0")

MODEL_NAME = os.getenv("WHISPER_MODEL", "base")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")


@lru_cache(maxsize=1)
def get_model():
    from faster_whisper import WhisperModel

    return WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)


def pcm16_to_wav(pcm: bytes, sample_rate: int, channels: int = 1) -> bytes:
    byte_rate = sample_rate * channels * 2
    block_align = channels * 2
    header = b"RIFF" + struct.pack("<I", 36 + len(pcm)) + b"WAVE"
    header += b"fmt " + struct.pack("<IHHIIHH", 16, 1, channels, sample_rate, byte_rate, block_align, 16)
    header += b"data" + struct.pack("<I", len(pcm))
    return header + pcm


def parse_int_header(request: Request, name: str, default: int) -> int:
    raw = request.headers.get(name)
    if raw is None:
        return default

    try:
        value = int(raw)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=f"{name} must be an integer") from error

    if value <= 0:
        raise HTTPException(status_code=400, detail=f"{name} must be positive")
    return value


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/transcribe")
async def transcribe(request: Request) -> dict[str, object]:
    codec = request.headers.get("x-audio-codec", "pcm16")
    if codec != "pcm16":
        raise HTTPException(status_code=415, detail="only pcm16 is supported")

    sample_rate = parse_int_header(request, "x-sample-rate", 16000)
    language_header = request.headers.get("x-language")
    language = language_header.replace("_", "-").split("-")[0] if language_header else None
    audio = await request.body()

    if len(audio) < 320:
        raise HTTPException(status_code=400, detail="audio is too short")
    if len(audio) % 2 != 0:
        raise HTTPException(status_code=400, detail="pcm16 audio must have an even byte length")

    wav = pcm16_to_wav(audio, sample_rate)

    def run() -> dict[str, object]:
        model = get_model()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as audio_file:
            audio_file.write(wav)
            path = audio_file.name

        try:
            segments, info = model.transcribe(
                path,
                language=language,
                beam_size=1,
                vad_filter=True,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
            return {
                "text": text,
                "language": info.language,
                "durationMs": int(info.duration * 1000),
            }
        finally:
            os.unlink(path)

    return await run_in_threadpool(run)
