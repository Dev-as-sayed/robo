# Voice services

Two small HTTP services used by the device voice pipeline. Both speak raw audio over the wire and
run as normal Python processes — no container runtime is required.

| Service | Port | Engine | Input | Output |
| --- | --- | --- | --- | --- |
| `stt` | 8001 | faster-whisper | PCM16, 16 kHz mono | JSON transcript |
| `tts` | 8002 | Piper | JSON text | Raw PCM16, mono |

## Prerequisites

- Python 3.11 or 3.12, or [`uv`](https://docs.astral.sh/uv/)
- Network access on first start for the Whisper model and Piper voice download

The helper scripts prefer `uv` when it is available and use a managed Python 3.11 virtualenv.
Without `uv`, install Python 3.11/3.12 and retry.

## Quick start

From the repository root:

```bash
scripts/services/stt.sh
scripts/services/tts.sh
```

Or start both with Redis and MinIO:

```bash
scripts/services/start-all.sh
scripts/services/status.sh
scripts/services/stop-all.sh
```

Then point the server at them:

```dotenv
STT_SERVICE_URL=http://localhost:8001
TTS_SERVICE_URL=http://localhost:8002
TTS_VOICE=en_US-lessac-medium
```

The first start creates `services/voice/*/.venv`, installs the requirements and caches models under
`.local/`. `WHISPER_MODEL` defaults to `base` on CPU with `int8`. Use `small` or `distil-small.en`
for better accuracy, or set `WHISPER_DEVICE=cuda` when a GPU is available.

The TTS script downloads every voice listed in `TTS_VOICES` (default
`en_US-lessac-medium,hi_IN-pratham-medium`) into `TTS_DATA_DIR` (default `.local/tts-models`) and
selects voices per request. The Piper CLI comes
from the `piper-tts` Python package installed in the service virtualenv.

Set `HF_ENDPOINT` (for example `https://hf-mirror.com`) and `HF_HUB_DISABLE_XET=1` when the
official Hub is unreachable or its Xet backend fails; the example env files already contain both.
`PIPER_VOICE_BASE_URL` overrides the Piper voice source; otherwise the downloader tries
`HF_ENDPOINT`, then the official Hub and its mirror. The first download can take a few minutes and
needs network access.

## Health checks

```bash
curl http://localhost:8001/health
curl http://localhost:8002/health
```

## Verified locally

Both services respond on the configured ports:

```bash
curl http://localhost:8001/health
curl http://localhost:8002/health
curl -X POST http://localhost:8002/synthesize \
  -H 'content-type: application/json' \
  -d '{"text":"Hello, I am Robo.","format":"pcm16"}' --output hello.pcm
```

A 16 kHz PCM16 fixture (`apps/server/tests/fixtures/speech.wav`, header stripped) transcribes to
`{"text":"Hello, what class is next?","language":"en","durationMs":1961}`.

## STT contract

`POST /transcribe` with a raw audio body.

Headers: `X-Audio-Codec: pcm16`, `X-Sample-Rate`, optional `X-Language`, `X-Turn-Id`.

```json
{ "text": "what class is next?", "language": "en", "durationMs": 480 }
```

The bundled service accepts PCM16 only. Opus turns need a local service that decodes Opus, or a
device that sends PCM16.

## TTS contract

`POST /synthesize` with JSON:

```json
{ "text": "Your next class is Biology.", "voice": "en_US-lessac-medium", "format": "pcm16" }
```

The response is raw PCM16 with `X-Audio-Codec` and `X-Sample-Rate` headers. Piper voices are
selected with `voice`; the server resolves it from `TTS_VOICE_MAP` by language, then falls back to
`TTS_VOICE`. Add each mapped voice to `TTS_VOICES` so the script downloads it.

## Changing the TTS voice

```bash
TTS_VOICES=en_US-amy-medium TTS_VOICE=en_US-amy-medium scripts/services/tts.sh
```

Use any voice id from the [Piper voices list](https://huggingface.co/rhasspy/piper-voices). The id
must follow `locale-name-quality`, for example `en_US-lessac-medium`.
