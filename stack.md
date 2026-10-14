# Student AI Assistant — Technology Stack

| Field                               | Value                                                                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document**                        | Technology selection per system part                                                                                                         |
| **Version**                         | 1.0 (Draft)                                                                                                                                  |
| **Date**                            | 14 Oct 2026                                                                                                                                  |
| **Companion document**              | `Student_Assistant_FRD.md`                                                                                                                   |
| **Fixed decisions (from the team)** | Mobile app on **Expo**, server on **Express**, **LangChain** for AI orchestration, **PostgreSQL + a vector database**, **popular free LLMs** |

> **Version policy:** use the latest stable release of each tool when the project starts and pin exact versions in lockfiles. Free-tier limits and model names change often, so every "free" claim below must be re-checked on the provider's pricing page before you depend on it.

---

## 1. Stack at a Glance

| Layer              | Primary choice                                                   | Main alternative                             |
| ------------------ | ---------------------------------------------------------------- | -------------------------------------------- |
| Mobile app         | Expo (React Native) + TypeScript + Expo Router                   | —                                            |
| App state / data   | Redux Toolkit + RTK Query                                        | TanStack Query                               |
| Backend            | Node.js + Express + TypeScript                                   | —                                            |
| AI orchestration   | LangChain.js + LangGraph.js                                      | Vercel AI SDK                                |
| Relational DB      | PostgreSQL + Prisma                                              | Drizzle                                      |
| Vector DB          | Qdrant                                                           | pgvector (inside PostgreSQL)                 |
| Cache / jobs       | Redis + BullMQ                                                   | pg-boss (no Redis)                           |
| Real-time          | WebSocket (`ws`)                                                 | Socket.IO, MQTT                              |
| LLMs               | Gemini (free tier), Groq, OpenRouter free models, Ollama (local) | Hugging Face, Mistral, Cloudflare Workers AI |
| Embeddings         | BGE-M3 / multilingual-e5 (local)                                 | Gemini embeddings                            |
| Speech-to-text     | Whisper (faster-whisper) or Groq Whisper                         | Google STT                                   |
| Text-to-speech     | Piper (self-hosted)                                              | Kokoro, Google Cloud TTS                     |
| Wake word (device) | ESP-SR (WakeNet) on ESP32-S3                                     | microWakeWord, Edge Impulse                  |
| Firmware           | ESP-IDF (C/C++) + ESP-ADF                                        | Arduino core + PlatformIO                    |
| Push notifications | Expo Push Service                                                | Firebase Cloud Messaging direct              |
| File storage       | S3-compatible (MinIO / Cloudflare R2)                            | Supabase Storage                             |
| DevOps             | Docker, GitHub Actions, EAS                                      | —                                            |

---

## 2. Architecture Overview

```
                     ┌──────────────────────────┐
                     │   Expo mobile app (TS)   │
                     │ UI · push · contacts ·   │
                     │ call/SMS intents · upload│
                     └───────────┬──────────────┘
                                 │ HTTPS (REST) + WebSocket
┌─────────────┐  WebSocket       │
│ ESP32-S3    │ (Opus/PCM audio) │
│ mic·speaker │◄────────────────►│
│ display·LED │                  ▼
└─────────────┘        ┌─────────────────────┐
                       │  Express API (TS)   │
                       │ auth · REST · WS    │
                       │ device gateway      │
                       └───┬────────┬────────┘
                           │        │
              ┌────────────▼──┐  ┌──▼────────────────┐
              │ LangGraph     │  │ BullMQ workers    │
              │ agent + tools │  │ reminders · docs  │
              └──┬─────────┬──┘  │ analytics         │
                 │         │     └──┬────────────────┘
        ┌────────▼──┐  ┌───▼────┐   │
        │ LLM router│  │ STT/TTS│   │
        │ Gemini    │  │ Whisper│   │
        │ Groq      │  │ Piper  │   │
        │ OpenRouter│  └────────┘   │
        │ Ollama    │               │
        └───────────┘               │
                 ┌──────────────────┼───────────────┐
                 ▼                  ▼               ▼
           PostgreSQL           Qdrant          Redis · S3
           (Prisma)          (embeddings)     (jobs · files)
```

