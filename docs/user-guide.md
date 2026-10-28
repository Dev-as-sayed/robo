# Robo Student Assistant — User Guide

This guide covers the mobile app as it exists in the repository. Device voice
features depend on firmware that is still being built; where a feature needs the
device, the phone app fallback is noted.

## 1. Create an account

1. Open the app and choose **Create account**.
2. Enter your name, email and a password of at least 8 characters.
3. Sign in with email/password, or use **Continue with Google** when the Google
   client ID is configured.
4. Choose your language and time zone during onboarding.

## 2. Talk to Robo

- **Chat** is the main tab. Type a question and send it; replies stream as they
  are generated.
- Ask for summaries, explanations, study plans or quizzes in plain language.
- Voice conversations are a device feature. The phone app currently supports
  text chat; device wake-word voice is not available until the firmware ships.
- If Robo needs more detail, it asks a follow-up question instead of guessing.
- Answers based on your uploaded documents show a **Sources** card with the
  document name and page.

## 3. Tasks and reminders

- **Tasks**: add a task, set a due date, mark it complete, or move it to today.
- **Reminders**: create one-time or repeating reminders. Robo can also create
  them from chat, for example "remind me every evening at 7".
- Reminders are delivered to the paired device when online, queued for the next
  reconnect when it is offline, and sent through Expo push when notifications
  are enabled.
- **Schedule**: add classes with room, start/end time and weekdays. Robo can
  answer "what class is next?" from this timetable.

## 4. Exams and study plans

- **Exams**: add an exam with a date and subject. Activate it, generate a study
  plan, then review and approve the plan.
- An approved plan creates tasks and a daily reminder.
- **Study**: start a focus session. The app records the session and shows a
  weekly summary in **Insights**.
- A device timer screen is planned with the firmware; the phone timer works now.

## 5. Upload course material

- Open **Documents** and choose a PDF, DOCX, PPTX, text/markdown file or image.
- Uploads are private to your account. The app shows parsing, OCR, chunking,
  embedding and indexing progress.
- When a document is **indexed**, ask questions about it in Chat. If a document
  fails, use **Retry**; to rebuild embeddings after a model change, use
  **Re-index**.
- Photo capture for handwritten pages is available on the **Vision** screen.

## 6. Quizzes and class notes

- **Quizzes**: generate a quiz from a subject or your documents, answer the
  questions, then review the score and explanations. Past attempts stay in the
  quiz history.
- **Class notes**: write notes during class and ask Robo to summarize them or
  turn them into tasks.
- **Memories**: Robo can remember durable preferences and facts you ask it to
  keep. Review or delete them at any time.

## 7. Contacts and approvals

- Import contacts only after granting the contacts permission. You can choose
  which contacts to import and delete them later.
- When you ask Robo to call or message someone, it prepares a draft and asks for
  confirmation on the **Approvals** screen. Nothing is sent until you tap
  **Confirm**. Drafts expire after five minutes.
- Call, SMS, WhatsApp and email actions open the matching app on your phone.

## 8. Devices

- Open **Devices** to see paired devices, rename them or revoke access.
- Pairing uses a short code shown in the app. Wi-Fi setup and QR pairing are
  planned with the firmware.
- A device can be factory-reset from the app or with the hardware button once
  firmware support lands.

## 9. Privacy and consent

- **Settings** has consent switches for microphone, contacts, documents and
  cloud AI processing. Turning a switch off revokes that consent.
- Cloud AI is used only when you enable it for document questions. Private
  document mode stays on the local Ollama model.
- You can export your data or delete your account from Settings. Deletion
  removes database rows, uploaded files and document vectors.
- Microphone audio is deleted after transcription. Transcripts and action logs
  are retained for 90 days by default.

## 10. Troubleshooting

| Problem | What to try |
| --- | --- |
| Sign-in fails | Check the API URL in the build, your connection, and that the account is verified. |
| No reply in Chat | Check the status banner; the app retries provider failures and falls back to another model. |
| Document stuck in parsing | Wait for the retry backoff, then tap **Retry**. Check that OCR language data is installed on the server. |
| No reminders | Allow notifications, keep the app installed, and confirm the reminder time zone in Settings. |
| A paired device is offline | Check its Wi-Fi and power, then reopen **Devices**. Reminders queue for the next connection. |
| Upload rejected | Check the file type and size limits shown on the Documents screen. |

For operator and deployment issues, see `docs/production-operations.md`.
