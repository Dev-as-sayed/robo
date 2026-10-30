# Mobile App Completeness Report

- **Date:** 2026-10-30
- **Scope:** `apps/mobile` against the mobile items in `todo.md`
- **Verdict:** **Not complete.** The app typechecks and lints, and most screens/API calls exist, but several checked todo items are overstated and there are runtime/configuration blockers.
- **Todo state:** reconciled in [`todo.md`](todo.md); follow-ups are under “Mobile Audit Follow-ups (2026-10-30)”.

## Method

- Reviewed all mobile screens, API clients, auth/session code, notifications, realtime, i18n and build configuration.
- Compared mobile endpoint paths and response shapes with the server routes and shared packages.
- Ran `pnpm --filter robo-mobile typecheck` and `pnpm --filter robo-mobile lint`; both pass.
- No EAS development build, physical device, emulator or Maestro run was available, so device-only behavior is marked **runtime-unverified**.
- The audit itself changed no product files; follow-up fixes and their verification are tracked in `todo.md`.

## Executive summary

The app is broad and mostly wired: auth, onboarding, Today, chat, tasks, reminders, schedule, exams, documents, quizzes, study, insights, activity, contacts, approvals, class notes, memories, vision, help and settings all have screens. All mobile-called server routes exist.

However, the mobile scope cannot be called complete because:

1. Release builds default to `http://localhost:3000/api/v1` unless `EXPO_PUBLIC_API_URL` is configured externally.
2. Several checked items are only partial: schedule editing/exceptions, Home next-class/exam visibility, exam-plan persistence, tappable citations, live document status, camera capture and i18n/RTL.
3. APP-02 device provisioning and APP-20 EAS development build are still open.

## Status by todo area

| Area                     | Status | Summary                                                                                                                                                                           |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1.6 Mobile foundation   | ◐      | Auth lifecycle now clears state on terminal refresh failures and restores a cached profile after transient failures; EAS build, device setup and streaming-on-device remain open. |
| R2.5 Mobile productivity | ◐      | Screens exist; push is code-complete but unverified on a development build, and Home/Schedule have completion gaps.                                                               |
| R3.5 Mobile study        | ◐      | Documents, quizzes and plans exist; plan approval is not reload-safe and citations are not individually tappable.                                                                 |
| R4 Mobile communication  | ◐      | Contact picker and approvals are code-complete; runtime permission/EAS verification remains.                                                                                      |
| R5 Mobile proactive      | ◐      | Insights/trends/nudges and the app study timer exist; the device timer remains firmware-blocked.                                                                                  |
| X.2/X.4 Verification     | ◐      | Typecheck/lint pass; Maestro, EAS build, Android 16 smoke and store verification remain.                                                                                          |

## Critical findings

### P0-1 — Production API URL is not set in EAS profiles

**Evidence**

- `API_URL` defaults to `http://localhost:3000/api/v1` (`apps/mobile/src/config.ts:1-3`).
- EAS profiles only set `EXPO_PUBLIC_SENTRY_ENVIRONMENT` (`apps/mobile/eas.json:12,19,26`); `docs/mobile-release.md` covers Sentry/support but not the API URL.

**Impact:** A production build silently targets localhost and cannot reach the server.

**Fix:** Add `EXPO_PUBLIC_API_URL` to the EAS development/preview/production environments and document it as a release prerequisite.

**Acceptance:** A production bundle points at the deployed HTTPS API; the release checklist fails if the variable is absent.

### P1-1 — Device provisioning is incomplete

**Evidence**

- Pairing code, device list/status, rename, revoke and reset exist (`apps/mobile/app/(app)/devices.tsx`), but there is no QR scanner, BLE client or Wi-Fi provisioning flow.
- The QR payload is `robo://pair?code=...` (`packages/shared/src/devices/index.ts:98`), but the app has no `app/pair.tsx` route.
- Device status refreshes only on pull-to-refresh; factory reset has no confirmation or error handling.

**Impact:** APP-02 and the hardware pairing flow cannot be completed from the app.

**Fix:** Add `expo-camera` QR scanning, `react-native-ble-plx` provisioning, the `robo://pair` route, reset confirmation and live device invalidation. If provisioning is intentionally firmware/CLI-only for v1, explicitly descope APP-02 and update the FRD/todo.

