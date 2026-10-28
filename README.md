# Robo — Student AI Assistant

A voice-first study assistant: an ESP32-S3 desk device, an Expo mobile app, and a Node.js
backend that runs the voice pipeline and LangGraph agent.

## Repository layout

```
apps/server       Express API, Prisma, LangGraph agent, device/app WebSockets, jobs and scripts
apps/mobile       Expo app: auth, chat, tasks, reminders, schedule, exams, documents, quizzes,
                  study, insights, contacts, approvals, memories, class notes, vision, devices
packages/shared   Zod schemas, JWT helpers, consent/data-export helpers and store services
services/voice    faster-whisper (STT) and Piper (TTS) HTTP services
firmware          ESP-IDF firmware (to be added)
deploy            Caddy reverse-proxy configuration
docs              Design, privacy, security, evaluation, release and operations notes
```

## Prerequisites

- Node.js 20+
- pnpm 12+
- Docker with Docker Compose

## Local setup

```bash
cp .env.example .env
cp apps/server/.env.example apps/server/.env
cp apps/mobile/.env.example apps/mobile/.env
git config core.hooksPath .githooks
docker compose up -d db redis qdrant minio minio-init ollama ollama-pull

pnpm --dir apps/server install
pnpm --dir apps/server db:generate
pnpm --dir apps/server db:migrate
pnpm --dir apps/server dev
```

`minio-init` creates the `S3_BUCKET` once MinIO is ready. `ollama-pull` downloads
`OLLAMA_CHAT_MODEL` and `OLLAMA_EMBEDDING_MODEL` once the Ollama API is ready, then exits.
Document uploads require the `S3_*` variables in `apps/server/.env`; storage keys stay on the
server and the API returns short-lived signed download URLs. The commit hook lints the
server/mobile app and typechecks the server when shared code changes.

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

- Recurrence uses a subset of RFC 5545 (`FREQ=DAILY|WEEKLY|MONTHLY`, `INTERVAL`, `BYDAY`, `COUNT`, `UNTIL`). Anything outside the subset is refused so the reminder falls back to a single fire. Rules are rebuilt from local wall-clock parts with Luxon when a timezone is available, so they keep the same local time across DST transitions.
- `DailyStatsJob` runs hourly and upserts the previous local day per user; the analytics summary combines those aggregates with live counts for today.
- Snoozing delays a reminder (one-offs by `minutes`, recurring rules skip the due occurrence) rather than parking it in a `snoozed` status that never fires again.
- Expo push is wired through `src/modules/reminders/expo-push.ts`; tokens are registered from the app and a `phone`/`push` channel is recorded as `SENT`, `NO_PUSH_TOKEN` or `PUSH_REJECTED` in the delivery log.
- A fire while no device is connected is queued as a pending device event and delivered on reconnect; the delivery record shows `PENDING` with `QUEUED_FOR_RECONNECT`.
- The reminder migrations created by the delivery work are applied by `pnpm --dir apps/server db:migrate`.

## Mobile app

`app/(app)/` is a tab shell (Today, Chat, Tasks, Insights, Settings) with the remaining
screens pushed as detail routes: devices, reminders, schedule, exams, documents, contacts
and activity. Every screen reads and writes through the RTK Query slices in `src/api/`,
which unwrap the `{ success, code, data }` envelope and refresh tokens once on a 401.

Verified statically — typecheck, lint, server tests and a Metro Android bundle. Runtime
verification still needs an EAS development build and, for some screens, hardware:

- Quizzes are generated through the structured model and have a runner, history and review UI.
- Documents upload to MinIO/S3, parse (PDF/DOCX/PPTX/text/images), OCR, chunk, embed and index; the screen exposes retry and re-index actions.
- Insights renders real task/session/quiz data and a 90-day streak window; subject trends are returned by the API but not charted.
- `POST /exams/:id/plan` generates a plan, and approval creates tasks plus a daily reminder.
- Expo push registration, tap routing and the sender are implemented; runtime delivery needs a configured EAS project ID.
- Voice replies, QR/BLE provisioning and phone-book import need a dev build; wake-word voice and the device timer need firmware.

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
- [`docs/user-guide.md`](docs/user-guide.md) — end-user guide for the mobile app
- [`docs/support-faq.md`](docs/support-faq.md) — in-app FAQ, support channel and triage workflow
- [`docs/device-quick-start.md`](docs/device-quick-start.md) — draft device setup card
- [`docs/ai-evaluation.md`](docs/ai-evaluation.md) — AI regression, retrieval and embedding evaluation
- [`docs/production-operations.md`](docs/production-operations.md) — deploy, TLS, backup, restore and incident runbook
- [`docs/mobile-release.md`](docs/mobile-release.md) — EAS, store and release checklist
- [`docs/play-policy-review.md`](docs/play-policy-review.md) — Google Play permissions, data safety and launch blockers
- [`docs/privacy-notice.md`](docs/privacy-notice.md) and [`docs/terms-of-service.md`](docs/terms-of-service.md) — draft legal documents
- [`docs/consent.md`](docs/consent.md) — consent records and API
- [`docs/threat-model.md`](docs/threat-model.md) and [`docs/secure-boot.md`](docs/secure-boot.md) — security design
- [`docs/providers.md`](docs/providers.md) — provider limits and data terms
- [`services/voice/README.md`](services/voice/README.md) — local faster-whisper and Piper services
