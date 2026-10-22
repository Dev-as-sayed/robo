# Voice turn pipeline

The device gateway hands each completed audio turn to `createVoiceTurnHandler`
(`apps/server/src/modules/voice/pipeline.ts`). The pipeline runs:

```
audio turn
  -> STT (local faster-whisper, Groq Whisper fallback)
  -> transcript message to device
  -> LangGraph agent (device conversation)
  -> sentence splitter
  -> Piper TTS per sentence
  -> tts.start / binary PCM chunks / tts.end
```

The device is moved through `thinking`, `speaking`, and `idle` states by the gateway and pipeline.
Raw audio stays in memory only for the duration of the turn; it is never written to PostgreSQL,
Redis, MinIO, or Qdrant.

When the device sends a new `audio.start` while a reply is being generated, the gateway marks the
old turn as cancelled. The pipeline checks `session.isTurnActive(turnId)` before STT, before the
agent reply, and between TTS chunks, then stops without sending an error or resetting the new
turn's state.

PCM16 turns end automatically after 800 ms of silence detected by Silero VAD, or earlier if the
device sends `audio.end`. Opus turns still require `audio.end` or the turn timeout.

## STT service contract

The local service is selected with `STT_SERVICE_URL`:

```http
POST {STT_SERVICE_URL}/transcribe
Content-Type: application/octet-stream
X-Audio-Codec: pcm16 | opus
X-Sample-Rate: 16000
X-Language: en
X-Turn-Id: <turn id>

<raw audio bytes>
```

It returns JSON:

```json
{ "text": "what class is next?", "language": "en", "durationMs": 480 }
```

When the local service is unavailable or returns a non-2xx response, the server falls back to Groq
Whisper (`GROQ_API_KEY`, default model `whisper-large-v3-turbo`). Groq only receives PCM16 audio,
wrapped in a WAV container. Opus turns require a local service that decodes Opus; the bundled
faster-whisper service accepts PCM16 only.

The Docker service is in `services/voice/stt`; see [`services/voice/README.md`](../services/voice/README.md).

## TTS service contract

The Piper service is selected with `TTS_SERVICE_URL`:

```http
POST {TTS_SERVICE_URL}/synthesize
Content-Type: application/json

{ "text": "Your next class is Biology.", "voice": "en_US-lessac-medium", "language": "en", "sampleRate": 16000, "format": "pcm16" }
```

It returns raw audio bytes. Optional headers:

| Header | Meaning |
| --- | --- |
| `X-Audio-Codec` | `pcm16` (default) or `opus` |
| `X-Sample-Rate` | Output sample rate; defaults to `TTS_SAMPLE_RATE` |
| `X-Duration-Ms` | Exact duration, used when the codec is Opus |

PCM16 replies are split into 4 KiB binary WebSocket frames. Opus replies are sent as one frame.

The Docker service is in `services/voice/tts`; voices are downloaded on first start and selected
with `TTS_VOICE` or the request `voice` field.

## Failure behavior

| Failure | Result |
| --- | --- |
| Empty transcript | Spoken fallback: "Sorry, I did not catch that. Please try again." |
| STT providers fail | Spoken STT fallback |
| Agent/provider fails | Spoken fallback: "Sorry, I could not reach your assistant. Please try again." |
| TTS fails | Bundled English fallback speech (`assets/fallback-en.pcm`) |
| Bundled fallback fails | `error` message (`INTERNAL_ERROR`); the device returns to `idle` |

Stage timings (`sttMs`, `agentMs`, `firstTtsMs`, `ttsMs`, `totalMs`) and cumulative `vadMs` are
logged for every completed turn. First-token timing awaits streaming LLM output.

When the TTS service fails, the server sends the cached 22.05 kHz English PCM prompt in
`apps/server/assets/fallback-en.pcm`. It is loaded once per process and sent through the normal
`tts.start` / binary frames / `tts.end` path.

## Conversation continuity

The pipeline keeps a bounded in-memory map of device user to conversation ID. Consecutive turns in
one server process share context; a server restart starts a new device conversation. A deleted
conversation is retried once as a new conversation.

## Configuration

```dotenv
STT_SERVICE_URL=http://localhost:8001
STT_SERVICE_TIMEOUT_MS=30000
STT_LANGUAGE=en
GROQ_STT_MODEL=whisper-large-v3-turbo
TTS_SERVICE_URL=http://localhost:8002
TTS_SERVICE_TIMEOUT_MS=15000
TTS_VOICE=en_US-lessac-medium
TTS_VOICE_MAP=
TTS_SAMPLE_RATE=16000
```

`TTS_VOICE_MAP` maps a language to a Piper voice, for example
`en:en_US-lessac-medium,hi:hi_IN-pratham-medium`. Lookup uses the full locale first, then the
primary subtag; `TTS_VOICE` is the fallback. The Piper service must already have the selected voice
installed at `/models/<voice>.onnx`.

`GROQ_API_KEY` is the existing shared key. If neither `STT_SERVICE_URL` nor `GROQ_API_KEY` is set,
voice turns speak the STT fallback. Without `TTS_SERVICE_URL`, voice turns return an error after
transcription.

## Still missing

- Streaming LLM tokens through the sentence splitter (the agent currently returns a full reply).
- Per-user TTS voice selection and the second launch language.

## Tests

```bash
pnpm --dir apps/server test
```

Coverage includes the sentence splitter, STT provider fallback, TTS contracts, and the full pipeline
with mocked providers.