**Acceptance:** Scan pairing QR → provision Wi-Fi over BLE → see the device come online without pull-to-refresh; reset requires confirmation.

### P1-2 — Schedule editing and exceptions are incomplete

**Evidence**

- `schedule.tsx` imports create/delete/exception hooks but not `useUpdateScheduleMutation` (`apps/mobile/app/(app)/schedule.tsx:11-16`) even though the mutation exists (`apps/mobile/src/api/schedule-api.ts:43-52`).
- “Skip today” always posts today’s date (`schedule.tsx:191-199`).
- `getSchedule` returns all entries and does not filter exceptions (`packages/shared/src/schedule/index.ts:85-105`); exceptions only suppress class alerts.

**Impact:** Users cannot edit classes, and skipping a class does not remove it from Schedule or Home.

**Fix:** Add edit UI, filter exceptions in the schedule read path (or return an occurrence view), and provide undo.

**Acceptance:** Edit updates the entry; “Skip today” removes that day from Schedule/Home and does not suppress future occurrences.

### P1-3 — Home next-class and exam countdown are partial

**Evidence**

- `upcomingClass` only considers entries starting today (`apps/mobile/app/(app)/index.tsx:46-57`).
- The exam query requests `status: "active"` only (`index.tsx:98`), while new exams start as drafts.

**Impact:** The “NEXT CLASS” card shows nothing when the next class is tomorrow; a newly added exam is invisible on Home.

**Fix:** Search the next future occurrence across days and include draft exams (or clearly label a separate active-exam countdown).

**Acceptance:** Home shows tomorrow’s first class and a newly created exam without activating it.

### P1-4 — Exam plan approval is not reload-safe

**Evidence**

- The generated plan is component state only (`apps/mobile/app/(app)/exams.tsx:60`), and approve/recalculate UI is gated on that local state (`exams.tsx:342-374`).
- There is no GET-plan endpoint, so plans created through chat/tools cannot be displayed or approved.

**Impact:** Reloading loses the plan; the checked “approve/edit” claim is not durable.

**Fix:** Add a persisted plan read endpoint and hydrate the screen from it; keep local state only for loading/optimistic UI.

**Acceptance:** Reload or reopen the exam and approve/recalculate the existing plan.

### P1-5 — Chat citations are not tappable

**Evidence**

- Plan and quiz cards are pressable (`apps/mobile/app/(app)/chat.tsx:235-274`), but citation rows are plain `Text`; only the whole Sources card routes to `/documents`.
- Citation metadata includes source/page/score, but there is no document detail/download route in the mobile API.

**Impact:** The R3.5 “tappable citations” requirement and the RAG-08 document/page link are not met.

**Fix:** Give citation rows their own action (document detail or signed download URL) and pass the document/page target.

**Acceptance:** Tapping a citation opens the cited document at the relevant page or a document detail view.

### P1-6 — Document processing status is not live

**Evidence**

- `useDocumentsQuery` has no polling/refetch interval (`apps/mobile/app/(app)/documents.tsx:86`); after upload, status changes only when the user taps Refresh.

**Impact:** The upload-to-indexed flow looks stuck even when the server is progressing.

**Fix:** Poll while any document is non-terminal, or refetch on focus/app foreground.

**Acceptance:** Status advances automatically through parsing → OCR → chunking → embedding → indexed/failed.

### P2-1 — Vision is library-only

**Evidence**

- `vision.tsx` calls `launchImageLibraryAsync` (`apps/mobile/app/(app)/vision.tsx:35-38`) and does not request camera permission; `app.json` disables camera permission for the image picker plugin.

**Impact:** The checked photo-permission/camera claim is overstated; users cannot capture a homework page directly.

**Fix:** Add camera capture and permission rationale, or update the FRD/todo to “photo library only”.

**Acceptance:** Camera capture works on Android/iOS or the scope is explicitly changed.

### P2-2 — Settings save does not refresh the auth user

**Evidence**

- `settings.tsx` calls `updateMe()` but never dispatches `setUser` (`apps/mobile/app/(app)/settings.tsx:126-139`); only onboarding/sign-in/sign-up/session restore update the auth user.

