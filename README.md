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
- Voice replies, push notifications, QR/BLE provisioning and phone-book import need a dev build and endpoints that do not exist yet.

## Checks

```bash
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
