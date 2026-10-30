# Student AI Assistant — Project TODO

| Field          | Value                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Based on**   | `Student_Assistant_FRD_v2_Stack.md` and `stack.md`                                                                                                                                                      |
| **Created**    | 14 Oct 2026                                                                                                                                                                                             |
| **How to use** | Tick `[x]` when a task meets its Definition of Done. Requirement IDs in brackets point to the FRD. Estimates are in working days for one developer and are rough (±40%); re-estimate at sprint planning |
| **Legend**     | 🔴 critical path · 🟡 important · 🟢 optional · ⛓ depends on the task named · 📦 deliverable                                                                                                           |

---

## Progress Tracker

| Phase | Goal                                    | Est.       | Status                                                                                                                                                                                                                                     |
| ----- | --------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0    | Decisions, setup, hardware ordered      | 10–15 d    | Partial (root pnpm workspace now exists; decisions, accounts and hardware still pending)                                                                                                                                                   |
| R1    | Voice foundation                        | 30–40 d    | In progress (R1.3 gateway + voice pipeline stream agent tokens through sentence-level TTS; mobile auth/chat UI exists, but chat streaming is unverified on-device and device QR/BLE/Wi-Fi setup is missing — see [`report.md`](report.md)) |
| R2    | Productivity (MVP complete)             | 30–40 d    | In progress (R2 mobile screens and reminder delivery exist; push is code-complete but unverified on a development build, and Home/Schedule need completion fixes — see [`report.md`](report.md))                                           |
| R3    | Study Brain (documents, quizzes, plans) | 40–50 d    | In progress (documents, quizzes, exams and plans exist; plan approval is not reload-safe and chat citations are not individually tappable; parsing/embedding runtime still pending — see [`report.md`](report.md))                         |
| R4    | Communication (calls, messages)         | 25–30 d    | ◐ (contacts, contact picker, pending-action confirmations, app WebSocket push and LangGraph destructive-action confirmations done; device voice confirmation remains)                                                                      |
| R5    | Proactive (study mode, analytics)       | 35–40 d    | ◐ (insights, trends, nudges and the app study timer are done; the device timer remains firmware-blocked)                                                                                                                                   |
| R6    | Advanced (vision, sync)                 | Ongoing    | ☐                                                                                                                                                                                                                                          |
| X     | Cross-cutting: security, QA, launch     | Continuous | ☐                                                                                                                                                                                                                                          |

**Mobile audit (2026-10-30):** the app is not todo-complete. See [`report.md`](report.md) for evidence and the follow-ups below.

**Definition of Done (every task):** code reviewed · tests passing · Zod schemas / tool contracts documented · privacy impact checked · demonstrated on the real device or app where relevant.

---

## P0 — Decisions, Setup and Hardware (do first)

### P0.1 Decisions (answer the FRD open questions)

- [x] 🔴 Choose launch language(s) (drives STT, TTS, embeddings, wake word) — 1 d — English + Hindi voice are configured (Hindi is preview); the i18n foundation is in place and full UI translation remains post-launch
- [x] 🔴 Choose target age group (university only vs school → consent scope) — 0.5 d — university/18+ only for v1, so guardian consent is out of scope
- [x] 🟡 Decide whether an app-only mode (no device) is needed for early users — 0.5 d — no; the device is part of the product and the app is not a standalone launch mode
- [x] 🟡 Choose job queue: BullMQ (Redis) vs pg-boss — 0.5 d — the PostgreSQL-backed `nextAt` claim is the v1 queue; Redis/BullMQ is deferred until throughput requires it
- [x] 🟡 Choose UI kit: React Native Paper / Tamagui / NativeWind — 0.5 d — keep the existing custom React Native components and shared style layer; no new UI kit for v1
- [x] 🟡 Choose hosting: single VPS with native services vs managed services — 1 d — single VPS with native services (systemd + Caddy) for the beta; managed services only when load or compliance requires them
- [x] 🟡 Decide transcript/action-log retention period — 0.5 d — 90 days for transcripts/action logs; account data remains until deletion
- [x] 📦 Update the decision log in `stack.md` section 13 — recorded D1–D14 with accepted launch defaults

### P0.2 Hardware procurement

- [ ] 🔴 Buy 2 dev boards: ESP32-S3 with PSRAM (e.g., all-in-one box-style board) and 1 bare ESP32-S3 dev kit — 1 d
- [ ] 🔴 Buy I2S MEMS mics (INMP441 and a dual-mic option), MAX98357A amplifier, small speaker, TFT/OLED display, buttons, a hardware mute switch, LEDs — 1 d
- [ ] 🟡 Buy breadboard, wires, USB cables, a power supply, and a case material for the prototype — 0.5 d
- [ ] 🟡 Draft the bill of materials (BOM) with prices — 1 d

### P0.3 Accounts and keys

- [ ] 🔴 Create accounts and API keys: Google AI Studio (Gemini), Groq, OpenRouter — 0.5 d
- [ ] 🔴 Create Expo / EAS account; Google OAuth client for sign-in — 0.5 d
- [ ] 🟡 Create Sentry project; (later) Langfuse instance — 0.5 d
- [x] 🟡 Record current free-tier limits and data terms for each provider in a `docs/providers.md` — 1 d — `docs/providers.md` records the checked limits, env vars and data-handling notes for Gemini, Groq, OpenRouter, Ollama, Expo/EAS, Sentry, R2, MinIO, Qdrant and self-hosted PostgreSQL/Redis, and flags that the provider console is authoritative; actual account creation remains open

### P0.4 Repository and environment

