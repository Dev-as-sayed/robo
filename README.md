# Robo — Student AI Assistant

A voice-first study assistant: an ESP32-S3 desk device, an Expo mobile app, and a Node.js
backend that runs the voice pipeline and LangGraph agent.

## Repository layout

```
apps/server       Express API, Prisma, LangGraph agent, device WebSocket gateway
apps/mobile       Expo app: auth, onboarding, streaming chat, Today/Tasks/Reminders/Schedule/Exams/Documents/Contacts/Activity/Insights/Settings, device pairing
packages/shared   Zod schemas, JWT helpers, device/store services shared by the server
services/voice    faster-whisper (STT) and Piper (TTS) HTTP services
firmware          ESP-IDF firmware (to be added)
docs              Protocol and AI design notes
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker with Docker Compose

## Local setup

```bash
cp .env.example .env
docker compose up -d db redis qdrant minio ollama

pnpm --dir apps/server install
pnpm --dir apps/server db:generate
pnpm --dir apps/server db:migrate
pnpm --dir apps/server dev
```

The API listens on `http://localhost:3000`; health check: `GET /health`. The device WebSocket
endpoint is `ws://localhost:3000/ws/device`.

`@robo/shared` is installed into `apps/server` as a **copy**, not a live symlink. After editing
anything under `packages/shared/src`, run `pnpm --dir apps/server install` again — otherwise the
server typechecks, tests and serves the previous snapshot and the change appears to do nothing.

At least one LLM provider key (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`) or a
running Ollama instance is required for chat. Document search also needs Ollama embeddings and
Qdrant.

For voice, start the local speech services and set the URLs in `.env`:

```bash
docker compose up -d stt tts
# STT_SERVICE_URL=http://localhost:8001
# TTS_SERVICE_URL=http://localhost:8002
```

The first start downloads the Whisper model and the Piper voice; see
[`services/voice/README.md`](services/voice/README.md).

The mobile app talks to the API through `EXPO_PUBLIC_API_URL`; on a physical device this must
be the LAN address of the machine running the server.

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000/api/v1 pnpm --dir apps/mobile start
```

## Reminders and jobs

Reminders carry a `nextAt` fire slot instead of living in a job queue. An in-process tick
(`REMINDER_TICK_INTERVAL_MS`, default 15 s; `REMINDER_SCHEDULER_ENABLED=false` turns it off)
claims rows whose slot has passed, moves each one to its next slot or completes it, and pushes
`reminder.fire` to that user's connected device sockets. Claiming is atomic per row, so two
server processes against one database do not double-fire, and a restart loses nothing because
the slots live in the rows.

- Recurrence uses a dependency-free subset of RFC 5545 (`FREQ=DAILY|WEEKLY|MONTHLY`, `INTERVAL`, `BYDAY`, `COUNT`, `UNTIL`). Anything outside the subset is refused so the reminder falls back to a single fire. Rules are anchored to the user's timezone with a **fixed** offset, so a rule that crosses a DST transition can land an hour off.
- Snoozing delays a reminder (one-offs by `minutes`, recurring rules skip the due occurrence) rather than parking it in a `snoozed` status that never fires again.
- Mobile push is storage only: `POST/GET/DELETE /api/v1/users/me/push-token` keeps tokens, but no sender is configured, so a `phone`/`push` channel is reported as not delivered in the fire log.
- A fire while no device is connected is dropped, not queued.
- `apps/server/prisma/migrations/20261022120000_reminder_next_fire_push_tokens` is written by hand and **not applied**. Run `pnpm --dir apps/server db:migrate` before using the scheduler; until then `nextAt`, `lastFiredAt` and `PushToken` do not exist in the database.

## Mobile app

`app/(app)/` is a tab shell (Today, Chat, Tasks, Insights, Settings) with the remaining
screens pushed as detail routes: devices, reminders, schedule, exams, documents, contacts
and activity. Every screen reads and writes through the RTK Query slices in `src/api/`,
which unwrap the `{ success, code, data }` envelope and refresh tokens once on a 401.

Verified statically only — typecheck, lint and a Metro Android bundle. Nothing here has
been run on a device, so these are server-side limits of the current build, not app bugs:

- Quiz questions are placeholders (`generateQuiz` inserts "Question N" with a fixed answer), so there is no quiz screen yet.
- Document upload records metadata only: no object storage write and no chunk indexing, so `status` never advances past `uploaded` and `chunkCount` stays 0.
- Four of the six insights metrics are stubs (`streakDays` hardcoded; `totalStudyHours`, `completedTasks` and `upcomingExams` count fields nothing writes).
- `POST /exams/:id/plan` ignores `dailyLimit`, and plan approval addresses the **plan** id, not the exam id.
- Voice replies, push notifications, QR/BLE provisioning and phone-book import need a dev build. Push tokens have endpoints, but there is no push sender behind them yet.

## Checks

```bash
pnpm --dir apps/server install    # re-links packages/shared into apps/server; run it after editing shared
pnpm --dir apps/server typecheck
pnpm --dir apps/server test
pnpm --dir apps/server lint
pnpm --dir apps/mobile typecheck
pnpm --dir apps/mobile lint
```

## Documentation

- [`stack.md`](stack.md) — technology decisions
- [`functions.md`](functions.md) — functional requirements
- [`todo.md`](todo.md) — delivery plan and progress
- [`docs/ai-tools.md`](docs/ai-tools.md) — agent tools and AI setup
- [`docs/device-gateway.md`](docs/device-gateway.md) — device WebSocket protocol and audio turns
- [`docs/voice-pipeline.md`](docs/voice-pipeline.md) — STT/TTS contracts and voice turn behavior
- [`services/voice/README.md`](services/voice/README.md) — local faster-whisper and Piper services
