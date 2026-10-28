# Device WebSocket gateway

The ESP32-S3 firmware connects to `wss://<host>/ws/device`. The gateway is implemented in
`apps/server/src/modules/realtime/gateway.ts` and the wire protocol lives in
`packages/shared/src/realtime/index.ts`.

## Connection lifecycle

1. The device opens the WebSocket and sends `hello` within `DEVICE_HELLO_TIMEOUT_MS` (10 s).
2. The server hashes the presented token and compares it with `Device.tokenHash`. Revoked devices
   are rejected. A successful hello marks the device `ONLINE`, stores the firmware version/locale,
   updates `lastSeenAt`, and sends `state: idle`.
3. The server pings every `DEVICE_HEARTBEAT_INTERVAL_MS` (30 s). A connection that misses one pong
   is terminated. Device `heartbeat` messages are also accepted and refresh presence.
4. On disconnect the device is marked `OFFLINE` unless it was revoked. `GET /api/v1/devices`
   exposes the current presence and `lastSeenAt`.

Close codes: `4001` authentication/hello failure, `1011` internal gateway error.

## Device messages

All control messages are JSON text frames. Audio chunks are binary frames.

| Type | Payload | Notes |
| --- | --- | --- |
| `hello` | `deviceId`, `token`, `protocolVersion`, `firmwareVersion?`, `locale?` | Must be the first message |
| `audio.start` | `turnId`, `codec` (`pcm16`/`opus`), `sampleRate` | Cancels an in-flight turn and stops the server-side voice reply (barge-in) |
| binary frame | raw audio bytes | Only valid between `audio.start` and `audio.end` |
| `audio.end` | `turnId` | Must match the active turn |
| `heartbeat` | optional `at` | Refreshes presence |
| `button` | `name` (`talk`/`mute`/`study`), `state` | Logged for now; firmware state handling is later |
| `status` | `wifiRssi?`, `uptimeMs?`, `battery?` | Logged telemetry |

## Server messages

| Type | Payload | Notes |
| --- | --- | --- |
| `state` | `idle`, `listening`, `thinking`, `speaking`, `error` | Drives LED/display states |
| `error` | `code`, `message`, optional `turnId` | Spoken/displayed fallback |
| `transcript` | `turnId`, `text`, `isFinal?` | Ready for the STT stage |
| `tts.start` / binary / `tts.end` | `turnId`, codec, sample rate | Ready for the TTS stage |
| `reminder.fire` | `reminderId`, `text`, `dueAt`, `firedAt`, `rrule?` | Server-initiated; sent by the scheduler tick, not tied to a turn |
| `display` | `kind` (`text`/`timer`/`alarm`/`study`/`exam`), `title`, `body?`, `durationSeconds?`, `dueAt?` | Server-initiated card for the speaker display |
| `speak` | `text` | Server-initiated short announcement; does not start a voice turn |

## Server-initiated messages

`DeviceGateway.notifyUser(userId, message)` fans a message out to every authenticated
socket owned by that user and returns how many took it. The reminder scheduler
(`apps/server/src/modules/reminders/scheduler.ts`) uses it on a
`REMINDER_TICK_INTERVAL_MS` tick (15 s by default) after claiming due rows.

When no socket is connected, the reminder notifier stores the fire in
`DevicePendingEvent` with a `PENDING` delivery row. Class alerts and todo deadline
warnings use the same queue. After a successful `hello`, the gateway calls
`onDeviceReady(userId, send)`, which claims up to 20 pending events and sends them in
order; delivered reminder rows are marked `SENT`.

Claiming happens in the database: a row only fires when its own `nextAt` can still be
matched, so two server processes cannot fire the same reminder twice. A device that is
offline simply does not take the message — the fire is lost, not queued, and the
reminder is already marked delivered (`lastFiredAt`, next slot computed). Queueing fires
for offline devices is still open work.

## Audio turn limits

- One active turn per device. A new `audio.start` drops the previous buffer.
- A turn that is not ended within `DEVICE_AUDIO_TURN_TIMEOUT_MS` (15 s) is aborted with
  `AUDIO_TIMEOUT`.
- A turn larger than `DEVICE_AUDIO_MAX_BYTES` (2 MiB) is aborted with `AUDIO_TOO_LARGE`.
- Buffers are held only in memory for the turn. They are handed to the voice pipeline and dropped;
  raw audio is not written to the database or object storage.

## End-of-speech detection

PCM16 turns run through Silero VAD as frames arrive. After `DEVICE_VAD_SILENCE_MS` (800 ms) of
silence, the server finalizes the turn and sends `state: thinking` without waiting for `audio.end`.
Silence must last at least `DEVICE_VAD_MIN_SPEECH_MS` (250 ms) to count as speech. Opus turns skip
VAD and must end with `audio.end` or the turn timeout.

Late binary frames that arrive just after a VAD or `audio.end` finalization are ignored for 2 s
instead of producing `AUDIO_TURN_NOT_STARTED`; a repeated `audio.end` for the completed turn is
also ignored. Starting a new turn clears that grace window.

VAD loads the bundled Silero ONNX model on server startup. If the model or `onnxruntime-node`
cannot load, the server logs a warning and falls back to `audio.end`/timeout. Set
`DEVICE_VAD_ENABLED=false` to skip loading it.

`onAudioTurn(turn, session)` is wired to the voice pipeline (STT -> agent -> sentence TTS). See
[`voice-pipeline.md`](voice-pipeline.md) for the service contracts and failure behavior. If a
server embeds the gateway without an `onAudioTurn` handler, it replies with
`VOICE_PIPELINE_NOT_READY` and returns the device to `idle`.

## Configuration

```dotenv
DEVICE_HELLO_TIMEOUT_MS=10000
DEVICE_HEARTBEAT_INTERVAL_MS=30000
DEVICE_AUDIO_TURN_TIMEOUT_MS=15000
DEVICE_AUDIO_MAX_BYTES=2097152
DEVICE_VAD_ENABLED=true
DEVICE_VAD_SILENCE_MS=800
DEVICE_VAD_MIN_SPEECH_MS=250
# DEVICE_VAD_MODEL_PATH=/path/to/silero_vad.onnx
```

## Tests

`apps/server/tests/realtime-gateway.test.ts` covers authentication, hello requirements, audio
buffering, TTS session output, turn timeout, size limits, heartbeat liveness, barge-in cancellation
and VAD finalization. `apps/server/tests/vad.test.ts` runs the bundled Silero model against silence
and a speech fixture:

```bash
pnpm --dir apps/server test
```
