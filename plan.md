# Mobile v1 Completion Plan

## Scope Decisions

- **APP-02:** Descope QR/BLE/Wi-Fi provisioning for v1. Keep the pairing code, device list/status, rename, revoke and reset flows. Record the descope in `todo.md`, `report.md` and any external FRD.
- **Voice-note input:** Descope for v1. Close APP-04 as text-chat only and document the gap.
- **i18n:** Full English and Hindi static UI translation, with RTL-ready layouts. Do not ship an RTL locale. AI-generated message content is not translated.
- **Verification target:** Android physical device using an EAS development build and a production build.

## Inputs Required

- Production HTTPS API base URL.
- EAS signing credentials and Android FCM V1 push credentials.
- Test account for authenticated Maestro flows.
- Three to five closed-alpha testers.

## Acceptance Checklist

| Item                            | Phase      | Verification                                                              |
| ------------------------------- | ---------- | ------------------------------------------------------------------------- |
| APP-02 provisioning             | Descoped   | `todo.md` and `report.md` record the v1 descope; no QR/BLE code is added.  |
| Voice-note input                | Descoped   | APP-04 is text-only and the gap is recorded.                              |
| Production API URL              | 1          | Production EAS env uses HTTPS; release check rejects missing/localhost.   |
| EAS development build and FCM   | 1, 7       | Development build installs on Android; push credentials are valid.        |
| Push registration and routing   | 7          | Foreground/background/killed delivery, cold start and sign-out revocation. |
| Schedule edit/exceptions/undo   | 2          | Server tests pass; skipped entries vanish and Undo restores them.          |
| Home next class and draft exams | 2          | Tomorrow’s class and a draft exam appear without activation.              |
| Persisted exam plans            | 3          | GET-plan tests pass; plan survives reload and chat deep link.              |
| Chat history and streaming      | 4          | Reload restores history; stop/error/timeout paths are usable on-device.    |
| Citations and confirmations     | 4          | Citation opens the document/page; confirmation opens the pending action.   |
| Vision camera                   | 5          | Camera capture and upload work on the physical device.                    |
| Document status                 | 5          | Status advances without manual refresh and stops on terminal states.      |
| Settings auth refresh           | 5          | Name and language changes update UI immediately.                          |
| i18n and RTL                    | 6          | English/Hindi switch is complete; forced-RTL smoke test passes.           |
| Closed alpha                    | 7          | No open P0/P1 findings.                                                    |

## Phase 1 — Release Config and Device Build

**Estimate:** 1–2 days plus build time

- [ ] Configure Android signing credentials and FCM V1 push credentials in EAS.
- [ ] Build and install the EAS development client on the physical Android device.

**Exit criteria:** The authenticated app launches against the deployed API; `expo config`, mobile typecheck, lint and Prettier pass.

## Phase 6 — i18n and RTL Readiness

**Estimate:** 3–4 days, parallelizable after Phase 1

### Completion Roadmap

**✅ Done:** Build typed English and Hindi dictionaries (50+ keys each)

**🔄 In Progress:** Replace all static user-facing mobile strings

| # | Screen | Translation Keys Needed | Status |
|---|--------|------------------------|--------|
| 1 | Layout (tab nav) | nav.today, nav.chat, nav.tasks, nav.insights, nav.settings | ✅ Complete |
| 2 | Activity | statusLabels, filterOptions, app.error, app.cancel, app.confirm | ✅ Complete |
| 3 | Approvals | app.loading, app.confirm, card titles, expiry labels | ✅ Complete |
| 4 | Chat | app.send, app.stop, chat.placeholder, chat.send, chat.stop | ✅ Complete |
| 5 | Settings | settings.title, settings.quiet_hours, settings.wake_phrase, settings.nudges, settings.cloud_ai_docs, settings.export, settings.delete_account, settings.sign_out | ✅ Complete |
| 6 | Tasks | tasks.no_tasks, tasks.priority.low, tasks.priority.medium, tasks.priority.high, tasks.create, filters, priorities | ✅ Complete |
| 7 | Reminders | reminders.title, reminders.snooze, channelLabels (device/phone/push), filters, linkedOptions | ✅ Complete |
| 8 | Schedule | schedule.title, skip_today, no_entries, delete_entry, no_scheduled, add_first_class_below, skip, undo_skip, delete, save_changes, add_entry, refresh | ✅ Complete |
| 9 | Exams | exam.activate, exam.recalculate, exam.plan, exam.revision_summary, exam titles | 🔄 In Progress |
| 10 | Insights | insights.title, insights.no_data, insights.study_minutes, insights.completed_tasks, insights.completed_quizzes, insights.upcoming_exams, insights.day_streak | ⏳ Pending |
| 11 | Documents | documents.title, documents.upload, documents.no_documents, documents.parsing, documents.ocr, documents.chunking, documents.embedding, documents.indexed, documents.failed, browse/download actions | ⏳ Pending |
| 12 | Profile | profile.name, profile.locale, profile.quiet_hours, profile.nudges | ⏳ Pending |

**📝 Localization Tasks (after string replacement):**
- [ ] Localize date and number formatting (Hindi ltr/rtl dates, numeric formats)
- [ ] Verify forced-RTL development build passes smoke test
- [ ] Final sweep: ensure zero untranslated static strings remain
- [ ] Run RTL layout tests (start/end-aware gaps, margins, flex directions)

**✅ Completed:** Persist selected locale, fall back to device locale
**✅ Completed:** Make layouts start/end-aware
**✅ Documented:** Do not ship an RTL locale

**Exit criteria:** Language switching updates the whole UI, no untranslated static strings remain, and the forced-RTL smoke test passes.

## Phase 7 — Device Verification and Closed Alpha

**Estimate:** 2–3 days

- [ ] Install the EAS development build on the physical Android device.
- [ ] Verify push in foreground, background and killed states.
- [ ] Verify notification routing, cold start, deduplication and sign-out token revocation.
- [ ] Run Android 16 checks: permissions, contacts picker, camera, notifications, edge-to-edge, links and WebSocket reconnect.
- [ ] Install Maestro and run the existing smoke and sign-in flows.
- [ ] Add Maestro flows for schedule edit/undo, exam plan reload, chat history and citations.
- [ ] Run a closed alpha with three to five testers.
- [ ] Triage and fix P0/P1 issues.

**Exit criteria:** All non-descoped mobile items are checked, zero P0/P1 audit findings remain, and the release checklist is updated.

## Sequencing

Critical path: Phase 1 → 4 → 5 → 6 → 7. Phases 2 and 3 are complete and removed.

i18n can overlap with Phases 4–5, but the final string sweep must follow all UI changes.

## Estimate

Roughly **13–19 developer-days**, or **3–4 calendar weeks** including EAS builds and alpha feedback.

## Risks

- Missing production API URL or signing/FCM credentials blocks Phase 1 and release.
- APP-02 and voice notes remain functional gaps and must be accepted as v1 descopes.
- Server-authored display and API text may require a localization layer beyond the mobile dictionaries.
- Android push, camera and background streaming require the physical device and a real development build.

## Definition of Done

- [ ] All non-descoped mobile audit items are complete.
- [ ] Descoped items are explicitly recorded in `todo.md` and `report.md`.
- [ ] Push works on the physical Android device in all app states.
- [ ] Maestro smoke and feature flows pass.
- [ ] Closed alpha feedback has no open P0/P1 issues.
- [ ] The mobile release checklist is complete for Android v1.