**Key principle:** the ESP32 and the phone never talk to each other directly at runtime. Both connect to the backend. When the agent decides "call Mom", the backend sends an action to the phone app, which asks the student to confirm and then opens the dialer. BLE is used only for first-time device setup.

---

## 3. Mobile App (Expo)

### 3.1 Core

| Concern               | Choice                                         | Notes                                                                                 |
| --------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Framework             | **Expo (React Native)**, latest stable SDK     | Managed workflow with **development builds** via EAS (Expo Go is not enough, see 3.3) |
| Language              | **TypeScript** (strict)                        | Shared types with the backend                                                         |
| Navigation            | **Expo Router**                                | File-based routing, deep links                                                        |
| State + data fetching | **Redux Toolkit + RTK Query**                  | Matches the team's existing experience                                                |
| Forms / validation    | React Hook Form + **Zod**                      | Reuse Zod schemas from the shared package                                             |
| UI kit                | **React Native Paper** or **Tamagui**          | Pick one; NativeWind is a good option if the team prefers Tailwind                    |
| Animation / gestures  | React Native Reanimated, Gesture Handler       | Timer and device-status animations                                                    |
| Charts                | `react-native-gifted-charts` or Victory Native | Analytics dashboard                                                                   |
| i18n                  | `i18next` + `expo-localization`                | Plan for RTL layouts if Arabic is a target                                            |
| Secure storage        | `expo-secure-store`                            | Tokens only; never put API keys in the app                                            |

### 3.2 Expo modules mapped to features

| Feature (FRD)                         | Module                                                          | Remarks                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Push notifications, local reminders   | `expo-notifications`                                            | Local scheduling as a fallback if the server is unreachable                                                                       |
| Contacts (FR-COM-01)                  | `expo-contacts`                                                 | Request permission only when the feature is first used                                                                            |
| Call by voice (FR-COM-02)             | `Linking` with `tel:`                                           | Opens the dialer; the user presses call. Silent direct calling needs a native module and Play policy review, so treat as optional |
| SMS (FR-COM-03/04)                    | `expo-sms`                                                      | Opens the composer with prefilled text                                                                                            |
| WhatsApp (FR-COM-04)                  | `Linking` with `https://wa.me/<number>?text=`                   | User taps send; no API access to personal accounts                                                                                |
| Email                                 | `expo-mail-composer`                                            | Prefilled draft                                                                                                                   |
| Document upload (FR-DOC-01)           | `expo-document-picker`, `expo-image-picker`, `expo-file-system` | Upload via signed URL or multipart                                                                                                |
| In-app audio / voice chat             | `expo-audio`                                                    | Use the current recommended audio module for the installed SDK                                                                    |
| Device Wi-Fi provisioning (FR-ACC-03) | `react-native-ble-plx` (BLE)                                    | Needs a development build; pair with ESP-IDF provisioning on the firmware side                                                    |
| QR pairing (FR-ACC-02)                | `expo-camera` (barcode scanning)                                |                                                                                                                                   |
| Background work                       | `expo-task-manager` / `expo-background-task`                    | Use sparingly; rely on server push for reliability                                                                                |
| Study-mode Do Not Disturb (FR-STM-05) | Platform settings deep link                                     | App blocking needs native Android modules; defer to R6                                                                            |
| OTA updates of JS                     | **EAS Update**                                                  |                                                                                                                                   |
| Builds                                | **EAS Build**                                                   |                                                                                                                                   |

### 3.3 Constraints to remember

- BLE, some call features and any custom native code require a **development build**, not Expo Go.
- iOS gives no silent calling or SMS. The design already uses confirmations and intents.
- Battery optimizations can delay background tasks, so reminders must be driven by **server push plus the device**, not only by the app.

---

## 4. Backend (Express)

### 4.1 Core