**Impact:** Name/locale changes leave nav labels and user-derived UI stale until restart.

**Fix:** Dispatch `setUser` with the mutation response (or refetch `/users/me`) after save.

**Acceptance:** Changing language updates translated UI immediately; changing name updates Home without restart.

### P2-3 — i18n/RTL is only a foundation

**Evidence**

- Only five tab labels are translated (`apps/mobile/src/i18n/index.ts:9-25`).
- `textDirection()` exists but is unused (`i18n/index.ts:44-46`); no RTL styles/forceRTL/isRTL consumers exist.
- Device locale is not read; onboarding offers only `en`/`hi`; most screens, alerts and validation messages are hardcoded English.

**Impact:** APP-28 remains open; an RTL language cannot ship on this foundation.

**Fix:** Move screen strings into the dictionary, consume `direction`/`isRTL`, validate supported locales, and test an RTL locale.

**Acceptance:** A supported RTL locale flips layout and captures all visible strings.

### P2-4 — Verification is still device-dependent

**Evidence**

- Mobile has no unit tests; Maestro flows exist in `.maestro/` but have not been run.
- Typecheck/lint pass, but there is no EAS development build or Android 16 device smoke test; the linked EAS project has not been exercised on a physical device.

**Impact:** Streaming, push, permissions, BLE, camera, edge-to-edge and reconnect behavior remain unverified.

**Fix:** Build an EAS development client, run the Maestro smoke/sign-in flows, and execute the Android 16 checklist.

**Acceptance:** The release checklist in `docs/mobile-release.md` is signed off on a physical device.

## Todo reconciliation

The audit changed the following mobile-related checkboxes/notes in `todo.md`:

| Item                     | Previous | Now                              | Reason                                                                               |
| ------------------------ | -------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| P0.4 root pnpm workspace | Open     | Done                             | `pnpm-workspace.yaml` exists and CI uses it.                                         |
| APP-03 Home              | Done     | Open                             | Next class is today-only; draft exams are hidden.                                    |
| APP-05 Tasks/reminders   | Done     | Done with caveat                 | Repeat reminder can anchor at midnight without a time.                               |
| APP-06 Schedule          | Done     | Open                             | No edit UI; exceptions do not remove entries.                                        |
| APP-07 Exams/plan        | Done     | Open                             | Plan approval lives only in local state.                                             |
| APP-08 Documents         | Done     | Done with caveat                 | Status requires manual refresh; no open/download.                                    |
| APP-23 Push              | Open     | Code complete, device-unverified | Project linked; sign-out revocation, cold-start taps and notification routing added. |
| APP-28 i18n/RTL          | Open     | Open, expanded                   | Foundation only; no RTL activation or full translation.                              |
| R3.5 Chat cards          | Done     | Open                             | Citations are not individually tappable.                                             |
| X.2 Maestro              | Done     | Open                             | Flows authored but never run.                                                        |

All other mobile checkboxes were left unchanged.

## Recommended fix order

1. **Release configuration** — set `EXPO_PUBLIC_API_URL`, build a development client.
2. **Product gaps** — Schedule edit/exceptions, Home next class/drafts, persisted exam plans, tappable citations.
3. **Remaining polish** — document status polling, camera capture, settings user refresh, i18n/RTL.
4. **Verification** — Android 16 device smoke, Maestro flows, push/streaming/reconnect checks.

## Verification commands

```bash
pnpm --filter robo-mobile typecheck
pnpm --filter robo-mobile lint
pnpm --dir apps/server typecheck
pnpm --dir apps/server lint
pnpm --dir apps/server test
```

All pass as of this report (server lint exits with warnings only). Not run: EAS build, Maestro, physical-device smoke tests, live push, BLE/camera provisioning.

## Definition of done for closing this report

- [ ] The P0 items are fixed and covered by tests where the code is testable.
- [ ] `todo.md` mobile checkboxes reflect verified behavior, not just code presence.
- [ ] A development build passes the Android 16 smoke checklist and Maestro flows.
- [ ] Push, chat streaming, contacts, photo picker, edge-to-edge layout and WebSocket reconnect are demonstrated on a device.
- [ ] The remaining open items are either implemented or explicitly descoped in `todo.md` and the FRD.
