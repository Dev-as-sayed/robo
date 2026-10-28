# Robo AI tools and agent setup

Robo is a student assistant. The agent reads and changes the student's own data through tools, so answers about schedules, tasks, reminders, exams, and documents are grounded in PostgreSQL or Qdrant rather than invented by the model.

## Tool contract

- Every tool uses a Zod schema shared by validation and the model tool definition.
- `userId` comes from the authenticated request context and is never a model argument.
- Every call writes an `ActionLog` row with input, output, status, error, and duration.
- Delete and cancel tools use a two-step confirmation flag. The first call returns `requiresConfirmation: true`; the model may only send `confirm: true` after the student explicitly agrees.
- Tools return JSON with `ok`, `data` or `error`, and optional `requiresConfirmation`.
- The agent loop is capped by `AI_AGENT_STEP_LIMIT` (default 8).

## Implemented tools

| Tool | Purpose | Writes | Confirmation | Maps to |
| --- | --- | --- | --- | --- |
| `get_current_time` | Student's local date, time, and time zone | No | No | R2.3, AGT-02 |
| `get_schedule` | Classes and schedule entries, default next 7 days | No | No | R2.3, FR-CLS-01 |
| `list_todos` | List tasks by status, subject, or due date | No | No | R2.3 |
| `create_todo` | Create a task | Yes | No | R2.3, FR-PRD-01 |
| `update_todo` | Change task fields or status | Yes | No | R2.3 |
| `complete_todo` | Mark a task completed | Yes | No | R2.3 |
| `delete_todo` | Delete a task | Yes | Yes | R2.3 |
| `list_reminders` | List reminders by status or channel | No | No | R2.3, FR-PRD-02 |
| `create_reminder` | Create a one-off or recurring reminder | Yes | No | R2.3, FR-PRD-03 |
| `cancel_reminder` | Delete a reminder | Yes | Yes | R2.3 |
| `snooze_reminder` | Snooze a reminder | Yes | No | R2.1, FR-PRD-05 |
| `start_timer` | Start a speaker timer and create its backing reminder | Yes | No | R2.3, R2.4 |
| `create_alarm` | Create a speaker alarm at a local date/time | Yes | No | R2.3, R2.4 |
| `device_show` | Show a text/timer/study/exam card on the speaker | No | No | R2.3, FW-06 |
| `device_speak` | Make the speaker say a short message | No | No | R2.3, FW-05 |
| `list_exams` | List exams ordered by date | No | No | R2.3, FR-EXM-01 |
| `create_exam` | Create an exam with topics and weight | Yes | No | R2.3 |
| `get_exam` | Get one exam | No | No | R2.3 |
| `get_exam_readiness` | Preparation percentage for an exam | No | No | R3.3, FR-EXM-05 |
| `get_revision_summary` | Tasks left, weak topics and next revision step | No | No | R3.3, FR-EXM-07 |
| `create_study_plan` | Create a draft study plan for an exam | Yes | Approval later | R3.3, FR-EXM-02 |
| `approve_study_plan` | Create tasks and a daily reminder from a plan | Yes | No | R3.3, FR-EXM-03 |
| `plan_today` | Rank today's tasks with class, exams and reminders | No | No | R5, FR-ANL-06 |
| `list_subjects` | List subjects with topic counts | No | No | R3.3, FR-EXM-04 |
| `get_subject_topics` | Get topics and mastery for a subject | No | No | R3.3, FR-EXM-04 |
| `get_existing_tasks` | List pending tasks before planning | No | No | R3.3, FR-EXM-04 |
| `save_class_note` | Save a note linked to a class | No | No | R3.3, FR-CLS-04 |
| `query_class_notes` | Search class notes by subject, date or text | No | No | R3.3, FR-CLS-05 |
| `save_memory` | Save a durable preference, fact, goal or study detail | No | No | R3.10, FR-AI-05, AGT-11 |
| `list_memories` | List saved long-term memories | No | No | R3.10, FR-AI-05, AGT-11 |
| `forget_memory` | Delete one saved memory | No | No | R3.10, FR-AI-05, AGT-11 |
| `get_analytics_summary` | Study activity summary for a range | No | No | R5, FR-STM-08 |
| `find_contact` | Find a contact by name, phone, or email | No | No | R4, FR-COM-01 |
| `list_documents` | List uploaded study documents | No | No | R3.1, FR-DOC-01 |
| `search_documents` | Search the student's indexed chunks with a mandatory `userId` filter | No | No | R3.2, RAG-06 |
| `generate_quiz` | Generate a validated practice quiz | Yes | No | R3.3, FR-DOC-06 |
| `record_quiz_result` | Record quiz answers and return the score | Yes | No | R3.3, FR-DOC-10 |
| `start_study_session` | Start a timed study session and show it on the speaker | Yes | No | R5, FR-STM-01 |
| `end_study_session` | End the current/specific session and report study minutes | Yes | No | R5, FR-STM-01 |

## Tools still needing backend work

| Tool | Blocker |
| --- | --- |
| `save_class_note`, `query_class_notes` | Needs class-note models and API |
| `get_subject_topics` | `Subject` and `Topic` models/API exist; tool wiring is still pending |
| `record_quiz_result` | Can use the existing attempt endpoint once quiz answers are exposed |
| `prepare_call`, `prepare_message` | Needs an app action/intent channel and explicit confirmation |
| `start_study_session`, `end_study_session` | Needs study session routes and services |

## AI setup

| Layer | Current implementation |
| --- | --- |
| Orchestration | LangChain.js `createReactAgent` from `@langchain/langgraph/prebuilt` |
| Agent memory | `PostgresSaver` checkpointer, thread id = conversation id |
| Short-term history | `Conversation` and `Message` tables |
| Model routing | `getChatModel(task)` and `getChatModels(task)` with configurable provider chains |
| Agent fallback | All configured models are bound to the same tools and wrapped with `.withFallbacks` |
| Structured output | `generateStructured(schema, prompt)` retries the configured structured chain |
| Embeddings | `OllamaEmbeddings`, default `bge-m3` |
| Vector search | Qdrant with payload filter `{ userId }` on every query; collection and payload indexes are created on first index |
| Tracing | Optional Langfuse `CallbackHandler` with pseudonymized user ids |
| Action audit | `ActionLog` table and `GET /api/v1/actions` |
| Prompt | Name, locale, time zone, current time, tool-use and confirmation rules |

## Configuration

Required for the agent:

```dotenv
DATABASE_URL=postgresql://...
LLM_AGENT_TOOLS_CHAIN=gemini:gemini-2.5-flash,groq:llama-3.3-70b-versatile,openrouter:meta-llama/llama-3.3-70b-instruct:free,ollama:llama3.2
AI_AGENT_STEP_LIMIT=8
```

At least one provider must have a key. Document search additionally needs:

```dotenv
OLLAMA_BASE_URL=http://localhost:11434
EMBEDDING_MODEL=bge-m3
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=document_chunks
QDRANT_SCORE_THRESHOLD=0.35
```

Tracing is disabled unless both Langfuse keys are set.

## Known gaps

- Document ingestion, OCR, chunking, and indexing are not wired to Qdrant yet.
- Token quotas and degraded mode are not implemented.
- Long-term memory tools are not implemented.
- Device audio turns stream agent tokens through the sentence splitter into TTS; hardware playback and barge-in are still untested.
- Device tools still need server-initiated event routing; see `docs/device-gateway.md`.
- The confirmation flag is a basic model-facing safeguard; a server-enforced pending-action flow is still needed for production.