| Concern             | Choice                                                                       | Notes                                                                                  |
| ------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Runtime             | **Node.js LTS**                                                              |                                                                                        |
| Framework           | **Express** + TypeScript                                                     | Use `express-async-errors` or an async wrapper                                         |
| Validation          | **Zod**                                                                      | Request validation and LLM tool schemas share one source                               |
| API docs            | `zod-to-openapi` or `swagger-ui-express`                                     | Generate docs from schemas                                                             |
| ORM                 | **Prisma**                                                                   | Vector columns handled outside Prisma (see 6.2)                                        |
| Auth (users)        | JWT access + refresh tokens, `argon2` hashing, Passport or manual middleware | Google sign-in via `expo-auth-session`                                                 |
| Auth (devices)      | Per-device secret token issued at pairing                                    | Rotatable and revocable                                                                |
| Real-time           | **`ws`** WebSocket server                                                    | Device audio and app events; Socket.IO is acceptable if rooms and fallbacks are wanted |
| Background jobs     | **BullMQ** on Redis                                                          | Reminders, class alerts, document processing, analytics                                |
| Scheduling rules    | `rrule` + `luxon`                                                            | Recurrence and time zones; store UTC plus the user's zone                              |
| Logging             | **pino**                                                                     | Structured logs                                                                        |
| Security middleware | `helmet`, `cors`, `express-rate-limit`                                       | Stricter limits on AI endpoints                                                        |
| File handling       | `multer` or direct-to-storage signed URLs                                    |                                                                                        |
| Config / secrets    | `dotenv` locally, platform secrets in production                             |                                                                                        |
| Testing             | **Vitest** or Jest, Supertest                                                | Plus an AI evaluation harness (see 5.6)                                                |
| Lint / format       | ESLint, Prettier                                                             |                                                                                        |

### 4.2 Suggested module layout

```
server/src/
  modules/
    auth/ users/ devices/
    schedule/ todos/ reminders/ exams/ study/
    documents/ quizzes/ contacts/ analytics/
    ai/            # agent, tools, prompts, llm router
  realtime/        # websocket gateway (device + app)
  jobs/            # BullMQ queues and workers
  lib/             # prisma, redis, qdrant, storage, logger
```

### 4.3 Why BullMQ (and when pg-boss is better)

BullMQ gives delayed and repeatable jobs with retries, which fits reminders. It adds Redis as a dependency. If you want fewer moving parts in the first release, **pg-boss** runs the queue inside PostgreSQL; the job code is similar, so switching later is not costly.

---

## 5. AI Layer (LangChain)

### 5.1 Frameworks

| Concern           | Choice                                                         | Notes                                                                                                      |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Orchestration     | **LangChain.js**                                               | Chat model wrappers, retrievers, loaders, tool definitions                                                 |
| Agent runtime     | **LangGraph.js**                                               | Stateful agent loop, tool calling, human-in-the-loop confirmation (needed for call/message/delete actions) |
| Tool schemas      | **Zod** via LangChain `tool()`                                 | Same schemas validate inputs and describe tools to the model                                               |
| Structured output | `withStructuredOutput` + Zod                                   | Study plans, quizzes, intents                                                                              |
| Memory            | LangGraph checkpointer in PostgreSQL + a `Memory` table        | Short-term in checkpoints, long-term in relational tables                                                  |
| Observability     | **Langfuse** (self-hosted, open source) or LangSmith free tier | Trace every tool call (FR-AI-07)                                                                           |
| Evaluation        | Promptfoo or a custom test set                                 | Regression tests for tool selection and grounded answers                                                   |

### 5.2 Free LLM options

Free access comes in two forms: **hosted free tiers** (rate limited) and **self-hosted open-weight models** (no limits, but you provide hardware). The plan uses both, behind one router.

| Provider                                         | Typical models available                          | LangChain integration                         | Strengths                                                                            | Cautions                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **Google Gemini API** (free tier)                | Gemini Flash-class models                         | `@langchain/google-genai`                     | Strong tool calling, vision for screenshots, long context, good multilingual support | Rate limits; free-tier inputs may be used to improve Google products, so check the terms before sending student documents |
| **Groq** (free tier)                             | Open models such as Llama, Qwen, gpt-oss families | `@langchain/groq`                             | Very fast responses, good for voice latency; also hosts Whisper                      | Rate limits; model catalog changes                                                                                        |
| **OpenRouter** (free-tagged models)              | Rotating set of free open models                  | `@langchain/openai` with OpenRouter `baseURL` | One API for many models; easy fallback                                               | Free models vary in quality and availability; tight limits                                                                |
| **Ollama** (self-hosted)                         | Llama, Qwen, Mistral, Gemma, DeepSeek families    | `@langchain/ollama`                           | No quota, full privacy, works offline from third parties                             | Needs a GPU or strong CPU; slower on small servers                                                                        |
| **Hugging Face Inference**                       | Many open models                                  | `@langchain/community` / HF integration       | Large catalog                                                                        | Free limits are small; use for experiments                                                                                |
| **Mistral La Plateforme** (free/experiment tier) | Mistral models                                    | `@langchain/mistralai`                        | Good European option                                                                 | Check current free-tier terms                                                                                             |
| **Cloudflare Workers AI**                        | Open models, embeddings                           | REST / community integration                  | Free daily allotment, edge latency                                                   | Smaller model choice                                                                                                      |
| **GitHub Models**                                | Various hosted models                             | OpenAI-compatible endpoint                    | Free for prototyping                                                                 | Prototype-level limits                                                                                                    |

