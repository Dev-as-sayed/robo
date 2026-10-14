# Student AI Assistant — Functional Requirements (Stack-Based, v2)

| Field                  | Value                                                                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Product**            | Student AI Assistant (ESP32 voice device + Expo mobile app + Express/LangChain cloud backend)                                                                                                                                                         |
| **Document version**   | 2.0 (Draft)                                                                                                                                                                                                                                           |
| **Date**               | 14 Oct 2026                                                                                                                                                                                                                                           |
| **Replaces / extends** | `Student_Assistant_FRD.md` (v1). Product scope is unchanged; v2 binds every requirement to the technology choices in `stack.md`                                                                                                                       |
| **Stack baseline**     | Expo (React Native, TypeScript) · Express (TypeScript) · LangChain.js + LangGraph.js · PostgreSQL (Prisma) · Qdrant · Redis + BullMQ · WebSocket (`ws`) · Gemini / Groq / OpenRouter / Ollama · Whisper + Piper · ESP32-S3 (ESP-IDF, ESP-ADF, ESP-SR) |

---

## Table of Contents

1. [Purpose and How to Read This Document](#1-purpose-and-how-to-read-this-document)
2. [System Components and Responsibilities](#2-system-components-and-responsibilities)
3. [Part A: Feature Requirements (user-facing)](#3-part-a-feature-requirements-user-facing)
4. [Part B: Component Requirements](#4-part-b-component-requirements)
   - 4.1 Mobile App (Expo)
   - 4.2 Backend REST API (Express)
   - 4.3 Device Gateway and WebSocket Protocol
   - 4.4 Voice Pipeline
   - 4.5 AI Agent (LangGraph)
   - 4.6 LLM Router (free models)
   - 4.7 Agent Tool Specifications
   - 4.8 Document and RAG Pipeline (Qdrant)
   - 4.9 Jobs, Scheduling and Notifications
   - 4.10 Firmware (ESP32-S3)
5. [Data Requirements](#5-data-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Release Plan and Management](#7-release-plan-and-management)
8. [Acceptance Criteria](#8-acceptance-criteria)
9. [Risks, Assumptions, Open Questions](#9-risks-assumptions-open-questions)
10. [Traceability](#10-traceability)

---

## 1. Purpose and How to Read This Document

This document defines **what the system must do**, organized so each requirement can be assigned to a specific part of the chosen stack.

- **Part A** lists user-facing features. Each row names the components that implement it.
- **Part B** lists requirements for each technical component (screens, endpoints, protocol messages, agent behavior, pipelines, firmware).
- **Priority (MoSCoW):** M = Must, S = Should, C = Could.
- **Release:** R1 to R6, matching the roadmap in §7.
- **Component codes:** `APP` Expo app · `API` Express REST · `GW` WebSocket gateway · `AGT` LangGraph agent · `LLM` model router · `RAG` document pipeline + Qdrant · `JOB` BullMQ workers · `FW` ESP32 firmware · `STT/TTS` speech services · `DB` PostgreSQL.

ID format: `FR-<AREA>-<NN>` for features, `<COMPONENT>-<NN>` for component requirements.

---

## 2. System Components and Responsibilities

| Component          | Stack                                                       | Responsibilities                                                                                                                                                         |
| ------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Mobile app**     | Expo, TypeScript, Expo Router, Redux Toolkit + RTK Query    | Onboarding, device pairing, rich UI (todos, schedule, exams, documents, analytics), notifications, contacts, call/SMS/WhatsApp/email intents, document upload, text chat |
| **REST API**       | Express, Zod, Prisma, JWT                                   | CRUD for all domain data, auth, uploads, analytics queries                                                                                                               |
| **Device gateway** | `ws` WebSocket server                                       | Device sessions, audio streaming in/out, control messages, app event channel                                                                                             |
| **Voice services** | Silero VAD, faster-whisper or Groq Whisper, Piper           | Detect end of speech, transcribe, synthesize replies                                                                                                                     |
| **AI agent**       | LangChain.js, LangGraph.js, Zod tools                       | Understand requests, call tools, ask for confirmation, produce answers                                                                                                   |
| **LLM router**     | LangChain model wrappers (Gemini, Groq, OpenRouter, Ollama) | Select model per task, fallback, quotas, degraded mode                                                                                                                   |
| **RAG pipeline**   | Parsers, Tesseract, embedding model, Qdrant                 | Ingest documents, retrieve with citations, generate quizzes                                                                                                              |
| **Jobs**           | Redis, BullMQ, `rrule`, `luxon`                             | Reminders, class alerts, document processing, analytics, nudges                                                                                                          |
| **Notifications**  | Expo Push Service, device WebSocket                         | Deliver alerts to phone and device                                                                                                                                       |
| **Data stores**    | PostgreSQL, Qdrant, Redis, MinIO/R2                         | Relational data, vectors, queues/cache, files                                                                                                                            |
| **Firmware**       | ESP-IDF, ESP-ADF, ESP-SR, LVGL                              | Wake word, audio capture/playback, display, buttons, OTA, local reminder cache                                                                                           |
| **Observability**  | pino, Sentry, Langfuse                                      | Logs, errors, AI traces                                                                                                                                                  |

---

## 3. Part A: Feature Requirements (user-facing)

### 3.1 Account, Pairing and Setup (ACC)

| ID        | Requirement                                                                                                                       | Pri | Rel | Components    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ------------- |
| FR-ACC-01 | A student can register and sign in with email/password or Google sign-in.                                                         | M   | R1  | APP, API      |
| FR-ACC-02 | A student can pair an ESP32 device by scanning a QR code or entering a pairing code.                                              | M   | R1  | APP, API, FW  |
| FR-ACC-03 | The app provisions the device's Wi-Fi credentials over Bluetooth Low Energy.                                                      | M   | R1  | APP, FW       |
| FR-ACC-04 | A student can rename, unpair, factory-reset and revoke a device from the app.                                                     | M   | R1  | APP, API, FW  |
| FR-ACC-05 | A student can set language, time zone, wake phrase (from supported options) and quiet hours.                                      | M   | R1  | APP, API, FW  |
| FR-ACC-06 | A student can export all personal data and delete the account; deletion removes PostgreSQL rows, Qdrant vectors and stored files. | M   | R2  | API, JOB, RAG |
| FR-ACC-07 | Users under the legal age threshold require guardian consent before activation.                                                   | S   | R2  | APP, API      |
| FR-ACC-08 | A student can pair multiple devices to one account.                                                                               | C   | R6  | APP, API, GW  |

### 3.2 Voice Interaction (VOI)

| ID        | Requirement                                                                                                              | Pri | Rel | Components           |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | --- | --- | -------------------- |
| FR-VOI-01 | The device detects the wake phrase on-device and only then streams audio to the server.                                  | M   | R1  | FW                   |
| FR-VOI-02 | The student's speech is transcribed and the reply is spoken on the device.                                               | M   | R1  | FW, GW, STT/TTS, AGT |
| FR-VOI-03 | The device shows state through LED/display: idle, listening, thinking, speaking, muted, error.                           | M   | R1  | FW, GW               |
| FR-VOI-04 | A hardware mute switch disables the microphone and shows a visible indicator.                                            | M   | R1  | FW                   |
| FR-VOI-05 | The student can interrupt a spoken reply with the talk button or the wake phrase.                                        | S   | R2  | FW, GW               |
| FR-VOI-06 | Replies begin speaking after the first complete sentence is ready (sentence-level TTS streaming).                        | M   | R1  | GW, TTS, AGT         |
| FR-VOI-07 | When offline or when AI fails, the device speaks a clear fallback message and keeps local alarms working.                | M   | R1  | FW, GW               |
| FR-VOI-08 | Voice answers are short by default; the full answer is sent to the app when the content is long (lists, plans, quizzes). | S   | R2  | AGT, APP, GW         |
| FR-VOI-09 | Voice works in at least English plus one additional configured language.                                                 | S   | R3  | STT/TTS, LLM, FW     |

### 3.3 AI Conversation and Memory (AI)

| ID       | Requirement                                                                                                                                                      | Pri | Rel | Components    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ------------- |
| FR-AI-01 | The student can chat by text in the app and by voice on the device with shared conversation history.                                                             | M   | R1  | APP, API, AGT |
| FR-AI-02 | The agent chooses tools from natural requests; the student never selects a feature.                                                                              | M   | R2  | AGT           |
| FR-AI-03 | The agent asks one clarifying question when required parameters are missing or ambiguous.                                                                        | M   | R2  | AGT           |
| FR-AI-04 | Outward or destructive actions (call, message, delete) require explicit confirmation, by voice or tap.                                                           | M   | R4  | AGT, APP, GW  |
| FR-AI-05 | The student can view, edit and delete long-term memory items.                                                                                                    | S   | R3  | APP, API, AGT |
| FR-AI-06 | Every tool call is logged with input, output, status and duration; the student can see an action history.                                                        | M   | R2  | AGT, DB, APP  |
| FR-AI-07 | The agent states when it cannot find an answer in the student's documents instead of inventing one.                                                              | M   | R3  | AGT, RAG      |
| FR-AI-08 | Multi-intent requests ("I have class at 10, an assignment due tomorrow and an exam next week. What should I do today?") are decomposed and answered in one plan. | S   | R5  | AGT           |

### 3.4 Productivity: Todos, Reminders, Alarms (PRD)

| ID        | Requirement                                                                      | Pri | Rel | Components         |
| --------- | -------------------------------------------------------------------------------- | --- | --- | ------------------ |
| FR-PRD-01 | Create, view, edit, complete and delete todos by voice or app.                   | M   | R2  | AGT, API, APP      |
| FR-PRD-02 | Todo fields: title, notes, due date/time, subject, priority, status.             | M   | R2  | DB, API            |
| FR-PRD-03 | One-time and recurring reminders ("every evening at 7") using recurrence rules.  | M   | R2  | AGT, API, JOB      |
| FR-PRD-04 | Reminders are delivered to the device (voice + display) and to the phone (push). | M   | R2  | JOB, GW, Expo Push |
| FR-PRD-05 | Alarms and countdown timers run on the device and survive short network loss.    | S   | R2  | FW, GW             |
| FR-PRD-06 | Snooze and dismiss from the device button, voice, or notification.               | S   | R2  | FW, APP, API       |
| FR-PRD-07 | Assignment deadlines produce advance warnings (default 24 h and 2 h).            | S   | R2  | JOB                |
| FR-PRD-08 | Time zones and daylight-saving changes are handled correctly.                    | M   | R2  | API, JOB           |

### 3.5 Class Schedule and Class-Aware AI (CLS)

| ID        | Requirement                                                                                          | Pri | Rel | Components         |
| --------- | ---------------------------------------------------------------------------------------------------- | --- | --- | ------------------ |
| FR-CLS-01 | Create and edit a weekly timetable (subject, day, time, room, teacher).                              | M   | R2  | APP, API           |
| FR-CLS-02 | Ask "What class do I have next?" and "What's my schedule tomorrow?" by voice or text.                | M   | R2  | AGT, API           |
| FR-CLS-03 | A pre-class reminder is sent before each class (default 10 minutes, configurable per student/class). | M   | R2  | JOB, GW, Expo Push |
| FR-CLS-04 | After class ends, the assistant asks what the student learned.                                       | S   | R3  | JOB, GW, APP       |
| FR-CLS-05 | Class notes are stored by subject, topic and date.                                                   | S   | R3  | API, DB            |
| FR-CLS-06 | Ask "What did I learn in C++ this week?" and receive a summary of saved notes.                       | S   | R3  | AGT                |
| FR-CLS-07 | One-off exceptions (cancelled or moved class) override the weekly rule.                              | S   | R3  | APP, API, JOB      |
| FR-CLS-08 | Import a timetable from a photo or file using OCR and review before saving.                          | C   | R4  | APP, RAG, LLM      |

### 3.6 Exam Assistant (EXM)

| ID        | Requirement                                                                                                                                     | Pri | Rel | Components    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ------------- |
| FR-EXM-01 | Create an exam by voice or app (subject, date, optional topics, weight).                                                                        | M   | R2  | AGT, API, APP |
| FR-EXM-02 | Generate a study plan: topics → daily tasks → reminders → revision → practice questions.                                                        | M   | R3  | AGT, LLM, API |
| FR-EXM-03 | The plan accounts for days left, class schedule and existing tasks; the student reviews and approves it before todos and reminders are created. | M   | R3  | AGT, APP      |
| FR-EXM-04 | Topics are proposed from uploaded material when available.                                                                                      | S   | R3  | AGT, RAG      |
| FR-EXM-05 | The plan is recalculated when tasks are missed or the exam date changes.                                                                        | S   | R5  | AGT, JOB      |
| FR-EXM-06 | "How prepared am I?" returns a readiness assessment from sessions, quiz results and remaining topics.                                           | S   | R5  | AGT, API      |
| FR-EXM-07 | A short last-minute revision summary can be requested.                                                                                          | S   | R3  | AGT, RAG      |
| FR-EXM-08 | A countdown to the next exam is shown on the device and in the app.                                                                             | C   | R5  | FW, APP       |

### 3.7 Personal Study Brain: Documents and Quizzes (DOC)

| ID        | Requirement                                                                                                   | Pri | Rel | Components        |
| --------- | ------------------------------------------------------------------------------------------------------------- | --- | --- | ----------------- |
| FR-DOC-01 | Upload PDFs, slides, documents, notes and images/screenshots from the phone.                                  | M   | R3  | APP, API, RAG     |
| FR-DOC-02 | Uploaded files are parsed, chunked, embedded and indexed; the app shows processing status.                    | M   | R3  | RAG, JOB, APP     |
| FR-DOC-03 | Scanned pages and images are processed with OCR.                                                              | S   | R3  | RAG               |
| FR-DOC-04 | Answers based on documents cite document name and page/slide.                                                 | M   | R3  | AGT, RAG          |
| FR-DOC-05 | "Explain today's lecture" summarizes a selected document or the latest class material.                        | M   | R3  | AGT, RAG          |
| FR-DOC-06 | "Make 10 MCQs from chapter 3" generates a quiz of the requested type and count with answers and explanations. | M   | R3  | AGT, LLM, APP     |
| FR-DOC-07 | "I don't understand this formula" explains a formula or screenshot step by step.                              | S   | R3  | AGT, LLM (vision) |
| FR-DOC-08 | Documents can be organized by subject and deleted, which also removes their vectors and files.                | M   | R3  | APP, API, RAG     |
| FR-DOC-09 | Documents are private to the owner, never shared across users and never used for model training.              | M   | R3  | RAG, LLM          |
| FR-DOC-10 | Quiz attempts are saved and feed analytics and exam readiness.                                                | S   | R3  | API, DB           |

### 3.8 Study Mode (STM)

| ID        | Requirement                                                                                                 | Pri | Rel | Components          |
| --------- | ----------------------------------------------------------------------------------------------------------- | --- | --- | ------------------- |
| FR-STM-01 | Start a study session by voice, device button or app with subject, topic and duration (default 50 minutes). | M   | R5  | FW, APP, AGT, API   |
| FR-STM-02 | The device shows the countdown, subject and topic; the app mirrors the session.                             | M   | R5  | FW, APP, GW         |
| FR-STM-03 | At the end the device announces completion and suggests a break (default 10 minutes).                       | M   | R5  | FW, GW              |
| FR-STM-04 | Pause, resume, extend and cancel a session.                                                                 | S   | R5  | FW, APP, API        |
| FR-STM-05 | The app asks to enable Do Not Disturb during sessions where the platform allows it.                         | S   | R5  | APP                 |
| FR-STM-06 | Completed sessions are stored and update todo and plan progress.                                            | M   | R5  | API, DB             |
| FR-STM-07 | App blocking during sessions on Android.                                                                    | C   | R6  | APP (native module) |

### 3.9 Communication Assistant (COM)

| ID        | Requirement                                                                                                                                               | Pri | Rel | Components   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | ------------ |
| FR-COM-01 | Contacts are imported from the phone (with permission) and grouped: Family, Teachers, Classmates, Friends.                                                | M   | R4  | APP, API     |
| FR-COM-02 | "Call Mom": the agent resolves the contact, the app asks for confirmation, then opens the dialer.                                                         | M   | R4  | AGT, GW, APP |
| FR-COM-03 | "Send Ahmed a message saying I'll be 10 minutes late": the agent drafts the text; the app shows it for confirmation and opens the SMS composer prefilled. | M   | R4  | AGT, APP     |
| FR-COM-04 | WhatsApp and email messages are prepared with prefilled text; the student taps send.                                                                      | S   | R4  | AGT, APP     |
| FR-COM-05 | Ambiguous names (two contacts named Ahmed) trigger a choice question.                                                                                     | M   | R4  | AGT          |
| FR-COM-06 | "Remind me to call Ahmed after class" creates a reminder linked to the schedule.                                                                          | S   | R4  | AGT, JOB     |
| FR-COM-07 | Missed-call follow-up offers to call back or send a message where platform permissions allow.                                                             | C   | R4  | APP          |
| FR-COM-08 | The history of assistant-initiated communication is visible and contact data can be deleted.                                                              | M   | R4  | APP, API     |

### 3.10 Analytics and Proactive Behavior (ANL)

| ID        | Requirement                                                                                                | Pri | Rel | Components         |
| --------- | ---------------------------------------------------------------------------------------------------------- | --- | --- | ------------------ |
| FR-ANL-01 | The system records study hours, completed and missed tasks, quiz scores and subjects.                      | M   | R5  | API, DB            |
| FR-ANL-02 | Weekly summaries by voice or app ("How much did I study this week?").                                      | M   | R5  | AGT, API           |
| FR-ANL-03 | Subject trends are shown (e.g., quiz score change).                                                        | S   | R5  | APP, API           |
| FR-ANL-04 | Proactive nudges ("You haven't studied mathematics for 4 days") respect quiet hours and per-type settings. | S   | R5  | JOB, Expo Push, GW |
| FR-ANL-05 | The app has a dashboard with charts for hours, tasks and scores.                                           | S   | R5  | APP                |
| FR-ANL-06 | "What should I do today?" returns a prioritized plan from schedule, deadlines and exams.                   | S   | R5  | AGT                |

### 3.11 Device Experience (DEV)

| ID        | Requirement                                                                             | Pri | Rel | Components  |
| --------- | --------------------------------------------------------------------------------------- | --- | --- | ----------- |
| FR-DEV-01 | The device reconnects to Wi-Fi and the server automatically.                            | M   | R1  | FW          |
| FR-DEV-02 | Signed over-the-air firmware updates, with rollback on failure.                         | M   | R2  | FW, API     |
| FR-DEV-03 | The display shows time, next class, timer and status.                                   | S   | R5  | FW          |
| FR-DEV-04 | The device reports status (firmware version, Wi-Fi strength, last seen) to the backend. | S   | R2  | FW, GW, APP |
| FR-DEV-05 | The device keeps upcoming reminders and alarms (next 24 h) in local storage.            | S   | R2  | FW, GW      |
| FR-DEV-06 | Optional sensors (light, temperature) can be read and reported.                         | C   | R5  | FW          |
| FR-DEV-07 | Camera, expression and multi-device synchronization features.                           | C   | R6  | FW, APP, GW |

---

## 4. Part B: Component Requirements

### 4.1 Mobile App (Expo)

**Screens**

| ID     | Screen                | Contents                                                                                                      | Pri | Rel |
| ------ | --------------------- | ------------------------------------------------------------------------------------------------------------- | --- | --- |
| APP-01 | Auth and onboarding   | Sign up, sign in, language, time zone, permissions explanation                                                | M   | R1  |
| APP-02 | Device setup          | QR scan, BLE scan, Wi-Fi provisioning, status check, device list                                              | M   | R1  |
| APP-03 | Home                  | Next class, today's tasks, next exam countdown, quick chat input                                              | M   | R2  |
| APP-04 | Chat                  | Text conversation, voice-note input, confirmation cards for actions, rich results (plans, quizzes, citations) | M   | R1  |
| APP-05 | Tasks and reminders   | List, filters by subject/status, create/edit, recurrence picker                                               | M   | R2  |
| APP-06 | Schedule              | Weekly timetable, exceptions, class notes per class                                                           | M   | R2  |
| APP-07 | Exams and study plans | Exam list, plan view with approve/edit, readiness                                                             | M   | R3  |
| APP-08 | Documents             | Upload, subject folders, processing status, delete, open with citations                                       | M   | R3  |
| APP-09 | Quizzes               | Quiz runner, results, history                                                                                 | M   | R3  |
| APP-10 | Contacts and actions  | Contact groups, action history                                                                                | M   | R4  |
| APP-11 | Study session         | Live timer, pause/extend/cancel, DND prompt                                                                   | S   | R5  |
| APP-12 | Analytics             | Charts, weekly summary, trends                                                                                | S   | R5  |
| APP-13 | Settings and privacy  | Memory viewer, quiet hours, nudge settings, data export/delete, consent controls                              | M   | R2  |

**Behavior**

| ID     | Requirement                                                                                                                                                                                                   | Pri | Rel |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| APP-20 | The app uses Expo Router for navigation and EAS development builds (required for BLE and other native modules).                                                                                               | M   | R1  |
| APP-21 | Server data is fetched and cached with RTK Query; tags invalidate lists after mutations.                                                                                                                      | M   | R1  |
| APP-22 | Access and refresh tokens are stored in `expo-secure-store`; no AI provider keys exist in the app.                                                                                                            | M   | R1  |
| APP-23 | The app registers an Expo push token and sends it to the API on login and on token change.                                                                                                                    | M   | R2  |
| APP-24 | The app listens on a WebSocket (when foregrounded) and via push (when backgrounded) for assistant actions such as call/message prepare and confirmation requests.                                             | M   | R4  |
| APP-25 | For call actions the app opens `tel:`; for SMS it uses `expo-sms`; for WhatsApp it opens `https://wa.me/<number>?text=`; for email it uses the mail composer. Each requires the student's confirmation first. | M   | R4  |
| APP-26 | Permissions (notifications, contacts, camera, Bluetooth, files) are requested only when the related feature is first used, with an explanation.                                                               | M   | R1  |
| APP-27 | The app shows connection and device state (online, offline, updating) and queued actions.                                                                                                                     | S   | R2  |
| APP-28 | UI strings use `i18next`; layouts support right-to-left languages.                                                                                                                                            | S   | R3  |
| APP-29 | Local notifications act as a fallback for upcoming reminders when the server is unreachable.                                                                                                                  | S   | R2  |

### 4.2 Backend REST API (Express)

**General rules**

| ID     | Requirement                                                                                                             | Pri |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | --- |
| API-01 | All routes are under `/api/v1`, validated with Zod, and return a consistent error shape (`code`, `message`, `details`). | M   |
| API-02 | All data access is scoped by the authenticated `userId`; cross-user access returns 404.                                 | M   |
| API-03 | Pagination (`cursor`, `limit`) on all list endpoints.                                                                   | M   |
| API-04 | Rate limiting per user and per IP, stricter on AI and upload endpoints.                                                 | M   |
| API-05 | OpenAPI documentation is generated from Zod schemas.                                                                    | S   |
| API-06 | Request IDs propagate to logs (pino) and Sentry.                                                                        | S   |

**Endpoints (initial set)**

| Area            | Endpoints                                                                                                                                                 | Rel   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Auth            | `POST /auth/register`, `/auth/login`, `/auth/google`, `/auth/refresh`, `/auth/logout`                                                                     | R1    |
| User            | `GET/PATCH /me`, `POST /me/export`, `DELETE /me`                                                                                                          | R1–R2 |
| Devices         | `POST /devices/pair`, `GET /devices`, `PATCH /devices/:id`, `DELETE /devices/:id`, `POST /devices/:id/revoke`, `GET /devices/:id/firmware`                | R1–R2 |
| Push            | `POST /push-tokens`, `DELETE /push-tokens/:token`                                                                                                         | R2    |
| Chat            | `POST /chat/messages` (text), `GET /chat/conversations`, `GET /chat/conversations/:id`, `POST /chat/actions/:id/confirm`, `POST /chat/actions/:id/reject` | R1–R4 |
| Todos           | `GET/POST /todos`, `GET/PATCH/DELETE /todos/:id`                                                                                                          | R2    |
| Reminders       | `GET/POST /reminders`, `PATCH/DELETE /reminders/:id`, `POST /reminders/:id/snooze`                                                                        | R2    |
| Schedule        | `GET/POST /schedule`, `PATCH/DELETE /schedule/:id`, `POST /schedule/:id/exceptions`                                                                       | R2–R3 |
| Class notes     | `GET/POST /class-notes`, `PATCH/DELETE /class-notes/:id`                                                                                                  | R3    |
| Subjects        | `GET/POST /subjects`, `PATCH/DELETE /subjects/:id`, `GET /subjects/:id/topics`                                                                            | R2    |
| Exams and plans | `GET/POST /exams`, `PATCH/DELETE /exams/:id`, `POST /exams/:id/plan`, `POST /plans/:id/approve`, `GET /exams/:id/readiness`                               | R2–R5 |
| Documents       | `POST /documents/upload-url`, `POST /documents`, `GET /documents`, `GET /documents/:id`, `DELETE /documents/:id`                                          | R3    |
| Quizzes         | `POST /quizzes/generate`, `GET /quizzes`, `GET /quizzes/:id`, `POST /quizzes/:id/attempts`                                                                | R3    |
| Study sessions  | `POST /study-sessions`, `PATCH /study-sessions/:id` (pause/resume/extend/end), `GET /study-sessions`                                                      | R5    |
| Contacts        | `GET/POST /contacts`, `PATCH/DELETE /contacts/:id`, `POST /contacts/import`                                                                               | R4    |
| Actions log     | `GET /actions`                                                                                                                                            | R2    |
| Memory          | `GET /memory`, `PATCH/DELETE /memory/:id`                                                                                                                 | R3    |
| Analytics       | `GET /analytics/summary?range=`, `GET /analytics/subjects/:id`                                                                                            | R5    |

| ID     | Requirement                                                                                                                             | Pri | Rel |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| API-10 | Document upload uses a signed URL to MinIO/R2; the API records metadata and enqueues a processing job after the client confirms upload. | M   | R3  |
| API-11 | `POST /chat/messages` streams the response using server-sent events or chunked responses so the app can show tokens as they arrive.     | S   | R1  |
| API-12 | Chat actions requiring confirmation are stored as `PendingAction` rows with expiry (default 5 minutes).                                 | M   | R4  |
| API-13 | Plan generation is asynchronous when slow; the API returns a job reference and the app polls or receives a push.                        | S   | R3  |

### 4.3 Device Gateway and WebSocket Protocol

| ID    | Requirement                                                                                                                                                  | Pri | Rel |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| GW-01 | The device connects to `wss://<host>/ws/device` and authenticates with its per-device token in the first message.                                            | M   | R1  |
| GW-02 | The app connects to `wss://<host>/ws/app` and authenticates with its access token.                                                                           | M   | R4  |
| GW-03 | The gateway keeps device presence (online/offline, last seen) and exposes it through the API.                                                                | M   | R1  |
| GW-04 | Heartbeats every 30 seconds; the server closes idle sessions after a timeout and the device reconnects with backoff.                                         | M   | R1  |
| GW-05 | One active voice turn per device; a new turn cancels the previous one (barge-in).                                                                            | S   | R2  |
| GW-06 | The gateway routes server-initiated events (reminders, timers, display updates) to connected devices and queues them when offline for delivery on reconnect. | M   | R2  |

**Device → Server messages**

| Type             | Payload                                       | Purpose                              |
| ---------------- | --------------------------------------------- | ------------------------------------ |
| `hello`          | deviceId, token, firmwareVersion, locale      | Authenticate                         |
| `audio.start`    | codec (`pcm16` or `opus`), sampleRate, turnId | Begin voice turn                     |
| _(binary frame)_ | audio bytes                                   | Audio chunks                         |
| `audio.end`      | turnId                                        | End of speech or button release      |
| `button`         | name (`talk`, `mute`, `study`), state         | Physical inputs                      |
| `status`         | wifiRssi, uptime, battery?, sensors?          | Telemetry                            |
| `timer.event`    | timerId, event (`done`, `cancelled`)          | Local timer results                  |
| `ack`            | messageId                                     | Confirm receipt of reminders/updates |

**Server → Device messages**

| Type                                 | Payload                                       | Purpose                            |
| ------------------------------------ | --------------------------------------------- | ---------------------------------- |
| `state`                              | idle, listening, thinking, speaking, error    | Drive LED/display                  |
| `transcript`                         | turnId, text (optional)                       | Show what was heard                |
| `tts.start` / _(binary)_ / `tts.end` | turnId, codec, sampleRate                     | Spoken reply streaming             |
| `display.update`                     | screen, fields (next class, timer, countdown) | Update UI                          |
| `reminder.fire`                      | reminderId, text, speak (bool)                | Alert                              |
| `reminder.sync`                      | list of reminders/alarms for the next 24 h    | Local cache                        |
| `timer.start`                        | timerId, seconds, label                       | Start local timer or study session |
| `ota.available`                      | version, url, signature                       | Firmware update                    |
| `error`                              | code, message                                 | Spoken or displayed fallback       |

**Server → App events:** `action.confirm.request` (call/message/delete), `action.execute` (open dialer or composer after confirmation), `device.status`, `document.status`, `plan.ready`.

### 4.4 Voice Pipeline

| ID    | Requirement                                                                                                                                                                          | Pri | Rel |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| VP-01 | Audio is received as 16 kHz mono PCM16 (Opus optional), buffered per turn and processed by server-side Silero VAD to detect end of speech when the device does not send `audio.end`. | M   | R1  |
| VP-02 | Speech-to-text uses faster-whisper (self-hosted) or Groq Whisper, selected by configuration with automatic fallback.                                                                 | M   | R1  |
| VP-03 | The recognized text is passed to the agent together with the user's locale and device context.                                                                                       | M   | R1  |
| VP-04 | The agent's reply stream is split into sentences; each sentence is sent to Piper TTS and streamed to the device as soon as available.                                                | M   | R1  |
| VP-05 | Long structured replies (plans, quizzes, tables) are summarized for voice and sent in full to the app chat.                                                                          | S   | R2  |
| VP-06 | The pipeline records stage timings (VAD, STT, first token, TTS start) for latency tracking.                                                                                          | S   | R1  |
| VP-07 | Raw audio is deleted after transcription unless the user opted in to retention.                                                                                                      | M   | R1  |
| VP-08 | The pipeline supports configuring language per user and selecting the matching STT language and TTS voice.                                                                           | S   | R3  |

### 4.5 AI Agent (LangGraph)

| ID     | Requirement                                                                                                                                   | Pri | Rel |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| AGT-01 | A single LangGraph agent with grouped tools (Personal, Education, Productivity, Communication, Device).                                       | M   | R2  |
| AGT-02 | The system prompt includes the student's name, locale, time zone, current date/time, device presence and a compact memory summary.            | M   | R2  |
| AGT-03 | Conversation state is persisted in PostgreSQL via a LangGraph checkpointer, keyed by conversation ID.                                         | M   | R1  |
| AGT-04 | Tool inputs and outputs are validated with Zod; invalid tool arguments trigger a bounded retry (max 2) before the agent explains the failure. | M   | R2  |
| AGT-05 | Tools marked `requiresConfirmation` pause the graph (human-in-the-loop), create a `PendingAction`, and resume only after confirm or reject.   | M   | R4  |
| AGT-06 | Tools receive `userId` from the authenticated context, never from model output.                                                               | M   | R2  |
| AGT-07 | Retrieved document text is treated as data; instructions inside documents are ignored (prompt-injection defense).                             | M   | R3  |
| AGT-08 | The agent produces both a `voiceText` (short) and `displayContent` (rich, optional) for each reply.                                           | S   | R2  |
| AGT-09 | A maximum number of tool-call steps per turn (default 8) prevents loops.                                                                      | M   | R2  |
| AGT-10 | Every run is traced in Langfuse (prompt, model, tools, tokens, latency) with user identifiers pseudonymized.                                  | S   | R3  |
| AGT-11 | Long-term memory writes (`save_memory`) are limited to stable facts and preferences and are visible to the student.                           | S   | R3  |
| AGT-12 | A regression test set checks tool selection, parameter extraction, refusal behavior and grounded answers for each model in the router.        | M   | R2  |

### 4.6 LLM Router (free models)

| ID     | Requirement                                                                                                                                                                                                              | Pri | Rel |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| LLM-01 | A `getModel(task)` factory returns a LangChain chat model for tasks: `voice_chat`, `agent_tools`, `structured_generation`, `vision`, `private_docs`, `embeddings`.                                                       | M   | R1  |
| LLM-02 | Default routing: `voice_chat` → Groq; `agent_tools` and `structured_generation` → Gemini; `vision` → Gemini; `private_docs` → Ollama; fallbacks chained with `withFallbacks` (Groq → Gemini → OpenRouter free → Ollama). | M   | R2  |
| LLM-03 | Provider, model name and fallback order are configuration, not code.                                                                                                                                                     | M   | R1  |
| LLM-04 | Per-user and global quota counters (Redis) track requests/tokens; when a quota is near exhaustion the router switches provider or enters degraded mode (shorter answers, smaller model).                                 | M   | R3  |
| LLM-05 | Content from the student's private documents is sent to hosted providers only if the student enabled "allow cloud AI for documents"; otherwise only the local model is used.                                             | M   | R3  |
| LLM-06 | Provider errors (rate limit, timeout, invalid output) are classified; rate limit and timeout trigger fallback, invalid output triggers retry.                                                                            | M   | R2  |
| LLM-07 | Model usage (provider, model, tokens, latency, failures) is recorded for cost and reliability review.                                                                                                                    | S   | R3  |
| LLM-08 | A model is enabled for a task only after it passes the regression set (AGT-12) above a configured threshold.                                                                                                             | S   | R3  |
| LLM-09 | The embedding model is a single configured model with fixed vector size; changing it triggers a re-indexing job.                                                                                                         | M   | R3  |

### 4.7 Agent Tool Specifications

Every tool has a Zod input schema, a Zod output schema, ownership checks and an entry in the action log.

| Tool                                           | Key inputs                                                  | Output                                  | Confirm        | Rel |
| ---------------------------------------------- | ----------------------------------------------------------- | --------------------------------------- | -------------- | --- |
| `get_schedule`                                 | `from`, `to`, `subject?`                                    | list of classes with exceptions applied | No             | R2  |
| `create_todo`                                  | `title`, `due?`, `subject?`, `priority?`, `notes?`          | todo                                    | No             | R2  |
| `update_todo` / `complete_todo`                | `id` or fuzzy `title`, fields                               | todo                                    | No             | R2  |
| `delete_todo`                                  | `id`                                                        | status                                  | Yes            | R2  |
| `list_todos`                                   | `status?`, `subject?`, `dueBefore?`                         | list                                    | No             | R2  |
| `create_reminder`                              | `text`, `at` or `rrule`, `channels?`, `linkedEntity?`       | reminder                                | No             | R2  |
| `cancel_reminder`                              | `id`                                                        | status                                  | Yes            | R2  |
| `start_timer` / `create_alarm`                 | `seconds` or `at`, `label`                                  | timer/alarm, sent to device             | No             | R2  |
| `create_exam`                                  | `subject`, `date`, `topics?`, `weight?`                     | exam                                    | No             | R2  |
| `get_exam`                                     | `id?` or `subject`                                          | exam with topics and progress           | No             | R2  |
| `get_subject_topics`                           | `subject`                                                   | topics with mastery                     | No             | R3  |
| `get_existing_tasks`                           | `from`, `to`                                                | todos and sessions in range             | No             | R3  |
| `create_study_plan`                            | `examId`, `hoursPerDay?`, `preferredTime?`, `reminderTime?` | draft plan (not yet saved as todos)     | Yes (approval) | R3  |
| `search_documents`                             | `query`, `subject?`, `documentId?`, `k`                     | chunks with citations                   | No             | R3  |
| `summarize_document`                           | `documentId` or `latestForSubject`                          | summary with citations                  | No             | R3  |
| `generate_quiz`                                | `source`, `count`, `type`, `difficulty?`                    | quiz saved in DB                        | No             | R3  |
| `record_quiz_result`                           | `quizId`, `answers`                                         | score, per-topic results                | No             | R3  |
| `save_class_note` / `query_class_notes`        | `subject`, `topic`, `text` / `range`                        | note / summary                          | No             | R3  |
| `get_readiness`                                | `examId`                                                    | score, weak topics, suggestions         | No             | R5  |
| `start_study_session` / `end_study_session`    | `subject`, `topic`, `minutes`                               | session, timer sent to device           | No             | R5  |
| `get_analytics`                                | `range`, `subject?`                                         | metrics                                 | No             | R5  |
| `save_memory` / `get_memory` / `delete_memory` | `key`, `value`                                              | memory                                  | Delete: Yes    | R3  |
| `find_contact`                                 | `name`, `group?`                                            | matches (may require choice)            | No             | R4  |
| `prepare_call`                                 | `contactId`                                                 | pending action to phone                 | **Yes**        | R4  |
| `prepare_message`                              | `contactId`, `channel`, `text`                              | pending action to phone                 | **Yes**        | R4  |
| `device_show` / `device_speak`                 | `screen`, `fields` / `text`                                 | delivery status                         | No             | R2  |

**Example flow (Exam + plan + reminders)**
"I have a database exam next Monday. Make me a study plan and remind me every evening at 7."

1. `create_exam` → 2. `get_subject_topics` → 3. `get_existing_tasks` → 4. `create_study_plan` (draft) → 5. agent presents summary on device (voice) and in app (full plan) → 6. student approves → 7. API creates todos and a recurring reminder via `create_reminder` (19:00 daily) → 8. confirmation spoken.

### 4.8 Document and RAG Pipeline (Qdrant)

| ID     | Requirement                                                                                                                                                                                 | Pri | Rel |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| RAG-01 | Allowed types: PDF, PPTX, DOCX, TXT/MD, PNG/JPG. Maximum size and per-user storage quota are configurable; violations return clear errors.                                                  | M   | R3  |
| RAG-02 | Ingestion runs as a BullMQ job with states `uploaded → parsing → ocr? → chunking → embedding → indexed` or `failed` with a reason; the app shows the state.                                 | M   | R3  |
| RAG-03 | Parsers: PDF text extraction, DOCX (`mammoth`), PPTX (`officeparser`); OCR with Tesseract for scanned pages and images; vision model fallback for handwriting and formulas.                 | M   | R3  |
| RAG-04 | Chunking with recursive text splitting, preserving metadata: `documentId`, `subjectId`, `page` or `slide`, `chunkIndex`.                                                                    | M   | R3  |
| RAG-05 | Embeddings are produced by the configured model (LLM-09) and upserted into one Qdrant collection with payload `userId`, `documentId`, `subjectId`, `page`, `text`.                          | M   | R3  |
| RAG-06 | Every retrieval goes through a single helper that always applies the `userId` filter; direct Qdrant queries elsewhere are forbidden.                                                        | M   | R3  |
| RAG-07 | Retrieval returns top-k chunks (default 6) with scores; chunks below a minimum score are discarded and the agent answers "not found in your materials".                                     | M   | R3  |
| RAG-08 | Answers include citations (document name and page/slide) rendered as tappable links in the app.                                                                                             | M   | R3  |
| RAG-09 | Optional reranking improves ordering for long documents.                                                                                                                                    | C   | R3  |
| RAG-10 | Quiz generation uses selected chunks or whole chapters; questions, options, correct answer, explanation and source reference are produced as structured output and validated before saving. | M   | R3  |
| RAG-11 | Deleting a document removes its Qdrant points, object-storage file and database records in a retriable cleanup job.                                                                         | M   | R3  |
| RAG-12 | Re-indexing is available per document and for all documents when the embedding model changes.                                                                                               | S   | R3  |

### 4.9 Jobs, Scheduling and Notifications

| ID     | Requirement                                                                                                                                                                                      | Pri | Rel |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | --- |
| JOB-01 | Queues: `reminders`, `class-alerts`, `documents`, `analytics`, `nudges`, `cleanup`.                                                                                                              | M   | R2  |
| JOB-02 | Creating, editing or deleting a reminder, schedule entry or exception updates its scheduled jobs; job IDs are deterministic so updates are idempotent.                                           | M   | R2  |
| JOB-03 | Recurrence is computed from `rrule` in the user's time zone with `luxon`, so alerts stay correct across daylight-saving changes.                                                                 | M   | R2  |
| JOB-04 | When a reminder fires: deliver to the device over WebSocket if online, send an Expo push notification, and record delivery status; if the device is offline the event is queued until reconnect. | M   | R2  |
| JOB-05 | Failed jobs retry with exponential backoff; permanently failed jobs are logged and visible to administrators.                                                                                    | M   | R2  |
| JOB-06 | On server restart all pending schedules are rebuilt from the database (the database, not Redis, is the source of truth).                                                                         | M   | R2  |
| JOB-07 | A daily analytics job aggregates study hours, tasks and quiz results per user.                                                                                                                   | S   | R5  |
| JOB-08 | A nudge job evaluates rules (e.g., no study in a subject for N days), checks quiet hours and settings, then sends at most the configured number of nudges per day.                               | S   | R5  |
| JOB-09 | A cleanup job removes expired pending actions, old transcripts according to retention settings, and orphaned files/vectors.                                                                      | M   | R3  |
| JOB-10 | Reminder delivery latency target: within 30 seconds of scheduled time for 99% of reminders.                                                                                                      | M   | R2  |

### 4.10 Firmware (ESP32-S3)

| ID    | Requirement                                                                                                                     | Pri | Rel |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | --- | --- |
| FW-01 | Boot sequence: load settings from NVS, connect to Wi-Fi, open WebSocket, send `hello`, show status.                             | M   | R1  |
| FW-02 | BLE Wi-Fi provisioning using ESP-IDF `wifi_provisioning`, compatible with the Expo app flow; credentials stored in NVS.         | M   | R1  |
| FW-03 | Audio capture via I2S with echo/noise processing (ESP-SR AFE) and wake-word detection (ESP-SR).                                 | M   | R1  |
| FW-04 | After wake word or talk-button press, stream audio chunks until `audio.end`, end of speech detected, or timeout (default 15 s). | M   | R1  |
| FW-05 | Play received TTS audio through I2S output with buffering to avoid gaps; stop immediately on interrupt.                         | M   | R1  |
| FW-06 | LED and display states follow server `state` messages and local events (muted, offline).                                        | M   | R1  |
| FW-07 | Hardware mute switch cuts microphone input and lights an indicator; no audio is streamed while muted.                           | M   | R1  |
| FW-08 | Local reminder/alarm cache for the next 24 h, updated by `reminder.sync`; alarms ring even without network.                     | S   | R2  |
| FW-09 | Signed OTA updates with rollback to the previous image if the new image fails to boot.                                          | M   | R2  |
| FW-10 | LVGL screens: home (time, next class), study timer, exam countdown, status/error.                                               | S   | R5  |
| FW-11 | Device token is stored in NVS (encrypted flash for production) and never logged.                                                | M   | R1  |
| FW-12 | Watchdog and automatic reconnect with exponential backoff on Wi-Fi or WebSocket loss.                                           | M   | R1  |
| FW-13 | Factory reset (button hold) clears Wi-Fi and token and re-enters provisioning.                                                  | M   | R1  |

---

## 5. Data Requirements

### 5.1 PostgreSQL (Prisma) — core models

```
User            id, email, passwordHash?, googleId?, name, locale, timezone,
                quietHours, cloudAiForDocs(bool), guardianConsent?, createdAt
Device          id, userId, name, serial, tokenHash, firmwareVersion, lastSeenAt, status
PushToken       id, userId, token, platform
Subject         id, userId, name, teacher?, color
Topic           id, subjectId, title, mastery(0-100), status
ScheduleEntry   id, subjectId, weekday, startTime, endTime, room?, leadMinutes
ScheduleException id, entryId, date, type(cancelled|moved), newStart?, newEnd?
ClassNote       id, subjectId, topic?, date, text
Exam            id, userId, subjectId, date, weight?, status
StudyPlan       id, examId, version, status(draft|approved), createdAt
Todo            id, userId, title, notes?, dueAt?, priority, status, subjectId?, planId?
Reminder        id, userId, text, fireAt?, rrule?, channels, status, linkedType?, linkedId?
StudySession    id, userId, subjectId?, topicId?, startedAt, endedAt?, plannedMin, interruptions
Document        id, userId, subjectId?, filename, mime, storageKey, status, pages, error?
Quiz            id, userId, documentId?, title, createdAt
QuizQuestion    id, quizId, type, prompt, options(json), answer, explanation, sourceRef
QuizAttempt     id, quizId, userId, score, answers(json), takenAt
Contact         id, userId, name, phone?, email?, groupName
Conversation    id, userId, channel(device|app), createdAt
Message         id, conversationId, role, content, createdAt
PendingAction   id, userId, type, payload(json), status, expiresAt
ActionLog       id, userId, tool, input(json), output(json), status, durationMs, createdAt
Memory          id, userId, key, value, createdAt
LlmUsage        id, userId?, provider, model, task, tokensIn, tokensOut, latencyMs, ok
DailyStats      id, userId, date, studyMinutes, tasksDone, tasksMissed, quizAvg
(LangGraph checkpoint tables)
```

| ID     | Requirement                                                                                 | Pri |
| ------ | ------------------------------------------------------------------------------------------- | --- |
| DAT-01 | All timestamps are stored in UTC; the user's IANA time zone is stored on `User`.            | M   |
| DAT-02 | Every user-owned table has an indexed `userId`; deleting a user cascades to all owned rows. | M   |
| DAT-03 | Recurring rules are stored as RFC 5545 `rrule` strings.                                     | M   |
| DAT-04 | Passwords use argon2; device tokens and refresh tokens are stored only as hashes.           | M   |

### 5.2 Qdrant

| ID     | Requirement                                                                                                                                            | Pri |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| DAT-10 | Collection `document_chunks` with vector size fixed by the configured embedding model and cosine distance.                                             | M   |
| DAT-11 | Payload fields: `userId`, `documentId`, `subjectId`, `page`, `chunkIndex`, `text`, `filename`; payload indexes on `userId`, `documentId`, `subjectId`. | M   |
| DAT-12 | Optional collection `memory_items` for semantic recall of long-term memory.                                                                            | C   |

### 5.3 Redis and Object Storage

| ID     | Requirement                                                                                                                                | Pri |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| DAT-20 | Redis holds BullMQ queues, rate-limit counters, LLM quota counters and device presence; no data in Redis is the only copy of user content. | M   |
| DAT-21 | Object storage holds uploaded files under `users/<userId>/documents/<documentId>`; access is only through short-lived signed URLs.         | M   |

### 5.4 Retention and Privacy Rules

| ID     | Requirement                                                                                                                | Pri |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | --- |
| DAT-30 | Raw audio is not stored by default; transcripts are kept per user-configurable retention (default 90 days).                | M   |
| DAT-31 | Account deletion removes data in PostgreSQL, Qdrant, Redis keys and object storage within 30 days and confirms completion. | M   |
| DAT-32 | Langfuse traces and logs do not contain full document text or contact details.                                             | M   |

---

## 6. Non-Functional Requirements

| ID     | Category        | Requirement                                                                                                                           |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Performance     | Voice round trip (end of speech → first spoken audio) ≤ 3 s at p75 for simple queries.                                                |
| NFR-02 | Performance     | A 100-page PDF is indexed within 5 minutes using the default configuration.                                                           |
| NFR-03 | Reliability     | Reminder and class-alert delivery within ±30 s for ≥ 99% of events (JOB-10).                                                          |
| NFR-04 | Availability    | Backend availability ≥ 99.5% monthly; device alarms work offline.                                                                     |
| NFR-05 | Security        | TLS on all connections; JWT lifetimes short; refresh token rotation; per-device revocable tokens; signed firmware.                    |
| NFR-06 | Privacy         | Microphone only streams after the wake word; consent recorded for microphone, contacts, documents and cloud AI use.                   |
| NFR-07 | Isolation       | Automated tests prove one user cannot read another user's rows, files or vectors.                                                     |
| NFR-08 | AI quality      | ≥ 90% correct tool selection and ≥ 90% grounded answers on the regression set for any model enabled for production.                   |
| NFR-09 | Cost            | Free-tier usage is tracked; the system degrades gracefully (shorter answers, fallback models) instead of failing when quotas run out. |
| NFR-10 | Compatibility   | Android 10+ primary; iOS secondary; ESP32-S3 with PSRAM.                                                                              |
| NFR-11 | Scalability     | Initial deployment supports 10,000 registered users and 500 concurrent device sessions on a single Docker host without redesign.      |
| NFR-12 | Observability   | Structured logs, Sentry for errors, Langfuse for AI traces, device telemetry.                                                         |
| NFR-13 | Maintainability | Shared Zod schemas in `packages/shared`; tool contracts versioned and tested; CI runs lint, tests and builds.                         |
| NFR-14 | Usability       | Core actions complete in ≤ 2 voice turns; app supports screen readers and large text.                                                 |
| NFR-15 | Safety          | Content filtering and age-appropriate responses; harmful requests are refused.                                                        |

---

## 7. Release Plan and Management

### 7.1 Releases

| Release | Theme            | Requirements in scope                                                                                                                                         | Exit criteria                                                                        |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **R1**  | Voice foundation | ACC-01–05, VOI-01–04/06/07, AI-01, DEV-01, APP-01/02/04/20–22/26, API auth/devices/chat, GW-01/03/04, VP-01–04/06/07, AGT-03, LLM-01/03, FW-01–07/11–13       | Student holds a voice conversation on the device; p75 latency ≤ 3 s                  |
| **R2**  | Productivity     | PRD-\*, CLS-01–03, EXM-01, AI-02/03/06, ACC-06, DEV-02/04/05, APP-03/05/06/13/23/27/29, GW-05/06, JOB-01–06/10, AGT-01/02/04/06/08/09/12, LLM-02/06, FW-08/09 | ≥ 95% of scripted productivity commands succeed; reminders on time                   |
| **R3**  | Study Brain      | DOC-_, EXM-02–04/07, CLS-04–07, AI-05/07, VOI-09, APP-07–09/28, RAG-_, LLM-04/05/07–09, AGT-07/10/11, JOB-09                                                  | Grounded answers with citations ≥ 90% on test set; cross-user isolation tests pass   |
| **R4**  | Communication    | COM-\*, AI-04, CLS-08, APP-10/24/25, GW-02, API-12, AGT-05                                                                                                    | No call or message executes without confirmation; zero wrong-recipient cases in test |
| **R5**  | Proactive        | STM-01–06, ANL-\*, EXM-05/06/08, AI-08, DEV-03/06, APP-11/12, JOB-07/08, FW-10                                                                                | Study session end-to-end on device and app; nudges respect quiet hours               |
| **R6**  | Advanced         | STM-07, ACC-08, DEV-07                                                                                                                                        | Pilot results per feature                                                            |

### 7.2 Recommended MVP (first public build)

R1 plus the essentials of R2: voice chat, todos, reminders, class schedule with pre-class alerts, basic exam creation. Everything else follows the release order above.

### 7.3 Work packages and owners

| Work package                 | Owner role             | Main requirement groups                       |
| ---------------------------- | ---------------------- | --------------------------------------------- |
| WP1 Mobile app               | Mobile developer       | APP-\*, ACC, parts of COM                     |
| WP2 Backend API and data     | Backend developer      | API-_, DAT-_, JOB-\*                          |
| WP3 AI agent and router      | AI/backend developer   | AGT-_, LLM-_, tool specs                      |
| WP4 RAG and documents        | AI/backend developer   | RAG-\*, DOC                                   |
| WP5 Voice services           | Backend developer      | VP-_, GW-_                                    |
| WP6 Firmware and hardware    | Embedded engineer      | FW-\*, VOI, DEV                               |
| WP7 DevOps and observability | Any developer (shared) | NFR-04/11/12/13, CI/CD, hosting               |
| WP8 QA and evaluation        | QA / AI developer      | Regression set, device tests, isolation tests |
| WP9 Privacy and compliance   | Product owner          | NFR-05/06/15, consent, retention              |

### 7.4 Delivery process

- Two-week sprints; each sprint ends with a demo on the real device and app.
- Each requirement becomes a backlog item with acceptance criteria; **Definition of Done:** reviewed code, tests passing, Zod schemas and tool contracts documented, privacy impact checked, demonstrated.
- New requirements enter only through the product owner; scope added to a release must displace work of equal size.

---

## 8. Acceptance Criteria

| Requirement               | Acceptance criteria                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FR-VOI-02 / VP-04**     | Given a paired, online device, when the student says the wake phrase and "What is recursion?", the device starts speaking the answer within 3 s (p75) and the LED shows listening → thinking → speaking.                                                                      |
| **FR-PRD-03**             | Given "Remind me every evening at 7 to review notes", a recurring reminder is created in the student's time zone; at 19:00 the device speaks the reminder and the phone receives a push within 30 s; after a daylight-saving change it still fires at 19:00 local time.       |
| **FR-CLS-03**             | Given a class at 09:00 with a 10-minute lead, at 08:50 the device announces the class; if the exception "cancelled" exists for that date, no alert is sent.                                                                                                                   |
| **FR-AI-04 / AGT-05**     | Given "Call Mom", the agent returns a pending action; no dialer opens until the student confirms; if unconfirmed after 5 minutes the action expires and is logged as expired.                                                                                                 |
| **FR-COM-05**             | Given two contacts named Ahmed, the agent asks which one and proceeds only after the student chooses.                                                                                                                                                                         |
| **FR-DOC-04 / RAG-06/07** | Given an uploaded textbook, a question about chapter 3 returns an answer with at least one citation (document, page); a question about content not in the material returns "not found in your materials"; a second user cannot retrieve the first user's chunks in any query. |
| **FR-DOC-06 / RAG-10**    | "Make 10 MCQs from chapter 3" produces exactly 10 questions, each with four options, one correct answer, an explanation and a source reference; invalid structured output is retried before failing.                                                                          |
| **FR-EXM-02/03**          | Given an exam in 7 days with 5 topics, the draft plan covers the available days, includes a revision day before the exam, and creates no todos until the student approves.                                                                                                    |
| **LLM-02/04/06**          | When the primary provider returns a rate-limit error, the request completes using the next provider in the chain; the failure and fallback are recorded in `LlmUsage`.                                                                                                        |
| **LLM-05**                | With "allow cloud AI for documents" off, no request containing document text reaches a hosted provider (verified by tests that mock provider clients).                                                                                                                        |
| **FW-07 / VOI-04**        | With the mute switch on, no audio frames are sent (verified by server logs and a firmware test) and the indicator is lit.                                                                                                                                                     |
| **FW-09**                 | A corrupted firmware image is rejected; a valid image that fails to boot is rolled back automatically.                                                                                                                                                                        |
| **API-02 / NFR-07**       | Automated tests confirm that every list/read/update/delete endpoint returns 404 for another user's resource.                                                                                                                                                                  |

### Product KPIs (first 3 months after launch)

| KPI                                     | Target    |
| --------------------------------------- | --------- |
| Weekly active / registered users        | ≥ 40%     |
| Voice command success rate              | ≥ 90%     |
| Median voice response time              | ≤ 3 s     |
| Reminder on-time delivery               | ≥ 99%     |
| Study sessions per active user per week | ≥ 3       |
| Wrong-action incidents (call/message)   | 0         |
| Student satisfaction                    | ≥ 4.0 / 5 |

---

## 9. Risks, Assumptions, Open Questions

### 9.1 Risks

| ID   | Risk                                                                       | Mitigation                                                                                |
| ---- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| R-01 | Free LLM tiers change limits or models.                                    | Router with fallbacks and a local Ollama option; configuration-driven (LLM-03).           |
| R-02 | Free-tier data terms conflict with student privacy.                        | Local model for private documents unless consent is given (LLM-05).                       |
| R-03 | Free or small models call tools incorrectly.                               | Zod validation, bounded retries, regression set gate (AGT-04/12, LLM-08).                 |
| R-04 | Voice latency exceeds 3 s.                                                 | Groq for fast replies, sentence-level TTS, on-device wake word, server region near users. |
| R-05 | Expo limits for native features (BLE, direct calls).                       | Development builds from the start; native calls limited to intents; wrap native modules.  |
| R-06 | Cross-user data leak through vector search.                                | Single retrieval helper with mandatory `userId` filter; isolation tests (RAG-06, NFR-07). |
| R-07 | Reminder reliability (phone battery optimization, device offline).         | Server-side scheduling, push plus device delivery, local device cache.                    |
| R-08 | Hardware audio quality or wake-word accuracy on ESP32-S3.                  | Early hardware prototype; evaluate a dual-mic array.                                      |
| R-09 | Scope too large for the team.                                              | MVP in §7.2; strict change control.                                                       |
| R-10 | Self-hosted Whisper/Piper/Ollama need more server resources than expected. | Start with hosted free APIs for STT/LLM; move workloads to local hardware progressively.  |

### 9.2 Assumptions

- Students use Android primarily; iOS follows later.
- Reliable Wi-Fi is available where the device sits; the device is USB or mains powered in v1.
- Hosted free tiers are used for prototyping and early beta; their limits are re-checked before each release.

### 9.3 Open Questions

1. Which languages must be supported at launch? (Affects STT, TTS, embeddings, wake word.)
2. Is the target university students only, or school students too (consent and safety scope)?
3. Is an app-only mode (no device) required for early users?
4. Hosting: single VPS with Docker Compose, or managed services?
5. BullMQ (Redis) or pg-boss for the MVP?
6. Which UI kit for the app (Paper, Tamagui, NativeWind)?
7. Required retention period for transcripts and action logs?

---

## 10. Traceability

| Original idea feature   | Feature requirements  | Component requirements                                            | Release |
| ----------------------- | --------------------- | ----------------------------------------------------------------- | ------- |
| 1. Personal Study Brain | FR-DOC-\*, FR-AI-07   | RAG-\*, LLM-05/09, AGT-07, APP-08/09                              | R3      |
| 2. Exam Assistant       | FR-EXM-\*             | tools `create_exam`, `create_study_plan`, `get_readiness`; APP-07 | R2–R5   |
| 3. Class-aware AI       | FR-CLS-\*             | JOB-02/03/04, APP-06, tools `get_schedule`, `save_class_note`     | R2–R3   |
| 4. Voice-first          | FR-VOI-_, FR-DEV-_    | GW-_, VP-_, FW-\*                                                 | R1–R2   |
| 5. Communication        | FR-COM-01/02/05/06/07 | APP-24/25, AGT-05, tools `prepare_call`, `find_contact`           | R4      |
| 6. Messaging            | FR-COM-03/04          | APP-25, tool `prepare_message`                                    | R4      |
| 7. Study Mode           | FR-STM-\*             | FW-10, tools `start_study_session`, APP-11                        | R5      |
| 8. Analytics            | FR-ANL-\*             | JOB-07/08, APP-12, `get_analytics`                                | R5      |
| AI Tools architecture   | FR-AI-02–06           | AGT-01–12, section 4.7                                            | R2+     |
| 5 Brains                | —                     | AGT-01 (tool groups)                                              | R2+     |
| V6 vision / sync        | FR-DEV-07, FR-ACC-08  | —                                                                 | R6      |

---
