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

## Audio turn limits

- One active turn per device. A new `audio.start` drops the previous buffer.
- A turn that is not ended within `DEVICE_AUDIO_TURN_TIMEOUT_MS` (15 s) is aborted with
  `AUDIO_TIMEOUT`.
- A turn larger than `DEVICE_AUDIO_MAX_BYTES` (2 MiB) is aborted with `AUDIO_TOO_LARGE`.
- Buffers are held only in memory for the turn. They are handed to the voice pipeline and dropped;
  raw audio is not written to the database or object storage.

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
```

## Tests

`apps/server/tests/realtime-gateway.test.ts` covers authentication, hello requirements, audio
buffering, TTS session output, turn timeout, size limits and heartbeat liveness:

```bash
pnpm --dir apps/server test
```