### 5.3 Recommended routing (task-based)

| Task                                               | First choice                   | Fallback chain                |
| -------------------------------------------------- | ------------------------------ | ----------------------------- |
| Voice chat, short answers (low latency)            | Groq (fast Llama-class model)  | Gemini Flash → Ollama         |
| Agent with tool calling (todos, schedule, plans)   | Gemini Flash-class             | Groq → OpenRouter → Ollama    |
| Study-plan and quiz generation (structured output) | Gemini Flash-class             | Groq → Ollama                 |
| Image / screenshot understanding                   | Gemini (vision)                | Local vision model via Ollama |
| Private document Q&A (sensitive content)           | **Ollama (local)**             | Gemini only with user consent |
| Embeddings                                         | Local BGE-M3 / multilingual-e5 | Gemini embeddings             |

**Implementation notes**

- Build one `getModel(task)` factory returning a LangChain chat model and chain fallbacks with `.withFallbacks([...])`.
- Add a per-user token budget and a "degraded mode" (shorter answers, smaller model) when quotas are exhausted (NFR-11).
- Small free models call tools less reliably. Validate tool arguments with Zod, retry on invalid output, and keep a tool-calling evaluation set per model before you route traffic to it.
- Keep prompts provider-neutral; avoid features that exist only on one vendor.

### 5.4 Embeddings

| Option                                                                           | Why                                         | Caution                               |
| -------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------- |
| **BGE-M3** (via Ollama, `sentence-transformers`, or a small Python/ONNX service) | Strong multilingual retrieval, open license | Needs CPU/GPU on the server           |
| **multilingual-e5**                                                              | Lightweight multilingual alternative        | Slightly weaker on some languages     |
| **nomic-embed-text** (Ollama)                                                    | Easy to run, good for English               | Less suited to mixed-language content |
| **Gemini embeddings**                                                            | No local compute                            | Free-tier data terms; rate limits     |

Fix the model and vector size before indexing. Changing the model later means re-embedding every document.

### 5.5 RAG pipeline

```
Upload → S3 storage → BullMQ job
   → parse (PDF/PPTX/DOCX/image)
   → OCR when needed
   → chunk (LangChain text splitters, keep page/slide metadata)
   → embed
   → upsert to Qdrant (payload: userId, documentId, subjectId, page)
Question → embed → Qdrant search (filter by userId) → rerank (optional) → LLM answer + citations
```

| Step                         | Tools                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| PDF text                     | `pdfjs-dist` / LangChain `PDFLoader`                                                                           |
| DOCX                         | `mammoth`                                                                                                      |
| PPTX                         | `officeparser`                                                                                                 |
| Scanned pages / images (OCR) | **Tesseract** (server binary or `tesseract.js`); Gemini vision for hard cases such as handwriting and formulas |
| Complex layouts / tables     | `unstructured` (open source) if parsing quality is a problem                                                   |
| Chunking                     | `RecursiveCharacterTextSplitter` with page metadata                                                            |
| Reranking (optional)         | `bge-reranker` (open)                                                                                          |

### 5.6 AI quality and safety

- Evaluate with a fixed test set: tool selection accuracy, grounded answers with citations (target in NFR-10), and refusal behavior.
- Guardrails: confirmation step for outward actions, tool allow-lists per user, prompt-injection defenses for document text (treat document content as data, never as instructions).

---

## 6. Databases

### 6.1 PostgreSQL (relational)

