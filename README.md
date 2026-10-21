# Robo — Student AI Assistant

A voice-first study assistant: an ESP32-S3 desk device, an Expo mobile app, and a Node.js
backend that runs the voice pipeline and LangGraph agent.

## Repository layout

```
apps/server       Express API, Prisma, LangGraph agent, device WebSocket gateway
apps/mobile       Expo app (scaffold)
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

## Checks

```bash
pnpm --dir apps/server typecheck
pnpm --dir apps/server test
pnpm --dir apps/server lint
```

## Documentation

- [`stack.md`](stack.md) — technology decisions
- [`functions.md`](functions.md) — functional requirements
- [`todo.md`](todo.md) — delivery plan and progress
- [`docs/ai-tools.md`](docs/ai-tools.md) — agent tools and AI setup
- [`docs/device-gateway.md`](docs/device-gateway.md) — device WebSocket protocol and audio turns
- [`docs/voice-pipeline.md`](docs/voice-pipeline.md) — STT/TTS contracts and voice turn behavior
- [`services/voice/README.md`](services/voice/README.md) — local faster-whisper and Piper services