- [x] 🔴 Create monorepo with pnpm workspaces: `apps/mobile`, `apps/server`, `packages/shared`, `firmware/` — 1 d — root `pnpm-workspace.yaml` covers `apps/*`, `packages/*` and `firmware/*`; CI installs, typechecks and lints the mobile app through the root workspace
- [x] 🔴 Configure TypeScript (strict), ESLint, Prettier, commit hooks — 0.5 d — strict TypeScript, ESLint and Prettier are configured; `.githooks/pre-commit` runs the relevant app lint/typecheck and is activated with `git config core.hooksPath .githooks`
- [x] 🔴 Native local services: PostgreSQL, Redis, Qdrant, MinIO — 1 d — `scripts/services/` starts Redis, MinIO (S3), STT and TTS natively; PostgreSQL, Qdrant and Ollama are installed and run by the operator
- [x] 🟡 Document native Ollama setup and model pulls — 0.5 d — `ollama serve` plus `ollama pull "$OLLAMA_CHAT_MODEL"` and `ollama pull "$OLLAMA_EMBEDDING_MODEL"`
- [x] 🔴 GitHub Actions: lint, test, build on every pull request — 1 d — server lint/typecheck/test/build, mobile typecheck/lint, Python compile and voice image builds; also AI/retrieval/embedding fixture validation, critical dependency audit, Dependabot and an API image build. Firmware remains empty
- [ ] 🟡 Provision the dev VPS, domain name and TLS (Caddy/Nginx + Let's Encrypt) — 1 d
- [ ] 🟡 Create project board (Backlog → Ready → In progress → Review → Done) and import this TODO — 0.5 d
- [x] 📦 `README.md` with setup steps; `.env.example` for each app — root `README.md`, root `.env.example`, `apps/server/.env.example` and `apps/mobile/.env.example` exist

### P0.5 Early de-risking spikes (time-boxed)

- [ ] 🔴 **Voice spike:** ESP32-S3 records 5 s of audio and plays it back over I2S — 3 d
- [ ] 🔴 **Wake-word spike:** run ESP-SR wake word on the board and measure false accepts/rejects — 3 d
- [ ] 🔴 **Latency spike:** audio → Whisper → Groq/Gemini → Piper on a laptop; record stage timings — 2 d
- [ ] 🟡 **Expo spike:** development build on an Android phone with BLE scan working — 2 d
- [ ] 📦 Spike report with go/no-go for each risk (R-04, R-05, R-08)

---

## R1 — Voice Foundation

**Exit criteria:** a student holds a voice conversation on the device; p75 round trip ≤ 3 s; pairing and Wi-Fi setup work from the app.

### R1.1 Shared package

- [x] 🔴 `packages/shared`: Zod schemas for auth, device, chat, WebSocket messages — 2 d
- [x] 🟡 Shared constants (error codes, message types) — 0.5 d

### R1.2 Backend API

- [x] 🔴 Express app skeleton: config, pino logging, error handler, request IDs, Zod validation middleware [API-01, API-06] — 2 d
- [x] 🔴 Prisma setup; models `User`, `Device`, `PushToken`, `Conversation`, `Message`; first migration [DAT-01, DAT-02] — 2 d — all listed models exist; the `PushToken` migration is still uncommitted
- [x] 🔴 Auth: register, login, refresh rotation, logout; argon2; JWT middleware [FR-ACC-01, DAT-04] — 3 d — refresh-token reuse revokes the user's token family; logout now also revokes a session by refresh token when the access token is expired
- [x] 🟡 Google sign-in endpoint — 1 d
- [x] 🔴 Device pairing: pairing code generation, `POST /devices/pair`, hashed device token [FR-ACC-02, FR-ACC-04] — 2 d
- [x] 🔴 User settings: language, time zone, quiet hours [FR-ACC-05] — 1 d
- [x] 🔴 Rate limiting (Redis store) and helmet/CORS [API-04] — 1 d — helmet and CORS are enabled; global/auth/pairing limiters use `HybridRateLimitStore`, which keeps counters in Redis when `REDIS_URL` is reachable and falls back to memory during a Redis outage. `rate-limit-store.test.ts` covers Redis, fallback and command failure
- [x] 🟡 OpenAPI generation from Zod [API-05] — 1 d — `getOpenApiDocument` converts the shared Zod schemas into OpenAPI 3 components, publishes `/openapi.json`, and `pnpm openapi:generate` writes `docs/openapi.json`. `openapi.test.ts` checks generated paths and schemas
- [x] 🔴 Ownership-isolation test helper (user A cannot read user B) [API-02, NFR-07] — 1 d — `apps/server/tests/helpers/user-isolation.ts` builds two authenticated users plus private fixtures; `ownership-isolation.test.ts` proves user B cannot read, complete or delete user A's quiz attempts, class notes or memories, while each owner can read their own data

### R1.3 Device gateway and voice pipeline

- [x] 🔴 `ws` server at `/ws/device`: `hello` authentication, presence, heartbeat 30 s [GW-01, GW-03, GW-04] — 3 d
- [x] 🔴 Audio turn handling: `audio.start`, binary frames, `audio.end`, timeout — 2 d
- [x] 🔴 Silero VAD integration for end-of-speech detection [VP-01] — 2 d
- [x] 🔴 STT service: faster-whisper (native Python service) with Groq Whisper fallback [VP-02] — `scripts/services/stt.sh` builds the venv and serves the HTTP API; real 16 kHz PCM fixture transcribed and Groq fallback covered by tests
- [x] 🔴 TTS service: Piper (native Python service), per-language voice selection, chunked output [VP-04, VP-08] — `scripts/services/tts.sh` builds the venv, downloads voices and serves the HTTP API; PCM synthesis verified, `TTS_VOICE_MAP` selects a voice by language
- [x] 🔴 Sentence splitter: stream LLM tokens → sentences → TTS → device [FR-VOI-06] — 2 d — the voice pipeline now consumes `streamChatMessage` tokens through `SentenceSplitter`, queues completed sentences for synthesis while the agent is still streaming, aborts on barge-in, and caps spoken output at two sentences / 320 characters. Covered by new pipeline tests.
- [x] 🟡 Stage timing metrics (VAD, STT, first token, TTS start) [VP-06] — VAD/STT/agent/first-token/first-audio/TTS timings are logged per turn; the first token is recorded from the streamed token callback
- [x] 🔴 Delete raw audio after transcription [VP-07] — 0.5 d
- [x] 🔴 Fallback speech messages for errors/offline [FR-VOI-07] — STT/agent messages and cached English PCM when Piper fails

### R1.4 AI basics

- [x] 🔴 LLM router v0: `getModel(task)` with Groq (voice) and Gemini (general), config-driven [LLM-01, LLM-03] — `getChatModel` with provider chains and fallbacks
- [x] 🔴 LangGraph basic agent (no tools yet) with PostgreSQL checkpointer [AGT-03] — tool-using ReAct agent with Postgres checkpointer
- [x] 🔴 System prompt with name, locale, time zone, current time [AGT-02] — text and agent prompts built per request
- [x] 🔴 `POST /chat/messages` with streaming response [FR-AI-01, API-11] — SSE at `POST /chat/messages/stream` with token/done/error events
- [x] 🟡 Short-answer mode for voice [FR-VOI-08 groundwork] — `voiceText` caps speech to two sentences / 320 characters

### R1.5 Firmware (ESP32-S3)

- [ ] 🔴 ESP-IDF project, partition table with two OTA slots (prepare for R2), NVS settings [FW-01] — 2 d
- [ ] 🔴 BLE Wi-Fi provisioning with `wifi_provisioning` [FW-02] — 3 d
- [ ] 🔴 Wi-Fi + WebSocket client with reconnect/backoff and watchdog [FW-12, FR-DEV-01] — 3 d
- [ ] 🔴 I2S capture with ESP-SR AFE and wake word [FW-03] — 5 d
- [ ] 🔴 Audio streaming to server until end-of-speech/timeout [FW-04] — 3 d
- [ ] 🔴 TTS playback with buffering and stop on interrupt [FW-05] — 3 d
- [ ] 🔴 LED/display states from `state` messages [FW-06, FR-VOI-03] — 2 d
- [ ] 🔴 Hardware mute switch + indicator; ensure no audio when muted [FW-07, FR-VOI-04] — 1 d
- [ ] 🔴 Secure token storage in NVS; factory-reset by button hold [FW-11, FW-13] — 1 d

### R1.6 Mobile app

- [ ] 🔴 Expo project with Expo Router, TypeScript, EAS development build [APP-20] — scaffold, router, SDK 54 and screens are in place; EAS project `@amsayed231/robo` is linked, but no development build or signing credentials exist yet
- [x] 🔴 Redux Toolkit store + RTK Query API slice with token refresh [APP-21] — `src/store.ts`, `src/api/base-query.ts` (single-flight refresh on 401; terminal refresh failures clear user/API/chat state, transient failures preserve tokens and the cached profile, refresh is timeout-bounded, and a sign-out guard prevents an in-flight refresh from resurrecting the session); `auth-api`/`chat-api` slices
- [x] 🔴 Secure token storage (`expo-secure-store`) [APP-22] — `src/auth/tokens.ts`, localStorage fallback on web
- [x] 🔴 Auth and onboarding screens (language, time zone) [APP-01] — `app/sign-in.tsx`, `app/sign-up.tsx`, `app/onboarding.tsx`
- [x] ⏭ Device setup: QR scan, BLE scan, Wi-Fi provisioning, status [APP-02, FR-ACC-02/03] — **Descoped for v1 (2026-10-30):** pairing code, device list/status, rename, revoke and factory reset remain in `app/(app)/devices.tsx`; QR scan, BLE/Wi-Fi provisioning and the `robo://pair` route are not shipping in mobile v1
- [ ] 🔴 Chat screen with streaming text [APP-04] — SSE client and chat UI are built, but on-device incremental delivery is unverified; stop/error races, no request timeout and history lost after restart remain. Voice-note input is descoped for v1
- [x] 🟡 Tab navigation shell [APP-03] — `app/(app)/_layout.tsx` is a `Tabs` navigator (Today / Chat / Tasks / Insights / Settings) with the detail screens registered as `href: null` routes, guarded by the auth redirect
- [x] 🟡 Permission request helper with explanations [APP-26] — 1 d — `src/permissions.ts` provides `ensurePermissionWithExplanation`, which checks current status, shows a rationale before the OS dialog, handles `canAskAgain=false` by offering Open Settings, and is now used for push/local notifications and opening the contact picker

### R1.7 Quality and release

- [ ] 🔴 End-to-end voice test script (wake → question → answer) with latency report — 2 d
- [x] 🟡 Sentry in app and server — 1 d — optional `SENTRY_DSN` initialises `@sentry/node` with header scrubbing and Express error capture; the mobile app initialises `@sentry/react-native` from `EXPO_PUBLIC_SENTRY_DSN` with PII disabled. No Sentry project/DSN was created here
- [ ] 📦 **Demo:** hold a voice conversation on the device; pair from the phone

---

## R2 — Productivity (MVP complete)

**Exit criteria:** ≥ 95% of scripted productivity commands succeed; reminders fire on time (±30 s); OTA works.

### R2.1 Data models and API

- [x] 🔴 Prisma models: `Subject`, `Topic`, `ScheduleEntry`, `ScheduleException`, `Todo`, `Reminder`, `Exam`, `ActionLog` — 2 d — all listed models exist; `Subject`/`Topic` are in the `20261023190000_subjects_topics` migration
- [x] 🔴 CRUD: subjects, todos, reminders (+ snooze), schedule (+ exceptions), exams [FR-PRD-01/02, FR-CLS-01, FR-EXM-01] — 6 d — `/subjects` supports subject CRUD and nested topic create/update/delete; todos, reminders, schedule entries/exceptions and exams already had routes. Contacts now also have `PATCH /contacts/:id`
- [x] 🔴 Time handling: UTC storage, `luxon`, `rrule` utilities with tests across DST [FR-PRD-08, DAT-03] — 3 d — `rrule.ts` now rebuilds wall-clock occurrences with Luxon when a timezone is supplied, so daily/weekly/monthly rules keep their local time across spring-forward and fall-back; tests cover both transitions and `computeReminderNextAt`
- [x] 🟡 Actions log endpoint [FR-AI-06] — 1 d — `GET /actions` with pagination, backed by `ActionLog`
- [x] 🟡 Push token endpoints [APP-23] — `POST/GET/DELETE /api/v1/users/me/push-token(s)` over the `PushToken` model (`packages/shared/src/users/push-tokens.ts`), plus the Expo sender in `apps/server/src/modules/reminders/expo-push.ts`; stored tokens are now delivered for `phone`/`push` reminders

### R2.2 Jobs and notifications

Chosen design (instead of BullMQ/pg-boss): the database is the queue. `Reminder.nextAt`
holds the next fire slot, an in-process tick claims due rows atomically, and delivery goes
over the existing device WebSocket plus Expo push when the user has registered tokens. No Redis, no extra dependency, restart-safe.

- [x] 🔴 Job backend [JOB-01] — in-process `ReminderScheduler` (`apps/server/src/modules/reminders/scheduler.ts`) ticking every `REMINDER_TICK_INTERVAL_MS` (15 s default, `REMINDER_SCHEDULER_ENABLED=false` disables it). Class alerts and todo deadline warnings now have their own schedulers on the same interval; cleanup still has no runner
- [x] 🔴 Schedule/unschedule on create/edit/delete [JOB-02] — replaced by a stored slot: `createReminder`/`updateReminder` compute `nextAt` from `at` + `rrule` + the user's timezone, `snoozeReminder` moves it forward, deleting the row removes it. No job IDs to keep in sync
- [x] 🔴 Reminder fire: device WebSocket + Expo push + delivery status [JOB-04, FR-PRD-04] — device channel through `DeviceGateway.notifyUser`, Expo sender through `reminders/expo-push.ts` (batches tokens, drops `DeviceNotRegistered` rows), and one `ReminderDelivery` row per occurrence/channel with `SENT`/`FAILED`, attempts, error, and sent timestamp; `GET /api/v1/reminders/deliveries` exposes recent rows
- [x] 🔴 Rebuild schedules from the database on server start [JOB-06] — nothing to rebuild: `nextAt` lives on the row, so the first tick after boot picks up whatever is overdue. Covered by `claimDueReminders`
- [x] 🔴 Pre-class alerts with exception handling [FR-CLS-03] — 2 d — `ClassAlertScheduler` polls `claimDueClassAlerts` every `REMINDER_TICK_INTERVAL_MS`; `createClassAlertNotifier` sends `class.alert` to connected devices (or `DevicePendingEvent` when offline) and Expo push. Exceptions and already-started classes are claimed without delivery, and `alertedAt` makes each slot fire once
- [x] 🟡 Deadline warnings (24 h and 2 h) [FR-PRD-07] — 1 d — `TodoDeadlineScheduler` + `claimDueTodoDeadlines` claim pending todos in the 24 h and 2 h windows (`warned24hAt`/`warned2hAt`, reset when `dueAt` changes); a task inside 2 h gets only the 2 h warning. Delivery reuses the device display queue and Expo push
- [x] 🟡 Retry/backoff and failed-job visibility [JOB-05] — persisted in `ReminderDelivery`; failed rows get `nextAttemptAt` after 1 min then 5 min, and the scheduler's retry pass calls `retryDueReminderDeliveries` (capped at 3 attempts). Recent rows are visible through `GET /reminders/deliveries`; no admin dashboard
- [x] 🔴 Measure reminder latency and meet the ±30 s target [JOB-10] — `pnpm --dir apps/server verify:reminder-latency --execute` creates a reminder that becomes due just after a scheduler tick, runs the real claim query and fails above 30 s. Verified against PostgreSQL with a 14,999 ms worst-case gap (30,000 ms target); per-fire `latencyMs` and per-tick `maxLatencyMs` remain logged
- [x] 🔴 Queue offline events and deliver on device reconnect [GW-06] — 2 d — a device reminder with no socket is written to `DevicePendingEvent` and marked `PENDING`; the gateway calls `onDeviceReady(userId, send)` after `hello`, flushes up to 20 claimed events, and `markReminderDeliverySent` closes the delivery row

### R2.3 Agent and tools

- [x] 🔴 Tool framework: Zod in/out, `userId` from context, action logging, step limit [AGT-04, AGT-06, AGT-09] — 3 d — `createRoboTool` injects user/conversation context, validates input, writes `ActionLog`, and the agent uses `AI_AGENT_STEP_LIMIT`
- [x] 🔴 Tools: `get_schedule`, `create_todo`, `update_todo`, `complete_todo`, `list_todos`, `create_reminder`, `start_timer`, `create_alarm`, `create_exam`, `get_exam`, `device_show`, `device_speak` — 8 d — 25 tools are registered. The last four are now wired: timers/alarms create a backing reminder and notify the speaker, and `device_show`/`device_speak` fan structured `display`/`speak` events through `DeviceGateway.notifyUser`
- [x] 🔴 Confirmation flag for `delete_todo`, `cancel_reminder` (basic version) — 1 d — first call returns a confirmation requirement; a second call with `confirm=true` executes
- [x] 🔴 Clarifying questions for missing parameters [FR-AI-03] — 1 d — every `createRoboTool` now pre-validates input and returns `MISSING_ARGUMENTS` with deduplicated field names and a stable `question` instead of LangChain's generic schema error; known failures such as `NO_UPCOMING_CLASS` and `INVALID_DATETIME` carry a follow-up question, and the system prompt requires the model to ask it verbatim before retrying. `tool-clarifications.test.ts` covers missing title/text, valid pass-through and known failures
- [x] 🔴 Reply format: `voiceText` + `displayContent` [AGT-08] — 1 d — assistant messages now store both. `displayContent` is built from successful turn actions (`packages/shared/src/chat/display.ts`): task/reminder/schedule/exam/document/contact cards and analytics metrics, with plain-text fallback. The chat screen renders card blocks under the reply; migration `20261023200000_message_display_content`
- [x] 🔴 Router v1: fallback chain Groq → Gemini → OpenRouter → Ollama; error classification [LLM-02, LLM-06] — 3 d — the four-provider `withFallbacks` chain was already wired; `provider-errors.ts` now classifies auth, rate limit, timeout, context length, content filter, missing model, bad request, server and network failures into AI codes with 429/503/400/422 responses. Agent, chat, structured generation and quiz generation all use the classifier; `provider-errors.test.ts` covers the matrix
- [x] 🔴 **Regression test set** (50+ utterances: tool choice, parameters, refusals) and runner [AGT-12] — 4 d — `tests/fixtures/ai-regression.json` has 57 unique cases covering tool choice, parameter checks, multi-intent, and 8 refusal/privacy cases; `ai-regression-fixture.test.ts` enforces 50+, unique ids, known tool names and coverage. `pnpm ai:regression` validates fixtures without keys and `--execute` runs the live agent against `AI_REGRESSION_USER_ID`, checking selected tools and loose argument matches. Live execution was not run here because no provider keys/database are configured
- [ ] 🟡 Barge-in/interrupt handling [GW-05, FR-VOI-05] — server cancels the old reply via the turn check; firmware must stop playback locally

### R2.4 Firmware

- [ ] 🔴 Local cache of next 24 h reminders/alarms; ring offline [FW-08, FR-DEV-05] — 3 d
- [ ] 🔴 `timer.start`, `reminder.fire`, `reminder.sync` handling — 2 d
- [ ] 🔴 Signed OTA with rollback [FW-09, FR-DEV-02] — 4 d
- [ ] 🟡 Status telemetry [FR-DEV-04] — 1 d

### R2.5 Mobile app

- [ ] 🔴 Home screen: next class, today's tasks, exam countdown [APP-03] — `app/(app)/index.tsx` shows a class later today, today's/overdue tasks with inline complete and an active-exam countdown; tomorrow's next class and draft exams are not shown, and the screen still needs a device smoke test
- [x] 🔴 Tasks and reminders screens [APP-05] — `app/(app)/tasks.tsx` (filter, create with date/time via `parseDateTime`, priority, complete/reopen, delete) and `app/(app)/reminders.tsx` (snooze, channels, linked entity, delete, plus a **Repeats** picker that offers only the rules the server can evaluate: `FREQ=DAILY`, `FREQ=WEEKLY`, `FREQ=WEEKLY;BYDAY=MO,WE,FR`, `FREQ=MONTHLY`); partial: a repeat can be saved with a date but no time, which silently anchors it at midnight
- [ ] 🔴 Schedule screen with exceptions [APP-06] — `app/(app)/schedule.tsx`: day-grouped entries, create, "Skip today" and delete; edit UI is missing, and `GET /schedule` does not filter exceptions, so skipped classes still appear on Schedule and Home with no undo
- [ ] 🔴 Push notification registration and handling [APP-23] — 2 d — registration and tap routing are code-complete in `apps/mobile/src/notifications.ts` + `app/(app)/_layout.tsx`: EAS project linked, sign-out revokes the token and clears local schedules, cold-start responses are handled once, and reminder/class/deadline/nudge/class-note/pending-action taps route explicitly. Unchecked because no development build or physical device has verified delivery and taps
- [x] 🟡 Local notification fallback [APP-29] — 2 d — `syncLocalReminderNotifications` schedules upcoming active reminders with `expo-notifications` only when Expo push registration is unavailable (web, simulator, missing EAS project id), cancelling and rebuilding the queue when the reminder list changes; local schedules are cancelled once push registration succeeds and re-checked while scheduling
- [x] 🟡 Device/connection status UI [APP-27] — `app/(app)/devices.tsx` shows a per-device status pill and last-seen; status refreshes only on pull-to-refresh, not through the app WebSocket
- [x] 🔴 Settings and privacy: quiet hours, data export/delete request [APP-13, FR-ACC-06] — `app/(app)/settings.tsx`: identity, quiet hours, wake phrase, nudges (0–20 per day, matching the server's zod bound), cloud-AI-for-docs, export via the system share sheet with oversize handling, two-step delete + sign out; partial: saving identity/preferences does not refresh `auth.user`, so nav labels and other user-derived UI stay stale until restart
- [x] 🔴 Account deletion job (PostgreSQL, files, later vectors) [FR-ACC-06] — 2 d — `deleteAccountData` removes Qdrant points when RAG is configured, deletes temporary upload files, then deletes the user row so PostgreSQL cascades owned rows; `DELETE /users/me` returns files/vectors counts and `account-deletion.test.ts` covers success, missing files and unconfigured RAG

### R2.6 Release

- [ ] 🔴 Closed alpha with 3–5 testers; collect feedback in a tracker — 5 d
- [x] 🟡 Write the privacy notice (microphone, data use) — 1 d — `docs/privacy-notice.md` drafted with data categories, purposes, sharing, retention and rights. Counsel review and placeholder replacement remain external
- [ ] 📦 **MVP demo:** "Remind me every evening at 7", "What class is next?" by voice

---

## R3 — Study Brain

**Exit criteria:** grounded answers with citations ≥ 90% on the test set; cross-user isolation tests pass.

### R3.1 Storage and ingestion

- [x] 🔴 MinIO/R2 setup, signed upload URLs, `Document` model [API-10, DAT-21] — 3 d — `lib/storage.ts` wraps a MinIO/S3 client with bucket bootstrap, signed PUT/GET URLs, head/delete/read, and retry-safe configuration. The `Document` model gained `checksum`, `pageCount`, `attempts`, `error`, `indexedAt` and a queue index (migration `20261025090000_document_storage`). the server bootstraps the bucket on first use; storage keys stay server-side and responses expose only short-lived signed download URLs; S3 calls are unit-tested with mocked clients, but a live MinIO round trip has not been run here
- [x] 🔴 Upload endpoints and size/quota limits [RAG-01] — 2 d — `POST /documents/upload` streams a multipart file into storage, `POST /documents/upload-url` + `POST /documents/:id/complete` implement direct-to-storage uploads, and `GET /documents/:id/download-url` signs reads. MIME allow-list, empty/size checks, per-user byte and document-count quotas, SHA-256 checksums and rollback on database failure are enforced; helpers are covered by `document-upload.test.ts`
- [x] 🔴 `documents` queue with states uploaded → parsing → ocr → chunking → embedding → indexed/failed [RAG-02] — 3 d — `DocumentIngestionJob` polls PostgreSQL, claims atomically with stale-lock recovery, retries with linear backoff and marks permanent failures; status transitions are covered by `document-ingestion.test.ts` and `document-ingestion-job.test.ts`
- [x] 🔴 Parsers: PDF, DOCX, PPTX, TXT/MD [RAG-03] — 4 d — `parsers.ts` handles text/markdown, DOCX via mammoth, PPTX slide XML via jszip and PDF text via pdfjs-dist; page metadata is retained and `document-parsers.test.ts` uses a real PDF fixture
- [x] 🔴 OCR: Tesseract; vision-model fallback for handwriting/formulas [RAG-03] — 4 d — Tesseract reads rendered PDF pages and image uploads with confidence thresholds; the optional vision fallback is wired behind `OCR_VISION_FALLBACK`. Tests mock OCR; the Tesseract CLI/language data and live vision fallback were not exercised here
- [x] 🔴 Chunking with page/slide metadata [RAG-04] — 2 d — `chunk.ts` produces page-scoped overlapping chunks with sentence/word boundaries; `document-chunk.test.ts` covers page isolation and overlap
- [ ] 🔴 Choose and benchmark embedding model on your languages (BGE-M3 vs multilingual-e5) [LLM-09] — 3 d — `bge-m3` remains the configured default and a 20-document labelled benchmark harness exists (`embeddings:benchmark`); the live BGE-M3 vs multilingual-e5 comparison still needs Ollama and a larger language-balanced corpus
- [x] 🔴 Qdrant collection, payload indexes, upsert [RAG-05, DAT-10/11] — 2 d — `ensureDocumentCollection` creates the collection at the configured embedding dimension and adds keyword payload indexes for `userId`, `documentId` and `subjectId`; `indexDocumentChunks` upserts chunks with page/source metadata. `document-retrieval.test.ts` covers filters and sanitization; no live Qdrant round trip was run

### R3.2 Retrieval and answers

- [x] 🔴 Single retrieval helper with mandatory `userId` filter [RAG-06] — 2 d — `searchDocumentChunks` in `qdrant.ts` is the only retrieval path and always applies a `userId` payload filter (plus optional `documentId`); `search_documents` passes the tool-context user, so callers cannot omit the scope
- [x] 🔴 **Isolation tests:** user B can never retrieve user A's chunks [NFR-07] — 1 d — `document-retrieval.test.ts` verifies the Qdrant filter always includes the caller's `userId` and that a document filter cannot widen it
- [x] 🔴 Score threshold and "not found in your materials" behavior [RAG-07, FR-AI-07] — 2 d — retrieval drops low-score chunks and returns an explicit not-found result with the message "I couldn't find that in your uploaded materials."; `document-retrieval.test.ts` covers thresholding and not-found shape
- [x] 🔴 Citations in answers (document, page) [RAG-08, FR-DOC-04] — 2 d — `search_documents` results are rendered as a Sources card with document name, page and score (covered by `display-content.test.ts`), and the tool contract tells the agent to answer from the returned passages and cite the source
- [x] 🔴 Prompt-injection defense for document text [AGT-07] — 2 d — retrieved passages are sanitized (control tokens stripped, suspicious instructions flagged) and the prompt marks them as untrusted data; the model is forbidden from following document commands, and tests cover sanitization
- [x] 🟡 Reranker experiment [RAG-09] — 2 d — a flag-gated heuristic reranker combines vector score with query-term coverage (`QDRANT_RERANK_ENABLED`); it is unit-tested. A live comparison against a cross-encoder was not run
- [x] 🔴 Tools: `search_documents`, `summarize_document` [FR-DOC-05] — 3 d — `search_documents` returns cited passages and not-found metadata; `summarize_document` requires an indexed document, summarizes retrieved passages with the structured model and falls back to a deterministic extractive summary
- [x] 🔴 Retrieval evaluation set (50 questions with expected sources) — 3 d — `tests/fixtures/retrieval-eval.json` has 50 unique questions across five sources; `retrieval:eval` validates it without keys and requires 90% live accuracy with `--execute`

### R3.3 Quizzes, notes, plans

- [x] 🔴 `generate_quiz` with structured output validation and retry [RAG-10, FR-DOC-06] — 4 d — the generator now uses the structured-generation model chain, validates exactly N questions, four distinct options and an answer that matches an option, retries once with a stricter prompt, and only then persists; `quizzes.test.ts` covers normalization, retry and rejection
- [x] 🔴 `record_quiz_result`, attempts storage [FR-DOC-10] — 2 d — attempts are stored with per-question results and score; duplicate/foreign question ids are rejected, `GET /quizzes/:id/attempts` lists history, and the `record_quiz_result` tool wraps submission
- [x] 🔴 Class notes: models, API, tools `save_class_note`/`query_class_notes`; post-class prompt job [FR-CLS-04/05/06] — 5 d — `ClassNote` model + migration, `/class-notes` CRUD/search, tools linked to timetable entries, a 60-second scheduler that asks for a note 5–35 minutes after class (device display + Expo push, opening the notes screen), and an app capture screen with search-ready API; covered by `class-notes.test.ts`
- [x] 🔴 `get_subject_topics`, `get_existing_tasks` [FR-EXM-04] — 2 d — `list_subjects` exposes ids and topic counts, `get_subject_topics` returns mastery scores, and `get_existing_tasks` returns pending tasks (optionally by subject/due date) so plans avoid duplicate work
- [x] 🔴 `create_study_plan` (draft) + approval flow + todo/reminder creation [FR-EXM-02/03] — 6 d — draft generation and `create_study_plan` exist; `approve_study_plan`/`POST /exams/:id/plan/approve` create one todo per plan day at 18:00 local, create a daily reminder until the exam, activate the exam and are idempotent
- [x] 🟡 Revision summary [FR-EXM-07] — 1 d — `getRevisionSummary` combines readiness, uncovered/weak topics, recent quiz average and the next planned task into a deterministic narrative; exposed as `GET /exams/:id/revision`, `get_revision_summary`, and a Revision summary card on the exam screen
- [x] 🟡 Formula/screenshot explanation via vision model [FR-DOC-07] — 2 d — `POST /ai/vision` validates base64 JPG/PNG/WebP up to 5 MB, reserves the daily AI quota, runs the `LLM_VISION_CHAIN`, records tokens and returns only the explanation; mobile `vision.tsx` requests photo permission, converts the picked image to JPEG, previews it and shows the answer, linked from Documents

### R3.4 AI platform hardening

- [x] 🔴 Quota counters and degraded mode [LLM-04] — 3 d — `AiUsage` (migration `20261024000000_ai_usage`) records UTC-day requests plus input/output tokens; `consumeAiQuota` atomically reserves a turn and returns 429 `AI_QUOTA_EXCEEDED` past `AI_DAILY_REQUEST_LIMIT` (default 200); quota storage failures are logged and fail open so a database hiccup cannot take chat down. `ai-usage.test.ts` covers the UTC boundary, limit, counters and empty day
- [x] 🔴 "Allow cloud AI for documents" setting; local-only routing for private docs; tests with mocked providers [LLM-05] — 3 d — when `cloudAiForDocs` is false and the user has any documents, chat/voice turns use the `LLM_PRIVATE_DOCS_CHAIN` (Ollama) instead of the cloud agent chain; document-count failures fail closed to local. If no local model is configured the API returns 503 `AI_LOCAL_NOT_CONFIGURED` with a Settings hint. `document-routing.test.ts` covers allowed, local, empty and fail-closed cases
- [x] 🟡 LLM usage logging [LLM-07] — 1 d — every chat/voice turn now persists input/output token counts through `recordAiTokenUsage` into `AiUsage`; provider/model/latency/tool-count logs remain in `chat-service`/`agent`, and persistence failures are logged without failing the reply
- [x] 🟡 Model gating by regression score [LLM-08] — 2 d — `LLM_MODEL_REGRESSION_SCORES` plus `LLM_MIN_MODEL_REGRESSION_SCORE` remove low-scoring models from the fallback chain while keeping unmeasured models; `model-gating.test.ts` covers gating, disabled mode and malformed JSON
- [x] 🟡 Langfuse tracing with pseudonymized user IDs [AGT-10, DAT-32] — 2 d — `getTraceCallbacks` attaches the Langfuse LangChain callback to agent runs when `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` are configured, hashes the user ID with SHA-256 before sending it, and uses the conversation ID as the trace session; tracing disables itself without keys or if the package fails to load
- [x] 🟡 Long-term memory tools + memory screen [FR-AI-05, AGT-11] — 3 d — `Memory` model + migration, `/memories` CRUD, `save_memory`/`list_memories`/`forget_memory` tools, prompt guidance against storing secrets, and an app screen linked from Settings; `memories.test.ts` covers trimming, validation, ownership and scoping
- [x] 🔴 Cleanup job for expired data, orphan files and vectors [JOB-09, RAG-11] — 2 d — `runDataCleanup` deletes transcripts/messages, empty conversations, action logs, deliveries, nudges, resolved pending actions, expired refresh tokens and delivered/expired device events past `DATA_RETENTION_DAYS`; `DataCleanupJob` runs daily. Files/vectors go through the `removeOrphans` hook, which is a no-op until object storage and Qdrant are configured; `cleanup-job.test.ts` covers the cutoff and job
- [x] 🟡 Re-indexing job when the embedding model changes [RAG-12] — 2 d — `queueEmbeddingReindexes` requeues indexed documents whose `embeddingModel` differs (or is null); the ingestion job runs the scan hourly, and `POST /documents/:id/reindex` requeues one document manually

### R3.5 Mobile app

- [x] 🔴 Documents screen: upload (files), subjects, status, delete [APP-08] — `app/(app)/documents.tsx` uploads PDF, DOCX, PPTX, text/markdown and images via `expo-document-picker`; it shows parsing/OCR/chunking/embedding status, retries failures and re-indexes indexed documents. Status advances only after a manual refresh; there is no document open/download action
- [ ] 🔴 Exams and plan screen with approve/edit [APP-07] — `app/(app)/exams.tsx`: exam list with countdowns, activate (draft → active), generate plan, approve plan by PLAN id (creates todos + a daily reminder), readiness bar and Recalculate button; the generated plan lives only in component state, so approve/recalculate disappear after reload and are unavailable for plans created through chat/tools; plan task titles are placeholders
- [x] 🔴 Quiz runner and history [APP-09] — 4 d — `app/(app)/quizzes.tsx` generates a real quiz, fetches its questions, collects answers, shows the score with per-question review/explanation, and lists past attempts
- [ ] 🔴 Chat: rich cards (plans, quizzes, tappable citations) — 3 d — `buildDisplayContent` emits quiz cards (`generate_quiz`), study-plan cards (`create_study_plan`/`approve_study_plan`) and citation cards from `search_documents` with source/page/score; plan and quiz cards route to their list screens, but citation rows are plain text and only the whole Sources card opens `/documents`, so “tappable citations” is not met. Confirmation cards are also non-actionable.
- [ ] 🟡 i18n and right-to-left support [APP-28] — 3 d — foundation added: `src/i18n` normalizes en/hi, translates the five tab labels, records text direction, calls `I18nManager.allowRTL`, and onboarding/settings store `en`/`hi`; remaining screens, alerts and validation messages are hardcoded English, device locale is ignored, `textDirection()` is unused and no RTL language ships — **Phase 6 in progress**: i18n dictionaries complete (50+ keys en+hi), layout/activity/approvals/chat/settings/tasks/reminders/schedule screens updated to use `t()`. Remaining: exams, insights, documents screens + date/number formatting + RTL smoke test — **Phase 6 in progress**: adding translation keys, updating screens to use `t()`, localizing dates/numbers, forced-RTL smoke test — **In progress for Phase 6**: replacing static strings, localizing dates/numbers, and forced-RTL smoke test
- [ ] 🟡 Second voice language: STT/TTS/wake word [FR-VOI-09] — 4 d — English and Hindi are configured for STT and TTS: the user locale flows to STT, the LLM prompt and `TTS_VOICE_MAP` (`hi_IN-pratham-medium`), and the TTS container downloads both voices via `TTS_VOICES`. Wake-word vocabulary is firmware-side and blocked on hardware, so this stays open

### R3.6 Release

- [ ] 🔴 Closed beta with students using real course material — 10 d
- [ ] 📦 **Demo:** upload a textbook, ask a question with citation, generate 10 MCQs

---

## R4 — Communication

**Exit criteria:** no call or message executes without confirmation; zero wrong-recipient cases in tests.

- [x] 🔴 `Contact` and `PendingAction` models, API, expiry job (5 min) [API-12] — 3 d — `Contact` now supports update, and `PendingAction` stores call/SMS/email/WhatsApp drafts with recipient, body, status and a 5-minute `expiresAt`. `GET /actions/pending` and confirm/reject endpoints are atomic and ownership-scoped; `PendingActionScheduler` expires stale rows every 30 s
- [x] 🔴 Contact import from phone with consent; groups [FR-COM-01, APP-10] — `app/(app)/contacts.tsx` now opens the native single-contact picker: it shows a permission rationale on Android, reads only the chosen contact's name/phone/email, de-duplicates against saved contacts, records `CONTACTS` consent, and pre-fills the form for review before saving under "Imported". Manual entry remains. Runtime permission still needs a rebuilt EAS dev client
- [x] 🔴 `find_contact` with ambiguity handling [FR-COM-05] — 2 d — `matchContacts` ranks exact name/email/phone matches ahead of prefix/substring ones, flags multiple leading matches as ambiguous, and the tool returns `requiresClarification` plus the candidate list; `contacts-matching.test.ts` covers exact, ambiguous, phone-format and no-match cases
- [x] 🔴 LangGraph human-in-the-loop pause/resume for confirmable tools [AGT-05] — 4 d — `delete_todo` and `cancel_reminder` now call LangGraph `interrupt()` instead of trusting a model-supplied confirm flag. The agent checkpoints the paused run, returns the question to chat/voice, and resumes with `Command({ resume })` only after the student's yes/no reply; ambiguous replies re-ask without executing. Covered by the interrupt/resume test and confirmation-reply unit tests
- [x] 🔴 App WebSocket + push for `action.confirm.request` / `action.execute` [GW-02, APP-24] — 4 d — authenticated `/ws/app?token=…` gateway (`AppGateway`) delivers action events per user with expiry-aware close; `publishAppActionEvent` fires on pending-action creation and confirmation from AI tools and the REST confirm route, also sends Expo push with `kind: pending_action`; the app reconnects with capped backoff, refreshes once on auth close, invalidates pending-action/activity queries, and routes notification taps to `/approvals`. Covered by `app-gateway.test.ts` and `app-action-events.test.ts`
- [x] 🔴 `prepare_call` → confirm → `tel:` dialer [FR-COM-02, APP-25] — 2 d — `prepare_call` resolves a contact and creates a 5-minute pending action; the Approvals screen confirms it and opens the `tel:` URI only after the tap
- [x] 🔴 `prepare_message` → confirm → SMS composer [FR-COM-03] — 2 d — `prepare_message` supports SMS, WhatsApp and email drafts; Approvals opens the matching `sms:`, `wa.me` or `mailto:` URI after confirmation
- [x] 🟡 WhatsApp (`wa.me`) and email composer drafts [FR-COM-04] — 2 d — both are prepared through `prepare_message` and opened from the Approvals screen
- [x] 🟡 "Remind me to call X after class" [FR-COM-06] — 1 d — `remind_to_call` resolves the contact (asking when ambiguous), finds the named or next class end, and creates a reminder five minutes later on device/phone/push with the class title in the response
- [ ] 🟡 Confirm by voice on the device as well as by tap — 2 d
- [x] 🟡 Action history and contact deletion UI [FR-COM-08] — 2 d — Activity renders the action log, contacts can be deleted from the contacts screen, and pending confirmations live in Approvals
- [ ] 🟢 Missed-call follow-up where permitted [FR-COM-07] — 2 d
- [ ] 🟢 Timetable import from photo (OCR + review) [FR-CLS-08] — 4 d
- [x] 🔴 Tests: wrong-recipient, expired action, rejected action, duplicate confirm — 3 d — `apps/server/tests/pending-actions.test.ts` covers exact-recipient URIs, wrong-user isolation, five-minute expiry, rejection, duplicate confirm and the expiry scheduler (116 server tests total)
- [x] 🟡 Review Google Play policy requirements for contacts/SMS/phone before submitting — 1 d — `docs/play-policy-review.md` records the permission/data-safety inventory and launch blockers. SMS/call actions are intent-only with no restricted permissions, and the manifest now drops unused microphone, contacts-write and broad storage access. Remaining blockers: target API 36 device re-test, AI-answer reporting production verification, account-deletion page deployment, hosted privacy policy/Data safety, and the Play Console contacts declaration position
- [x] 🟡 Replace broad contact import with the system Contact Picker before targeting Android 17 (API 37), or prepare a Play Console declaration — 2 d — `contacts.tsx` now uses `Contacts.presentContactPickerAsync()` for one contact at a time, pre-fills the form for review, de-duplicates, and records consent; the 200-contact batch import is gone. `expo-contacts` still requests `READ_CONTACTS` on Android, so a production re-test and the Play Console declaration position remain
- [ ] 📦 **Demo:** "Call Mom" and "Send Ahmed a message…" with confirmation

---

## R5 — Proactive (Study Mode and Analytics)

**Exit criteria:** study session works end to end on device and app; nudges respect quiet hours.

### R5.1 Study mode

- [x] 🔴 `StudySession` model, API (start, pause, resume, extend, end) [FR-STM-01/04/06] — 3 d — model now carries `status`, `plannedMinutes`, `extendedMinutes`, `pausedAt`, and `totalPausedMs`; `/api/v1/sessions` supports active/list/start/pause/resume/extend/end, and `sessionStudyMinutes` excludes completed and open pauses
- [x] 🔴 Tools `start_study_session` / `end_study_session` [FR-STM-01] — 2 d — both call the session API and send a `display` card (`kind: study`) to the speaker; ending reports the active study minutes
- [ ] 🔴 Device: timer screen, end announcement, break suggestion [FR-STM-02/03] — 4 d
- [x] 🔴 App session screen mirroring the device [APP-11] — 3 d — `app/(app)/study.tsx` has live elapsed clock, pause/resume, +5 min, end, presets, Pomodoro breaks and recent sessions; `/sessions/active` now returns the same `StudySessionResult` shape as the other session endpoints, covered by `toStudySessionResult` regression coverage. Device audio announcement stays device-side
- [x] 🟡 Do Not Disturb prompt [FR-STM-05] — 1 d — starting a study session offers a one-time prompt to enable Do Not Disturb (Android opens the system DND screen; iOS explains how to enable a Focus mode and opens app settings), and the active-session card keeps an "Enable Do Not Disturb" shortcut
- [x] 🟢 Pomodoro cycles — 2 d — study screen adds a Pomodoro toggle (planned focus window + 5-minute break). When the focus window elapses it shows a break card; "Take a 5-minute break" pauses the session and Resume starts the next cycle. Audio chime/announcement stays device-side

### R5.2 Analytics and proactivity

- [x] 🔴 `DailyStats` model and nightly aggregation job [JOB-07, FR-ANL-01] — 3 d — `DailyStats` stores study minutes, completed tasks/quizzes and quiz-score sums per local day; `DailyStatsJob` rolls up yesterday hourly (idempotent upsert), and `getAnalyticsSummary` combines completed-day aggregates with live today counts
- [x] 🔴 `get_analytics` tool and weekly summaries [FR-ANL-02] — 2 d — `get_analytics_summary` returns real totals plus a generated narrative for the requested range (day/week/month/year); `buildAnalyticsNarrative` is unit-tested and the same sentence appears on Insights
- [x] 🟡 Insights screen in app [APP-12, FR-ANL-05] — `app/(app)/insights.tsx` renders `GET /analytics/summary` with a day/week/month/year picker, and `app/(app)/activity.tsx` renders `GET /actions` with safe `unknown` payload dumps. Metrics are now real: `completedAt` is set by `completeTodo`/`updateTodo`, `totalStudyHours` sums session durations, `upcomingExams` includes draft and active exams, and `streakDays` is calculated from task/session activity. Charts are still stat cards only
- [x] 🟡 Trends per subject [FR-ANL-03] — 2 d — `GET /analytics/subjects/:id` returns study hours, completed tasks, quiz average and recent activity; Insights adds a subject picker backed by `/subjects` and renders the selected trend
- [x] 🟡 Nudge rules engine with quiet hours and daily caps [JOB-08, FR-ANL-04] — 4 d — `NudgeScheduler` evaluates task/exam/study/reminder rules on a 5-minute tick, honours opt-in settings, type toggles, 08:00–21:00 local hours, wrapped quiet hours, a per-day cap and one nudge per type per local day. Claims are unique-keyed in `Nudge`; delivery uses the device display plus Expo push (generic `sendPushToUser`). Covered by `nudges.test.ts`
- [x] 🟡 "What should I do today?" planner and multi-intent handling [FR-ANL-06, FR-AI-08] — 4 d — `plan_today` ranks tasks by overdue/due/priority, adds the next class, nearest exams, today's reminders and any running session; the agent prompt now requires every independent request in a multi-intent message to be handled. `planner.test.ts` covers ranking and summary
- [x] 🟡 Readiness score and plan recalculation [FR-EXM-05/06] — 5 d — readiness counts linked completed tasks and reports uncovered topics; `POST /exams/:id/plan/recalculate` spreads remaining tasks across the days left (resetting deadline warnings), and the exam screen exposes a Recalculate button

### R5.3 Device polish

- [ ] 🟡 LVGL screens: home, timer, exam countdown, status [FW-10, FR-DEV-03] — 6 d
- [ ] 🟢 Sensor readings (light, temperature) [FR-DEV-06] — 2 d
- [ ] 🟡 Enclosure design and 3D print/prototype case — 5 d
- [ ] 📦 **Demo:** "Start study mode" → countdown → break → weekly summary

---

## R6 — Advanced (explore after launch)

- [ ] 🟢 Multi-device pairing and synchronization [FR-ACC-08, FR-DEV-07] — spike first
- [ ] 🟢 Camera input: read a homework page on device — spike first
- [ ] 🟢 Expression/emotion animations on display
- [ ] 🟢 Android app blocking during study sessions (native module) [FR-STM-07]
- [ ] 🟢 iOS release hardening
- [ ] 🟢 MQTT for control messages if WebSocket scaling needs it

---

## Mobile Audit Follow-ups (2026-10-30)

Full report: [`report.md`](report.md). The app typechecks and lints, and all mobile-called API routes exist, but these items block calling the mobile scope complete.

### P0 — runtime and configuration blockers

- [x] 🔴 Set production `EXPO_PUBLIC_API_URL` for the EAS profiles; verify push registration, cold-start tap routing, nudge routing and sign-out token revocation on a development build
- [x] ⏭ APP-02 QR/BLE/Wi-Fi provisioning — **Descoped for v1 (2026-10-30):** app-side QR scan, BLE/Wi-Fi provisioning and the `robo://pair` route are not shipping; pairing/status screens remain

### P1 — checked items that still need completion

- [ ] 🔴 Schedule: add edit UI and make exceptions suppress entries in Schedule and Home
- [ ] 🔴 Home: show the next class across days and include draft exams in the countdown
- [ ] 🔴 Exams: add a persisted plan read endpoint and restore approve/recalculate after reload and for chat-created plans
- [x] 🟡 Chat: make citation rows individually tappable, persist/restore history, and harden stop/error/timeout handling
- [ ] 🟡 Vision: add camera capture and permission handling, or update the FRD/todo to library-only
- [ ] 🟡 Documents: poll processing status or refresh on focus so parsing/OCR/embedding progress is visible
- [ ] 🟡 Settings: refresh `auth.user` after preference saves
- [ ] 🟡 i18n/RTL: translate the remaining screens and activate RTL before shipping an RTL locale

### P2 — release verification

- [ ] 🔴 Build an EAS development client and run Android 16 smoke tests for push, chat streaming, contacts, photo picker, edge-to-edge layout and WebSocket reconnect
- [ ] 🔴 Run the Maestro smoke/sign-in flows against the development build

---

## X — Cross-Cutting Tasks (continuous)

### X.1 Security and privacy

- [x] 🔴 Threat model (device, API, AI prompt injection, vector isolation) — 3 d — `docs/threat-model.md` documents assets, actors, trust boundaries, threats/controls and residual risks. A pen test and live verification remain external
- [ ] 🔴 TLS everywhere; secrets in a secret manager, none in app or firmware repo — 1 d — production Caddy terminates TLS with HSTS and `.env.production.example` documents the required secrets, but no VPS/secret manager is provisioned and the repo still has no automated secret-manager integration
- [x] 🔴 Secure boot + flash encryption plan for production devices — 3 d — `docs/secure-boot.md` defines the ESP-IDF Secure Boot v2 chain, partition layout, offline signing, rollback protection, provisioning and a production checklist. No hardware was provisioned or flashed
- [x] 🔴 Consent records (microphone, contacts, documents, cloud AI) — 2 d — `UserConsent` model + migration, `GET/PUT /users/me/consents`, shared audit helpers, data-export inclusion, account cascade deletion, mobile privacy toggles and consent capture on contact-picker selection/document upload/cloud-AI save. `consents.test.ts` covers grant/revoke and scoping
- [ ] 🔴 Data export and deletion verified end to end (PostgreSQL, Qdrant, Redis, files) [DAT-31] — 2 d — export now includes consent records, account deletion cascades `UserConsent`, and `pnpm --dir apps/server verify:data-lifecycle --execute` (with `VERIFY_USER_ID`) checks PostgreSQL, Qdrant and S3 against a disposable account. The destructive live run has not been executed
- [x] 🟡 Guardian consent flow for minors if in scope [FR-ACC-07] — 3 d — not applicable for v1: the target age group is university/18+ only, so guardian consent is out of scope until school use is added
- [x] 🟡 Dependency vulnerability scanning in CI — 0.5 d — CI audits both apps at `critical` level, Dependabot covers server/mobile/Python/Actions, and the two critical findings (unused `class-validator`, vulnerable `tar`) were removed. Higher-severity transitive advisories remain
- [ ] 🟡 Legal review: terms of service, privacy policy, third-party AI provider terms — external

### X.2 Testing and evaluation

- [ ] 🔴 Unit and integration tests (Vitest/Jest, Supertest) for each module
- [x] 🔴 Maintain AI regression set; run it on every prompt/model change [AGT-12, NFR-08] — CI runs `ai:regression` in fixture-validation mode on every push/PR; live model execution still requires provider keys and a user
- [ ] 🟡 Mobile end-to-end flows with Maestro — `.maestro/smoke.yaml` covers launch and auth-screen navigation; `.maestro/sign-in.yaml` covers sign-in when `ROBOTEST_EMAIL`/`ROBOTEST_PASSWORD` are provided. Flows are authored but have not been run because no emulator/development build exists
- [ ] 🟡 Firmware tests (Unity) and a manual device test checklist
- [ ] 🟡 Load test: 500 concurrent device sessions [NFR-11] — `tests/load/device-sessions.js` implements a k6 500-VU WebSocket scenario with turn-latency and failure thresholds; it has not been run against staging
- [ ] 🟡 Latency dashboard for the voice pipeline [NFR-01] — per-turn VAD/STT/first-token/TTS timings are logged and chat/voice latency is persisted, but no dashboard is provisioned

### X.3 DevOps and operations

- [ ] 🔴 Staging and production environments; database backups with restore test — `docs/production-operations.md`, `deploy/Caddyfile` and `scripts/backup-db.sh` cover native deployment; no VPS/staging environment exists and no restore drill has been run
- [ ] 🔴 Monitoring and alerts (Sentry, uptime check, queue depth) — Sentry wiring and the monitoring/alerting runbook are in place; no Sentry project, uptime monitor or alert routing exists yet
- [ ] 🟡 Log shipping and retention policy
- [ ] 🟡 EAS Update channels (staging/production); OTA firmware channels — `eas.json` defines development/preview/production channels and the EAS project is linked; EAS Update is not configured and firmware OTA is not implemented
- [x] 🟡 Runbook: provider outage, queue backlog, Qdrant restore — `docs/production-operations.md` covers deploy, TLS/secrets, backups/restore, monitoring, load testing, incident response and launch checks; `scripts/backup-db.sh` implements the database backup/rotation step. A real restore drill is still required

### X.4 Launch

- [x] 🔴 Upgrade mobile to target Android 16 (API 36) — upgraded to Expo SDK 54 / React Native 0.81, whose Android defaults compile and target API 36 (verified from `expo prebuild` output). `expo-doctor` passes 18/18, mobile typecheck/lint pass and an Android production bundle exports successfully. Notification trigger/handler APIs were migrated for `expo-notifications` 0.32, and the Sentry/localization config plugins were added. A fresh EAS build and on-device smoke test (notifications, edge-to-edge, photo picker, contacts, WebSocket reconnect) still need to run
- [x] 🔴 In-app AI answer reporting/flagging for chat and vision, plus moderation triage — required by Play's AI-Generated Content policy — `Report` actions on chat/vision answers call `POST /chat/feedback`; `AiFeedback` records the reason, optional details, message ID or vision answer text, and is included in data export/cascade deletion. Moderators triage via `GET/PATCH /admin/ai-feedback`; production-build verification remains
- [x] 🔴 Public account-deletion web resource, linked from Play Console and the in-app deletion flow — `GET /account/delete` + `POST /api/v1/account/deletion-request` accept requests without the app; moderators verify ownership by email and process through `GET/PATCH /api/v1/admin/deletion-requests`, which runs the same file/vector/DB cleanup. Deployment URL and Play Console entry remain; see `docs/account-deletion.md`
- [ ] 🔴 Beta program (20–50 students), feedback loop, bug triage
- [ ] 🔴 Play Store listing, data-safety form, privacy policy URL
- [ ] 🟡 User guide and device quick-start card — `docs/user-guide.md` covers onboarding, chat, tasks, reminders, exams, documents, quizzes, approvals, devices and privacy; `docs/device-quick-start.md` is a draft card pending firmware validation
- [x] 🟡 Support channel and FAQ — in-app Help & FAQ screen linked from Settings, with a configurable `EXPO_PUBLIC_SUPPORT_EMAIL`/`EXPO_PUBLIC_SUPPORT_URL` channel and a GitHub issue fallback; triage workflow and launch checklist in `docs/support-faq.md`. Set a monitored production contact before release
- [ ] 🟡 Finalize pricing/business model (device sale, AI subscription, or both)
- [ ] 📦 **v1.0 launch checklist signed off**

---

## Critical Path

```
P0 spikes (voice, wake word, latency)
   → R1 voice pipeline + firmware + pairing
      → R2 agent tools + reminder engine + OTA  (MVP)
         → R3 RAG + quizzes + study plans
            → R4 confirmations + communication
               → R5 study mode + analytics → Launch
```

Highest-risk items to start early: wake-word accuracy on the chosen hardware, end-to-end voice latency, reminder reliability, cross-user vector isolation, and free-tier model tool-calling quality.

---

## Next 2 Weeks (suggested starting sprint)

1. [ ] Decide languages and hosting (P0.1)
2. [ ] Order hardware (P0.2)
3. [ ] Create accounts and keys (P0.3)
4. [ ] Monorepo, native services, CI (P0.4)
5. [ ] Voice spike: record and play back on ESP32-S3 (P0.5)
6. [ ] Latency spike on a laptop: Whisper → LLM → Piper (P0.5)
7. [ ] Expo development build with BLE scan (P0.5)
8. [x] Express skeleton + Prisma + auth (R1.2)

---

_End of document._