| Item                 | Choice                                                                                                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database             | **PostgreSQL** (latest stable)                                                                                                                                                                     |
| ORM / migrations     | **Prisma** (Prisma Migrate)                                                                                                                                                                        |
| Stores               | Users, devices, subjects, schedule, todos, reminders, exams, topics, study plans, study sessions, quizzes and attempts, contacts, action logs, memory, LangGraph checkpoints, analytics aggregates |
| Time handling        | Store timestamps in UTC; keep the user's IANA time zone on the user record                                                                                                                         |
| Free hosting options | Self-hosted Docker, Neon, Supabase (verify current free tiers)                                                                                                                                     |

### 6.2 Vector database

| Option                 | Role                                                             | Reasoning                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Qdrant** (chosen)    | Dedicated vector store for document chunks and memory embeddings | Open source, runs in Docker for free, has a free cloud tier, strong payload filtering (essential for per-user isolation), good LangChain support (`@langchain/qdrant`) |
| pgvector (alternative) | Vectors inside PostgreSQL                                        | One database to run and back up, simpler for the MVP. Prisma needs `Unsupported("vector")` and raw SQL for similarity queries, or use LangChain's PGVector store       |
| Chroma                 | Prototyping                                                      | Easy locally, less suited to production multi-tenancy                                                                                                                  |
| Pinecone / Weaviate    | Managed options                                                  | Free tiers exist but add vendor lock-in                                                                                                                                |

**Rules for the vector DB**

- One collection for chunks, with payload fields `userId`, `documentId`, `subjectId`, `page`, `source`. **Every query must filter by `userId`.**
- Delete vectors when a document or account is deleted (FR-DOC-08, FR-ACC-07).
- Store the original text and metadata in the payload so answers can cite pages without an extra lookup; keep PostgreSQL as the source of truth for document records.

### 6.3 Redis

Used for BullMQ queues, rate limiting, short-lived device session state and caching. Free hosting options include self-hosted Docker or a free hosted tier (verify limits).

### 6.4 File storage

**MinIO** (self-hosted, S3 API) or **Cloudflare R2** (S3-compatible, free allowance; verify). Access through signed URLs; store only keys in PostgreSQL.

---

## 7. Speech and Voice Pipeline

### 7.1 Data path

```
ESP32: mic → AFE (noise/echo) → wake word (on-device)
   → stream audio (WebSocket) → server VAD → STT
   → agent (LLM + tools) → TTS → audio chunks → ESP32 speaker
```

### 7.2 Components

| Part                     | Primary                                                                  | Alternatives                    | Notes                                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Wake word                | **ESP-SR (WakeNet)** on ESP32-S3                                         | microWakeWord, Edge Impulse     | Runs on-device, so audio is not streamed until the wake phrase is heard (NFR-08). Custom phrases may need training or a supported phrase |
| Voice activity detection | **Silero VAD** (server)                                                  | WebRTC VAD                      | Decide end of speech                                                                                                                     |
| Audio codec              | **Opus** (or PCM16 16 kHz for the first prototype)                       | —                               | Opus saves bandwidth; start with PCM to debug quickly                                                                                    |
| Speech-to-text           | **faster-whisper** self-hosted, or **Groq Whisper** (hosted free tier)   | whisper.cpp, Google STT         | Multilingual; choose model size by CPU/GPU budget                                                                                        |
| Text-to-speech           | **Piper** (self-hosted, fast, offline)                                   | Kokoro, Google Cloud TTS, Coqui | Check that a good voice exists for each target language                                                                                  |
| Streaming                | Sentence-level TTS: start speaking after the first sentence from the LLM | —                               | Key to meeting the 3 s latency target (NFR-01)                                                                                           |
| Transport                | **WebSocket**                                                            | MQTT for control messages       | WebSocket is enough for the first versions                                                                                               |

---

## 8. ESP32 Firmware and Hardware

### 8.1 Hardware recommendation

| Part           | Choice                                                                | Notes                                                                        |
| -------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| MCU            | **ESP32-S3** with PSRAM (e.g., 8 MB)                                  | Required for wake word and audio buffering; the original ESP32 is a poor fit |
| Microphone     | I2S MEMS (INMP441, or a dual-mic array for better wake-word accuracy) |                                                                              |
| Speaker amp    | MAX98357A (I2S) + small speaker                                       |                                                                              |
| Display        | ST7789 / ILI9341 TFT or SSD1306 OLED                                  | Study timer, next class                                                      |
| Inputs         | Buttons (talk, mute, study), optional touch                           | Hardware mute switch with LED (FR-VOI-07)                                    |
| Dev kit option | ESP32-S3-BOX-3 or similar all-in-one board                            | Fastest path to a working prototype                                          |

