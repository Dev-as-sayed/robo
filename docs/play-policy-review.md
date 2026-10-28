# Google Play Policy Review

Review date: 2026-10-28
Scope: Android app `com.robo.app` (Expo SDK 51)
Status: engineering readiness review, not legal advice

This review checks the current mobile build, manifest, and store-facing behavior
against Google Play requirements that apply to the v1 launch. It records the
work that must be finished before a production submission.

## Current permission set

The effective Android manifest is derived with:

```bash
cd apps/mobile
pnpm exec expo config --type introspect
```

After this review it requests only:

| Permission | Source | Use |
| --- | --- | --- |
| `android.permission.INTERNET` | Expo | API, WebSocket, AI and sync traffic |
| `android.permission.READ_CONTACTS` | `expo-contacts` | User-initiated phone contact import |
| `POST_NOTIFICATIONS` | `expo-notifications` | Runtime reminder/nudge notifications |

The following permissions were present before this review and are now removed or
blocked in `app.json`:

- `RECORD_AUDIO` was added by `expo-image-picker` even though the app does not
  record audio. The image picker now sets `microphonePermission: false`.
- `WRITE_CONTACTS` was added by `expo-contacts` even though the app never writes
  to the device address book. It is blocked.
- `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` were added by
  `expo-image-picker`. The app uses the system photo picker, which grants access
  to the selected item only, so both broad storage permissions are blocked.
- Camera and microphone usage strings were removed from iOS because the app does
  not use either capability.

The app does not request SMS, Call Log, Phone, Location, `QUERY_ALL_PACKAGES`,
camera, or broad media permissions. Contact import remains the only sensitive
runtime permission.

## Release blockers

### 1. Target Android 16 (API 36)

The current Expo 51 / React Native 0.74 build targets Android 14 (API 34).
Since 2026-08-31, new apps and app updates submitted to Google Play must target
Android 16 (API 36) or higher. The published extension deadline is 2026-11-01.

Action: upgrade the Expo SDK to a release that targets API 36, rebuild, and test
notifications, edge-to-edge layout, photo picking, contacts, and WebSocket
reconnect behavior before submitting.

### 2. In-app reporting for AI-generated answers (implemented)

Chat and vision answers are generated with a third-party model. Google Play's
AI-Generated Content policy requires apps that generate AI content to provide
in-app reporting or flagging for offensive content, without sending the user out
of the app.

The app now shows a "Report" action under chat answers and vision explanations.
`POST /api/v1/chat/feedback` validates ownership, stores chat reports against the
assistant message ID, stores vision report text without a message, and reopens an
existing report instead of creating duplicates. Moderators can list and triage
reports through `GET /api/v1/admin/ai-feedback?status=OPEN` and
`PATCH /api/v1/admin/ai-feedback/:id`.

Action before release: verify the flow in a production build and define who
triages open reports. Reports are included in user data export and cascade-delete
with the account.

### 3. Account-deletion web resource (implemented, needs deployment)

The app has an in-app account deletion path and the server exposes
`DELETE /users/me`, which removes PostgreSQL rows, files, vectors and consent
records. Google Play also requires a functional web resource where users can
request deletion of their account and associated data.

The server now serves `GET /account/delete` and its script, backed by
`POST /api/v1/account/deletion-request`. The page names Robo, explains what is
deleted, and accepts a request without requiring the app. Requests are stored only
for existing accounts, rate-limited, and always receive the same `202` response.
A moderator verifies ownership by email before completing the request; completing
it runs the same cleanup as the in-app flow and cascades the request row.

Action before release: deploy the page on the public API domain, verify the flow
on a phone, enter the URL in Play Console, and assign the moderator who checks
pending requests. See [`account-deletion.md`](account-deletion.md).

### 4. Privacy policy and Data safety form

`docs/privacy-notice.md` is still a draft with placeholders for the legal entity,
contact address, lawful basis, log retention and backup retention. The Play
listing needs a public privacy-policy URL and a completed Data safety form that
matches actual behavior.

Action: complete legal review, host the policy, and fill the Data safety form.
The policy must name the categories of AI, infrastructure, storage, push and
error-monitoring providers. The form must disclose account data, contacts,
chat/voice content, uploaded documents, study activity, identifiers, and
diagnostics as applicable.

### 5. Contacts policy decision

Contact import is user-initiated and is preceded by an in-app explanation before
the system permission prompt. The app records consent, imports only names,
phones and emails, caps the batch at 200, de-duplicates, and offers manual entry
as an alternative.

On 2027-01-27 Google Play's Contacts Permissions policy becomes effective. Apps
that target Android 17 (API 37) or later may request `READ_CONTACTS` only when
the Android Contact Picker cannot provide the core functionality, or with an
approved Play Console declaration. The current app performs a broad contact-list
import, so it must either:

1. move to the system Contact Picker or per-contact selection before targeting
   API 37, or
2. keep broad import and submit a declaration that explains why the picker is
   insufficient.

Recommended: use per-contact selection. Importing the entire address book is not
required for calling or messaging one person, and it reduces privacy and review
risk. If broad import remains, record the product decision and prepare the
declaration before the next target-SDK increase.

## Findings that are compliant

