# Student AI Assistant — Project TODO

| Field          | Value                                                                                                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Based on**   | `Student_Assistant_FRD_v2_Stack.md` and `stack.md`                                                                                                                                                      |
| **Created**    | 14 Oct 2026                                                                                                                                                                                             |
| **How to use** | Tick `[x]` when a task meets its Definition of Done. Requirement IDs in brackets point to the FRD. Estimates are in working days for one developer and are rough (±40%); re-estimate at sprint planning |
| **Legend**     | 🔴 critical path · 🟡 important · 🟢 optional · ⛓ depends on the task named · 📦 deliverable                                                                                                            |

---

## Progress Tracker

| Phase | Goal                                    | Est.       | Status        |
| ----- | --------------------------------------- | ---------- | ------------- |
| P0    | Decisions, setup, hardware ordered      | 10–15 d    | Partial (code setup in place; decisions/hardware pending) |
| R1    | Voice foundation                        | 30–40 d    | In progress (R1.3 gateway + voice pipeline; firmware/mobile pending) |
| R2    | Productivity (MVP complete)             | 30–40 d    | ☐             |
| R3    | Study Brain (documents, quizzes, plans) | 40–50 d    | ☐             |
| R4    | Communication (calls, messages)         | 25–30 d    | ☐             |
| R5    | Proactive (study mode, analytics)       | 35–40 d    | ☐             |
| R6    | Advanced (vision, sync)                 | Ongoing    | ☐             |
| X     | Cross-cutting: security, QA, launch     | Continuous | ☐             |

**Definition of Done (every task):** code reviewed · tests passing · Zod schemas / tool contracts documented · privacy impact checked · demonstrated on the real device or app where relevant.

---

## P0 — Decisions, Setup and Hardware (do first)

### P0.1 Decisions (answer the FRD open questions)

- [ ] 🔴 Choose launch language(s) (drives STT, TTS, embeddings, wake word) — 1 d
- [ ] 🔴 Choose target age group (university only vs school → consent scope) — 0.5 d
- [ ] 🟡 Decide whether an app-only mode (no device) is needed for early users — 0.5 d
- [ ] 🟡 Choose job queue: BullMQ (Redis) vs pg-boss — 0.5 d
- [ ] 🟡 Choose UI kit: React Native Paper / Tamagui / NativeWind — 0.5 d
- [ ] 🟡 Choose hosting: single VPS + Docker Compose vs managed services — 1 d
- [ ] 🟡 Decide transcript/action-log retention period — 0.5 d
- [ ] 📦 Update the decision log in `stack.md` section 13

### P0.2 Hardware procurement

- [ ] 🔴 Buy 2 dev boards: ESP32-S3 with PSRAM (e.g., all-in-one box-style board) and 1 bare ESP32-S3 dev kit — 1 d
- [ ] 🔴 Buy I2S MEMS mics (INMP441 and a dual-mic option), MAX98357A amplifier, small speaker, TFT/OLED display, buttons, a hardware mute switch, LEDs — 1 d
- [ ] 🟡 Buy breadboard, wires, USB cables, a power supply, and a case material for the prototype — 0.5 d
- [ ] 🟡 Draft the bill of materials (BOM) with prices — 1 d

### P0.3 Accounts and keys

- [ ] 🔴 Create accounts and API keys: Google AI Studio (Gemini), Groq, OpenRouter — 0.5 d
- [ ] 🔴 Create Expo / EAS account; Google OAuth client for sign-in — 0.5 d
- [ ] 🟡 Create Sentry project; (later) Langfuse instance — 0.5 d
- [ ] 🟡 Record current free-tier limits and data terms for each provider in a `docs/providers.md` — 1 d

### P0.4 Repository and environment