### 8.2 Firmware software

| Concern          | Choice                                                                      | Notes                                                                                       |
| ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Framework        | **ESP-IDF** (C/C++)                                                         | Best support for audio and wake word; PlatformIO or Arduino core is easier but less capable |
| Audio framework  | **ESP-ADF**                                                                 | Pipelines for I2S, codecs, streaming                                                        |
| Speech libs      | **ESP-SR** (wake word, AFE, VAD)                                            |                                                                                             |
| WebSocket client | `esp_websocket_client`                                                      | TLS enabled                                                                                 |
| Wi-Fi setup      | ESP-IDF **`wifi_provisioning`** over BLE                                    | Matches the Expo `react-native-ble-plx` flow                                                |
| UI               | **LVGL**                                                                    | For the display                                                                             |
| OTA              | `esp_https_ota` with signed images                                          | FR-DEV-02, NFR-06                                                                           |
| Local storage    | NVS (settings, device token), small cache of upcoming reminders (FR-DEV-08) |                                                                                             |
| Build / tooling  | ESP-IDF + VS Code extension, or PlatformIO; Wokwi for simulation            |                                                                                             |
| Security         | Secure boot and flash encryption for production units                       | Plan from the first hardware revision                                                       |

---

## 9. Notifications and Scheduling

| Concern         | Choice                                                                          | Notes                                                       |
| --------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Push to phone   | **Expo Push Service** (free)                                                    | Wraps FCM and APNs; use high-priority channel for reminders |
| Push to device  | WebSocket message from server                                                   | Device caches the next 24 h locally                         |
| Reminder engine | BullMQ delayed/repeatable jobs created from `Reminder` and `ScheduleEntry` rows | Re-schedule on edit; idempotent job IDs                     |
| Recurrence      | `rrule`                                                                         | "Every evening at 7"                                        |
| Time zones      | `luxon`                                                                         | DST-safe                                                    |
| Fallback        | Local notifications from `expo-notifications`                                   | Covers short server outages                                 |

---

## 10. DevOps, Hosting and Tooling

### 10.1 Repository and build

| Concern         | Choice                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Repo structure  | **Monorepo**: `pnpm` workspaces (+ Turborepo optional)                                                       |
| Packages        | `apps/mobile` (Expo), `apps/server` (Express), `packages/shared` (Zod schemas, types), `firmware/` (ESP-IDF) |
| CI/CD           | **GitHub Actions** (lint, test, build, EAS build, Docker image)                                              |
| Containers      | **Docker** and Docker Compose for local dev (PostgreSQL, Redis, Qdrant, MinIO, Ollama, Langfuse)             |
| Mobile delivery | **EAS Build / Submit / Update**                                                                              |

### 10.2 Hosting (free or low-cost; verify current terms)

| Component                | Options                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Express API + workers    | A small VPS (Hetzner, Oracle Cloud Always Free) with Docker, or Render / Railway / Fly.io |
| PostgreSQL               | Same VPS, Neon, or Supabase                                                               |
| Qdrant                   | Same VPS (Docker) or Qdrant Cloud free tier                                               |
| Redis                    | Same VPS or a free hosted tier                                                            |
| Ollama / Whisper / Piper | A VPS with enough RAM; a GPU machine if you want local models at usable speed             |
| Object storage           | MinIO on the VPS or Cloudflare R2                                                         |

For a single-developer start, one VPS running Docker Compose is the simplest and cheapest option. Free PaaS tiers often sleep idle services, which hurts a voice device that must answer immediately.

### 10.3 Observability and quality

| Concern          | Choice                                                                |
| ---------------- | --------------------------------------------------------------------- |
| Errors           | **Sentry** (free tier) for app and server                             |
| Logs             | pino to files/stdout, shipped with Loki or a hosted free tier         |
| AI traces        | **Langfuse**                                                          |
| Metrics          | Prometheus + Grafana (later)                                          |
| Mobile testing   | Jest + React Native Testing Library; **Maestro** for end-to-end flows |
| API testing      | Vitest/Jest + Supertest                                               |
| Firmware testing | Unity (ESP-IDF) and hardware-in-the-loop checks                       |

