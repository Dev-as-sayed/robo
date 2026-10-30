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

## Phase 0 — Baseline and Scope Record

**Estimate:** 0.5 day

- [ ] Checkpoint the current uncommitted auth/push work on a branch or commit, with approval.
- [ ] Mark APP-02 and voice-note input as explicitly descoped in `todo.md`, `report.md` and any external FRD.
- [ ] Create an acceptance checklist mapping every remaining item to a phase and verification method.

**Exit criteria:** Current work is safely checkpointed, descopes are documented, and every remaining item has an owner phase.

## Phase 1 — Release Config and Device Build

**Estimate:** 1–2 days plus build time

- [ ] Add `EXPO_PUBLIC_API_URL` to the development, preview and production EAS profiles.
- [ ] Keep local LAN overrides for local development.
- [ ] Add a release check that fails when the production API URL is missing or points at localhost.
- [ ] Configure Android signing credentials and FCM V1 push credentials in EAS.
- [ ] Build and install the EAS development client on the physical Android device.

**Exit criteria:** The authenticated app launches against the deployed API; `expo config`, mobile typecheck, lint and Prettier pass.

## Phase 2 — Schedule and Home

**Estimate:** 2–3 days

- [ ] Make `getSchedule` exception-aware and timezone-aware.
- [ ] Add an `includeSkipped` option and expose exception IDs.
- [ ] Add DELETE exception support for Undo.
- [ ] Add server/shared tests for exception filtering and removal.
- [ ] Add mobile schedule editing using the existing PATCH endpoint.
- [ ] Add delete confirmation and a skipped-class section with Undo.
- [ ] Show the next class across days on Home, excluding skipped entries.
- [ ] Include active and draft exams in the Home countdown/readiness area.

**Exit criteria:** Skipped classes disappear from Home and Schedule, Undo restores them, and edits/deletes refresh consistently.

## Phase 3 — Persisted Exam Plans

**Estimate:** 1.5–2 days

- [ ] Add `getPlan(userId, examId)` to shared exam logic.
- [ ] Add `GET /exams/:id/plan` with approval state, daily tasks and linked todo status.
- [ ] Add tests for ownership, missing plans and approved plans.
- [ ] Replace local generated-plan state with a server-backed mobile plan query.
- [ ] Invalidate the plan after generate, approve and recalculate.
- [ ] Add `/exams?examId=...` deep-link selection.
- [ ] Make the chat plan card route to the selected exam.

**Exit criteria:** Generated and approved plans survive navigation and reload, and chat-created plans are visible.

## Phase 4 — Chat Hardening and Actions

**Estimate:** 2–3 days

- [ ] Add a mobile `listConversations` client.
- [ ] Hydrate the latest conversation on mount.
- [ ] Persist the active conversation ID and support starting a new chat.
- [ ] Make streaming cancellation immediate.
- [ ] Add request and inactivity timeouts.
- [ ] Guard against late callbacks after cancellation.
- [ ] Restore the input and message state on streaming failure.
- [ ] Add per-item display actions for citations.
- [ ] Emit document IDs and pages from the server for citations.
- [ ] Open Documents at the matching document/page when a citation is tapped.
- [ ] Add a Review action to confirmation cards that opens the matching pending action in Approvals.
- [ ] Keep voice notes descoped and documented.

**Exit criteria:** Streaming is verified on-device, stop/error paths leave a usable chat, and citations and confirmation cards are tappable.

## Phase 5 — Vision, Documents and Settings

**Estimate:** 1.5–2 days

- [ ] Enable camera permission and add camera/library source selection using `expo-image-picker`.
- [ ] Test camera capture and upload on the physical device.
- [ ] Refetch documents on focus.
- [ ] Poll only while a document is processing, stopping on terminal states.
- [ ] Update `auth.user` in Redux after `updateMe` succeeds.
- [ ] Ensure profile, language and consent-driven UI refresh immediately.

**Exit criteria:** Camera capture works on-device, document status updates automatically, and profile/preference changes reflect across screens.

## Phase 6 — i18n and RTL Readiness

**Estimate:** 3–4 days, parallelizable after Phase 3

- [ ] Build typed English and Hindi dictionaries.
- [ ] Replace all static user-facing mobile strings.
- [ ] Localize date and number formatting.
- [ ] Localize server-authored display labels while leaving AI response text in the conversational language.
- [ ] Persist the selected locale and fall back to the device locale.
- [ ] Make layouts start/end-aware.
- [ ] Verify a forced-RTL development build.
- [ ] Do not ship an RTL locale.

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

Critical path: Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7.

i18n can start after Phase 3 and overlap with Phases 4–5, but the final string sweep must follow all UI changes.

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