### SMS, calls and telephony

The app opens `tel:`, `sms:`, `mailto:` and `wa.me` links after the user confirms
a pending action. It does not request `SEND_SMS`, `READ_SMS`, `READ_CALL_LOG`,
`READ_PHONE_STATE` or `READ_PHONE_NUMBERS`. This matches the Play policy that
reserves SMS and Call Log permissions for the default SMS/Phone/Assistant
handler.

Do not implement missed-call follow-up through call-log access. That feature
would require becoming the default phone handler and is not a reasonable v1
scope. The existing roadmap item should remain out of scope unless the product
becomes a dialer.

### Photo and document access

Photos are selected through the system photo picker and uploaded only after the
user chooses one. The in-app permission gate was removed because the picker does
not require broad library access. Document upload uses `expo-document-picker` and
does not request storage permissions.

### Notifications

Reminders and nudges use runtime notification permission. The app does not use
full-screen intents or request notification-listener access. Push payloads must
not contain message bodies, contact details or document text.

### Accounts and age

The v1 product is intended for university students and adults. The Play listing
must target an adult audience and must not opt into the Families program.
Guardian consent is therefore out of scope.

## Data safety mapping

Use this as input for the Play Console form; confirm each row against the
deployed build and provider contracts.

| Data type | Collected? | Purpose | Shared with | Notes |
| --- | --- | --- | --- | --- |
| Name, email, account ID | Yes | Account management, app functionality | Hosting provider | Required to sign in |
| Phone number | Optional | Account/profile, contact actions | AI provider when used in a request | Also present in imported contacts |
| Contacts | Optional | Contact lookup and calling/messaging actions | AI provider when the agent needs the contact | User-initiated import; delete with contact/account |
| Chat messages and AI prompts | Yes | App functionality | AI provider | Includes tool results and generated answers |
| Voice audio and transcripts | Device feature | Voice assistant | STT/TTS provider, AI provider | Audio is not retained as a recording; transcripts follow chat retention |
| Photos selected for vision | Yes, per request | App functionality | AI provider | Only the selected image is sent |
| Documents and extracted text | Optional | Document search and Q&A | Storage provider; AI provider only with cloud-AI consent | Private bucket and per-user vectors |
| Study activity (tasks, sessions, quiz results) | Yes | App functionality, insights | Hosting provider | Not used for ads |
| Push token and device identifiers | Yes | Notifications, device pairing | Expo push, hosting provider | Delete on sign-out/account deletion |
| Crash and diagnostic data | Optional | Security, reliability | Sentry if configured | `sendDefaultPii` is false; do not send content |
| AI answer reports | Optional | Safety and quality review | Hosting provider | Stores reason, optional details, message ID or vision answer text |
| Web deletion request | Optional | Account deletion | Hosting provider | Email and optional reason for existing accounts; removed on deletion or cleanup |

The app does not sell data or use it for advertising. Data is encrypted in
transit; account deletion is available in the app and through the public web
page. Deploy the page and enter its URL in Play Console before declaring deletion
support.

## Store listing and app-content checks

- Set the target audience to adults (18+) and complete the content rating.
- Declare the AI chatbot/assistant feature accurately in the store listing.
- Complete the Data safety and account-deletion sections consistently with the
  privacy policy.
- Provide a support URL and a monitored contact address. The in-app Help & FAQ
  and configurable support channel are in place; set `EXPO_PUBLIC_SUPPORT_EMAIL`
  or `EXPO_PUBLIC_SUPPORT_URL` before release. See
  [`support-faq.md`](support-faq.md).
- Do not claim on-device processing or "no data collection" while requests are
  sent to cloud providers.
- Keep screenshots and descriptions free of real student data, names, phone
  numbers or contact details.
- Complete the permissions declaration for contacts if broad import remains.

## Action checklist

- [ ] Upgrade Expo/target SDK to Android 16 (API 36) and re-test the release.
- [x] Add in-app AI answer reporting and a moderation triage path.
- [ ] Verify AI feedback reporting on a production build and assign triage.
- [x] Implement the account-deletion web page and moderator processing path.
- [ ] Deploy the deletion page on the public API domain and enter it in Play Console.
- [ ] Finalize and host the privacy policy; complete the Data safety form.
- [ ] Decide between Contact Picker and a broad-contacts declaration.
- [ ] Set the adult target audience and complete the content rating.
- [x] Remove unused microphone, contacts-write and storage permissions.
- [x] Review SMS/Call Log restrictions and confirm intent-only behavior.
- [x] Document the policy position and open blockers.

## Sources

- Target API level: <https://developer.android.com/google/play/requirements/target-sdk>
- Permissions and sensitive information: <https://support.google.com/googleplay/android-developer/answer/16558241>
- Contacts Permissions policy: <https://support.google.com/googleplay/android-developer/answer/16909972>
- SMS and Call Log permissions: <https://support.google.com/googleplay/android-developer/answer/10208820>
- User Data and account deletion: <https://support.google.com/googleplay/android-developer/answer/10144311>
- Account deletion requirements: <https://support.google.com/googleplay/android-developer/answer/13327111>
- AI-generated content: <https://support.google.com/googleplay/android-developer/answer/13985936>