---

## 11. Security and Privacy Tooling

| Concern              | Choice                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| Transport            | TLS everywhere (Caddy or Nginx with Let's Encrypt in front of Express)                                         |
| Passwords            | `argon2`                                                                                                       |
| Tokens               | Short-lived JWT access tokens, rotating refresh tokens stored hashed                                           |
| Device credentials   | Per-device token, stored in NVS, revocable from the app                                                        |
| Rate limiting        | `express-rate-limit` with Redis store                                                                          |
| Input safety         | Zod validation on every route and tool                                                                         |
| Secrets              | Environment variables from a secret manager (Doppler, platform secrets); never in the app or firmware repo     |
| Data deletion        | Cascade deletes in PostgreSQL plus explicit Qdrant and S3 deletion jobs                                        |
| Third-party LLM data | Use local models for private documents by default; require consent before sending content to hosted free tiers |

---

## 12. Stack by Release

| Release                 | Stack parts introduced                                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1 Voice foundation** | Expo app shell and auth, Express + PostgreSQL + Prisma, WebSocket gateway, ESP32-S3 firmware (ESP-IDF/ADF/SR), Whisper + Piper, LangChain with one hosted LLM, Docker Compose |
| **R2 Productivity**     | Redis + BullMQ, `rrule` + `luxon`, Expo notifications, LangGraph agent with todo/reminder/schedule tools, OTA                                                                 |
| **R3 Study Brain**      | Qdrant, embeddings model, document pipeline (parsers, Tesseract), S3/MinIO, quiz and plan generation, LLM router with fallbacks, Langfuse                                     |
| **R4 Communication**    | `expo-contacts`, `expo-sms`, `Linking` intents, confirmation flow in LangGraph                                                                                                |
| **R5 Proactive**        | Analytics jobs, charts in the app, display UI with LVGL, nudges via BullMQ                                                                                                    |
| **R6 Advanced**         | Camera + vision models, multi-device sync, optional MQTT, expression system                                                                                                   |

---

## 13. Decision Log and Open Choices

| #   | Decision                                    | Status                 | Reason / what would change it                                                                                       |
| --- | ------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| D1  | Qdrant as the vector DB                     | Proposed               | The FRD mentioned pgvector as a simpler option. Switch to pgvector if you want a single database and fewer services |
| D2  | LangGraph for the agent                     | Proposed               | Needed for confirmation steps and stateful flows; plain LangChain agents are less controllable                      |
| D3  | BullMQ vs pg-boss                           | Open                   | Choose pg-boss if you want to avoid Redis in the MVP                                                                |
| D4  | Self-host Whisper/Piper vs hosted free APIs | Open                   | Depends on server hardware and the target languages                                                                 |
| D5  | ESP-IDF vs Arduino/PlatformIO               | Proposed ESP-IDF       | Choose Arduino only for a quick throwaway prototype                                                                 |
| D6  | Primary hosted LLM                          | Proposed Gemini + Groq | Re-evaluate after tool-calling tests on your own test set                                                           |
| D7  | UI kit (Paper vs Tamagui vs NativeWind)     | Open                   | Team preference                                                                                                     |
| D8  | Languages supported at launch               | Open                   | Drives STT, TTS, embedding model and LLM choices                                                                    |

---

## 14. Risks Specific to This Stack

| Risk                                               | Mitigation                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Free LLM tiers change limits or models             | LLM router with fallbacks; keep an Ollama option; abstract providers                                    |
| Free-tier data terms conflict with student privacy | Local models for private documents; explicit consent before sending to hosted APIs                      |
| Weaker free models misuse tools                    | Zod validation, retries, evaluation set, confirmation for outward actions                               |
| Voice latency                                      | Groq for fast replies, sentence-level TTS streaming, on-device wake word, server near the user's region |
| Expo limits on native features                     | Plan for development builds early; isolate native modules behind small wrappers                         |
| Self-hosted AI services need hardware              | Start with hosted free tiers for STT/LLM; move private or heavy workloads to local hardware as needed   |
| Vector DB isolation bug leaks documents            | Mandatory `userId` filter in a single retrieval helper; tests that try cross-user access                |

---

_End of document._