- [ ] 🔴 Create monorepo with pnpm workspaces: `apps/mobile`, `apps/server`, `packages/shared`, `firmware/` — 1 d
- [ ] 🔴 Configure TypeScript (strict), ESLint, Prettier, commit hooks — 0.5 d
- [ ] 🔴 `docker-compose.yml`: PostgreSQL, Redis, Qdrant, MinIO — 1 d
- [ ] 🟡 Add Ollama service to Compose and pull one small model + one embedding model — 0.5 d
- [ ] 🔴 GitHub Actions: lint, test, build on every pull request — 1 d
- [ ] 🟡 Provision the dev VPS, domain name and TLS (Caddy/Nginx + Let's Encrypt) — 1 d
- [ ] 🟡 Create project board (Backlog → Ready → In progress → Review → Done) and import this TODO — 0.5 d
- [ ] 📦 `README.md` with setup steps; `.env.example` for each app

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

- [ ] 🔴 Express app skeleton: config, pino logging, error handler, request IDs, Zod validation middleware [API-01, API-06] — 2 d
- [ ] 🔴 Prisma setup; models `User`, `Device`, `PushToken`, `Conversation`, `Message`; first migration [DAT-01, DAT-02] — 2 d
- [ ] 🔴 Auth: register, login, refresh rotation, logout; argon2; JWT middleware [FR-ACC-01, DAT-04] — 3 d
- [ ] 🟡 Google sign-in endpoint — 1 d
- [ ] 🔴 Device pairing: pairing code generation, `POST /devices/pair`, hashed device token [FR-ACC-02, FR-ACC-04] — 2 d
- [ ] 🔴 User settings: language, time zone, quiet hours [FR-ACC-05] — 1 d
- [ ] 🔴 Rate limiting (Redis store) and helmet/CORS [API-04] — 1 d
- [ ] 🟡 OpenAPI generation from Zod [API-05] — 1 d
- [ ] 🔴 Ownership-isolation test helper (user A cannot read user B) [API-02, NFR-07] — 1 d

### R1.3 Device gateway and voice pipeline

- [x] 🔴 `ws` server at `/ws/device`: `hello` authentication, presence, heartbeat 30 s [GW-01, GW-03, GW-04] — 3 d
- [x] 🔴 Audio turn handling: `audio.start`, binary frames, `audio.end`, timeout — 2 d
- [x] 🔴 Silero VAD integration for end-of-speech detection [VP-01] — 2 d
- [x] 🔴 STT service: faster-whisper (Docker) with Groq Whisper fallback [VP-02] — image builds; real 16 kHz PCM fixture transcribed and Groq fallback covered by tests
- [x] 🔴 TTS service: Piper (Docker), per-language voice selection, chunked output [VP-04, VP-08] — image builds, PCM synthesis verified, `TTS_VOICE_MAP` selects a voice by language
- [x] 🔴 Sentence splitter: stream LLM tokens → sentences → TTS → device [FR-VOI-06] — 2 d
- [ ] 🟡 Stage timing metrics (VAD, STT, first token, TTS start) [VP-06] — VAD/STT/agent/TTS/first-audio logged; first token pending streaming
- [x] 🔴 Delete raw audio after transcription [VP-07] — 0.5 d
- [ ] 🔴 Fallback speech messages for errors/offline [FR-VOI-07] — STT/agent fallbacks done; offline fallback pending

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

- [ ] 🔴 Expo project with Expo Router, TypeScript, EAS development build [APP-20] — 2 d
- [ ] 🔴 Redux Toolkit store + RTK Query API slice with token refresh [APP-21] — 2 d
- [ ] 🔴 Secure token storage (`expo-secure-store`) [APP-22] — 0.5 d
- [ ] 🔴 Auth and onboarding screens (language, time zone) [APP-01] — 3 d
- [ ] 🔴 Device setup: QR scan, BLE scan, Wi-Fi provisioning, status [APP-02, FR-ACC-02/03] — 5 d
- [ ] 🔴 Chat screen with streaming text [APP-04] — 3 d
- [ ] 🟡 Permission request helper with explanations [APP-26] — 1 d

### R1.7 Quality and release

- [ ] 🔴 End-to-end voice test script (wake → question → answer) with latency report — 2 d
- [ ] 🟡 Sentry in app and server — 1 d
- [ ] 📦 **Demo:** hold a voice conversation on the device; pair from the phone

---

## R2 — Productivity (MVP complete)

**Exit criteria:** ≥ 95% of scripted productivity commands succeed; reminders fire on time (±30 s); OTA works.

### R2.1 Data models and API

- [ ] 🔴 Prisma models: `Subject`, `Topic`, `ScheduleEntry`, `ScheduleException`, `Todo`, `Reminder`, `Exam`, `ActionLog` — 2 d
- [ ] 🔴 CRUD: subjects, todos, reminders (+ snooze), schedule (+ exceptions), exams [FR-PRD-01/02, FR-CLS-01, FR-EXM-01] — 6 d
- [ ] 🔴 Time handling: UTC storage, `luxon`, `rrule` utilities with tests across DST [FR-PRD-08, DAT-03] — 3 d
- [ ] 🟡 Actions log endpoint [FR-AI-06] — 1 d
- [ ] 🟡 Push token endpoints [APP-23] — 0.5 d

### R2.2 Jobs and notifications

- [ ] 🔴 BullMQ (or pg-boss) setup with queues `reminders`, `class-alerts` [JOB-01] — 2 d
- [ ] 🔴 Schedule/unschedule jobs on create/edit/delete with deterministic job IDs [JOB-02] — 3 d
- [ ] 🔴 Reminder fire: device WebSocket + Expo push + delivery status [JOB-04, FR-PRD-04] — 3 d
- [ ] 🔴 Rebuild schedules from the database on server start [JOB-06] — 1 d
- [ ] 🔴 Pre-class alerts with exception handling [FR-CLS-03] — 2 d
- [ ] 🟡 Deadline warnings (24 h and 2 h) [FR-PRD-07] — 1 d
- [ ] 🟡 Retry/backoff and failed-job visibility [JOB-05] — 1 d
- [ ] 🔴 Measure reminder latency and meet the ±30 s target [JOB-10] — 1 d
- [ ] 🔴 Queue offline events and deliver on device reconnect [GW-06] — 2 d

### R2.3 Agent and tools

- [ ] 🔴 Tool framework: Zod in/out, `userId` from context, action logging, step limit [AGT-04, AGT-06, AGT-09] — 3 d
- [ ] 🔴 Tools: `get_schedule`, `create_todo`, `update_todo`, `complete_todo`, `list_todos`, `create_reminder`, `start_timer`, `create_alarm`, `create_exam`, `get_exam`, `device_show`, `device_speak` — 8 d
- [ ] 🔴 Confirmation flag for `delete_todo`, `cancel_reminder` (basic version) — 1 d
- [ ] 🔴 Clarifying questions for missing parameters [FR-AI-03] — 1 d
- [ ] 🔴 Reply format: `voiceText` + `displayContent` [AGT-08] — 1 d
- [ ] 🔴 Router v1: fallback chain Groq → Gemini → OpenRouter → Ollama; error classification [LLM-02, LLM-06] — 3 d
- [ ] 🔴 **Regression test set** (50+ utterances: tool choice, parameters, refusals) and runner [AGT-12] — 4 d
- [ ] 🟡 Barge-in/interrupt handling [GW-05, FR-VOI-05] — server cancels the old reply; firmware must stop playback locally

### R2.4 Firmware

- [ ] 🔴 Local cache of next 24 h reminders/alarms; ring offline [FW-08, FR-DEV-05] — 3 d
- [ ] 🔴 `timer.start`, `reminder.fire`, `reminder.sync` handling — 2 d
- [ ] 🔴 Signed OTA with rollback [FW-09, FR-DEV-02] — 4 d
- [ ] 🟡 Status telemetry [FR-DEV-04] — 1 d

### R2.5 Mobile app

- [ ] 🔴 Home screen: next class, today's tasks, exam countdown [APP-03] — 3 d
- [ ] 🔴 Tasks and reminders screens with recurrence picker [APP-05] — 4 d
- [ ] 🔴 Schedule screen with exceptions [APP-06] — 3 d
- [ ] 🔴 Push notification registration and handling [APP-23] — 2 d
- [ ] 🟡 Local notification fallback [APP-29] — 2 d
- [ ] 🟡 Device/connection status UI [APP-27] — 1 d
- [ ] 🔴 Settings and privacy: quiet hours, data export/delete request [APP-13, FR-ACC-06] — 3 d
- [ ] 🔴 Account deletion job (PostgreSQL, files, later vectors) [FR-ACC-06] — 2 d

### R2.6 Release

- [ ] 🔴 Closed alpha with 3–5 testers; collect feedback in a tracker — 5 d
- [ ] 🟡 Write the privacy notice (microphone, data use) — 1 d
- [ ] 📦 **MVP demo:** "Remind me every evening at 7", "What class is next?" by voice

---

## R3 — Study Brain

**Exit criteria:** grounded answers with citations ≥ 90% on the test set; cross-user isolation tests pass.

### R3.1 Storage and ingestion

- [ ] 🔴 MinIO/R2 setup, signed upload URLs, `Document` model [API-10, DAT-21] — 3 d
- [ ] 🔴 Upload endpoints and size/quota limits [RAG-01] — 2 d
- [ ] 🔴 `documents` queue with states uploaded → parsing → ocr → chunking → embedding → indexed/failed [RAG-02] — 3 d
- [ ] 🔴 Parsers: PDF, DOCX, PPTX, TXT/MD [RAG-03] — 4 d
- [ ] 🔴 OCR: Tesseract; vision-model fallback for handwriting/formulas [RAG-03] — 4 d
- [ ] 🔴 Chunking with page/slide metadata [RAG-04] — 2 d
- [ ] 🔴 Choose and benchmark embedding model on your languages (BGE-M3 vs multilingual-e5) [LLM-09] — 3 d
- [ ] 🔴 Qdrant collection, payload indexes, upsert [RAG-05, DAT-10/11] — 2 d

### R3.2 Retrieval and answers

- [ ] 🔴 Single retrieval helper with mandatory `userId` filter [RAG-06] — 2 d
- [ ] 🔴 **Isolation tests:** user B can never retrieve user A's chunks [NFR-07] — 1 d
- [ ] 🔴 Score threshold and "not found in your materials" behavior [RAG-07, FR-AI-07] — 2 d
- [ ] 🔴 Citations in answers (document, page) [RAG-08, FR-DOC-04] — 2 d
- [ ] 🔴 Prompt-injection defense for document text [AGT-07] — 2 d
- [ ] 🟡 Reranker experiment [RAG-09] — 2 d
- [ ] 🔴 Tools: `search_documents`, `summarize_document` [FR-DOC-05] — 3 d
- [ ] 🔴 Retrieval evaluation set (50 questions with expected sources) — 3 d

### R3.3 Quizzes, notes, plans

- [ ] 🔴 `generate_quiz` with structured output validation and retry [RAG-10, FR-DOC-06] — 4 d
- [ ] 🔴 `record_quiz_result`, attempts storage [FR-DOC-10] — 2 d
- [ ] 🔴 Class notes: models, API, tools `save_class_note`/`query_class_notes`; post-class prompt job [FR-CLS-04/05/06] — 5 d
- [ ] 🔴 `get_subject_topics`, `get_existing_tasks` [FR-EXM-04] — 2 d
- [ ] 🔴 `create_study_plan` (draft) + approval flow + todo/reminder creation [FR-EXM-02/03] — 6 d
- [ ] 🟡 Revision summary [FR-EXM-07] — 1 d
- [ ] 🟡 Formula/screenshot explanation via vision model [FR-DOC-07] — 2 d

### R3.4 AI platform hardening

- [ ] 🔴 Quota counters and degraded mode [LLM-04] — 3 d
- [ ] 🔴 "Allow cloud AI for documents" setting; local-only routing for private docs; tests with mocked providers [LLM-05] — 3 d
- [ ] 🟡 LLM usage logging [LLM-07] — 1 d
- [ ] 🟡 Model gating by regression score [LLM-08] — 2 d
- [ ] 🟡 Langfuse tracing with pseudonymized user IDs [AGT-10, DAT-32] — 2 d
- [ ] 🟡 Long-term memory tools + memory screen [FR-AI-05, AGT-11] — 3 d
- [ ] 🔴 Cleanup job for expired data, orphan files and vectors [JOB-09, RAG-11] — 2 d
- [ ] 🟡 Re-indexing job when the embedding model changes [RAG-12] — 2 d

### R3.5 Mobile app

- [ ] 🔴 Documents screen: upload (files, photos), subjects, status, delete [APP-08] — 5 d
- [ ] 🔴 Exams and plan screen with approve/edit [APP-07] — 4 d
- [ ] 🔴 Quiz runner and history [APP-09] — 4 d
- [ ] 🔴 Chat: rich cards (plans, quizzes, tappable citations) — 3 d
- [ ] 🟡 i18n and right-to-left support [APP-28] — 3 d
- [ ] 🟡 Second voice language: STT/TTS/wake word [FR-VOI-09] — 4 d

### R3.6 Release

- [ ] 🔴 Closed beta with students using real course material — 10 d
- [ ] 📦 **Demo:** upload a textbook, ask a question with citation, generate 10 MCQs

---

## R4 — Communication

**Exit criteria:** no call or message executes without confirmation; zero wrong-recipient cases in tests.

- [ ] 🔴 `Contact` and `PendingAction` models, API, expiry job (5 min) [API-12] — 3 d
- [ ] 🔴 Contact import from phone with consent; groups [FR-COM-01, APP-10] — 3 d
- [ ] 🔴 `find_contact` with ambiguity handling [FR-COM-05] — 2 d
- [ ] 🔴 LangGraph human-in-the-loop pause/resume for confirmable tools [AGT-05] — 4 d
- [ ] 🔴 App WebSocket + push for `action.confirm.request` / `action.execute` [GW-02, APP-24] — 4 d
- [ ] 🔴 `prepare_call` → confirm → `tel:` dialer [FR-COM-02, APP-25] — 2 d
- [ ] 🔴 `prepare_message` → confirm → SMS composer [FR-COM-03] — 2 d
- [ ] 🟡 WhatsApp (`wa.me`) and email composer drafts [FR-COM-04] — 2 d
- [ ] 🟡 "Remind me to call X after class" [FR-COM-06] — 1 d
- [ ] 🟡 Confirm by voice on the device as well as by tap — 2 d
- [ ] 🟡 Action history and contact deletion UI [FR-COM-08] — 2 d
- [ ] 🟢 Missed-call follow-up where permitted [FR-COM-07] — 2 d
- [ ] 🟢 Timetable import from photo (OCR + review) [FR-CLS-08] — 4 d
- [ ] 🔴 Tests: wrong-recipient, expired action, rejected action, duplicate confirm — 3 d
- [ ] 🟡 Review Google Play policy requirements for contacts/SMS/phone before submitting — 1 d
- [ ] 📦 **Demo:** "Call Mom" and "Send Ahmed a message…" with confirmation

---

## R5 — Proactive (Study Mode and Analytics)

**Exit criteria:** study session works end to end on device and app; nudges respect quiet hours.

### R5.1 Study mode

- [ ] 🔴 `StudySession` model, API (start, pause, resume, extend, end) [FR-STM-01/04/06] — 3 d
- [ ] 🔴 Tools `start_study_session` / `end_study_session` [FR-STM-01] — 2 d
- [ ] 🔴 Device: timer screen, end announcement, break suggestion [FR-STM-02/03] — 4 d
- [ ] 🔴 App session screen mirroring the device [APP-11] — 3 d
- [ ] 🟡 Do Not Disturb prompt [FR-STM-05] — 1 d
- [ ] 🟢 Pomodoro cycles — 2 d

### R5.2 Analytics and proactivity

- [ ] 🔴 `DailyStats` model and nightly aggregation job [JOB-07, FR-ANL-01] — 3 d
- [ ] 🔴 `get_analytics` tool and weekly summaries [FR-ANL-02] — 2 d
- [ ] 🟡 Dashboard charts in app [APP-12, FR-ANL-05] — 4 d
- [ ] 🟡 Trends per subject [FR-ANL-03] — 2 d
- [ ] 🟡 Nudge rules engine with quiet hours and daily caps [JOB-08, FR-ANL-04] — 4 d
- [ ] 🟡 "What should I do today?" planner and multi-intent handling [FR-ANL-06, FR-AI-08] — 4 d
- [ ] 🟡 Readiness score and plan recalculation [FR-EXM-05/06] — 5 d

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

## X — Cross-Cutting Tasks (continuous)

### X.1 Security and privacy

- [ ] 🔴 Threat model (device, API, AI prompt injection, vector isolation) — 3 d
- [ ] 🔴 TLS everywhere; secrets in a secret manager, none in app or firmware repo — 1 d
- [ ] 🔴 Secure boot + flash encryption plan for production devices — 3 d
- [ ] 🔴 Consent records (microphone, contacts, documents, cloud AI) — 2 d
- [ ] 🔴 Data export and deletion verified end to end (PostgreSQL, Qdrant, Redis, files) [DAT-31] — 2 d
- [ ] 🟡 Guardian consent flow for minors if in scope [FR-ACC-07] — 3 d
- [ ] 🟡 Dependency vulnerability scanning in CI — 0.5 d
- [ ] 🟡 Legal review: terms of service, privacy policy, third-party AI provider terms — external

### X.2 Testing and evaluation

- [ ] 🔴 Unit and integration tests (Vitest/Jest, Supertest) for each module
- [ ] 🔴 Maintain AI regression set; run it on every prompt/model change [AGT-12, NFR-08]
- [ ] 🟡 Mobile end-to-end flows with Maestro
- [ ] 🟡 Firmware tests (Unity) and a manual device test checklist
- [ ] 🟡 Load test: 500 concurrent device sessions [NFR-11]
- [ ] 🟡 Latency dashboard for the voice pipeline [NFR-01]

### X.3 DevOps and operations

- [ ] 🔴 Staging and production environments; database backups with restore test
- [ ] 🔴 Monitoring and alerts (Sentry, uptime check, queue depth)
- [ ] 🟡 Log shipping and retention policy
- [ ] 🟡 EAS Update channels (staging/production); OTA firmware channels
- [ ] 🟡 Runbook: provider outage, queue backlog, Qdrant restore

### X.4 Launch

- [ ] 🔴 Beta program (20–50 students), feedback loop, bug triage
- [ ] 🔴 Play Store listing, data-safety form, privacy policy URL
- [ ] 🟡 User guide and device quick-start card
- [ ] 🟡 Support channel and FAQ
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
4. [ ] Monorepo, Docker Compose, CI (P0.4)
5. [ ] Voice spike: record and play back on ESP32-S3 (P0.5)
6. [ ] Latency spike on a laptop: Whisper → LLM → Piper (P0.5)
7. [ ] Expo development build with BLE scan (P0.5)
8. [x] Express skeleton + Prisma + auth (R1.2)

---

_End of document._
