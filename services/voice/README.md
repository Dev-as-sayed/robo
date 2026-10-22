# Voice services

Two small HTTP services used by the device voice pipeline. Both speak raw audio over the wire and
are built by `docker-compose.yml` at the repository root.

| Service | Port | Engine | Input | Output |
| --- | --- | --- | --- | --- |
| `stt` | 8001 | faster-whisper | PCM16, 16 kHz mono | JSON transcript |
| `tts` | 8002 | Piper | JSON text | Raw PCM16, mono |

## Quick start

```bash
docker compose up -d stt tts
```

Then point the server at them:

```dotenv
STT_SERVICE_URL=http://localhost:8001
TTS_SERVICE_URL=http://localhost:8002
TTS_VOICE=en_US-lessac-medium
```

`WHISPER_MODEL` defaults to `base` on CPU with `int8`. Use `small` or `distil-small.en` for better
accuracy, or set `WHISPER_DEVICE=cuda` when a GPU is available.

The TTS image downloads the selected Piper voice from `rhasspy/piper-voices` on first start and
stores it in the `tts_models` volume. The STT model is downloaded from Hugging Face into the
`stt_models` volume on the first transcription.

Downloads use `HF_ENDPOINT` (default `https://hf-mirror.com`) because the Xet backend is disabled
with `HF_HUB_DISABLE_XET=1`. The Piper voice downloader tries the official Hub first, then
`PIPER_VOICE_BASE_URL`; set both to `https://huggingface.co` if the mirror is not needed. The first
download can take a few minutes and needs network access.

## Health checks

```bash
curl http://localhost:8001/health
curl http://localhost:8002/health
```

## Verified locally

Both images build with Podman and respond on the compose network:

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
selected with `voice`; the server passes `TTS_VOICE` by default.

## Changing the TTS voice

```bash
TTS_VOICE=en_US-amy-medium docker compose up -d tts
```

Use any voice id from the [Piper voices list](https://huggingface.co/rhasspy/piper-voices). The id
must follow `locale-name-quality`, for example `en_US-lessac-medium`.
