# Robo Privacy Notice (Draft)

> **Draft for counsel review.** This is not legal advice and is not ready to
> publish. Replace placeholders, confirm the lawful basis and retention periods
> for each launch country, and have a qualified adviser review it before release.

## Who we are

Robo is a study assistant operated by **{{LEGAL_ENTITY}}** ("Robo", "we").
Contact: **{{PRIVACY_EMAIL}}**.

## What we collect

- **Account data:** name, email, hashed password or Google account identifier,
  locale, timezone and role.
- **Study data you create:** tasks, reminders, classes, exams, subjects, study
  sessions, quizzes, notes and memories.
- **Documents you upload:** file bytes, filename, type, size, checksum, extracted
  text, page-level chunks and embeddings.
- **Voice data:** audio turns streamed from a paired device, transcripts and
  generated speech. Audio is processed to answer the current turn and is not
  retained as a recording by the application.
- **Contacts:** only when you tap import; names, phone numbers and emails you
  choose to import.
- **Device data:** device identifier, firmware version, locale, pairing status,
  last-seen time and connection metadata.
- **Usage and diagnostics:** request IDs, AI token usage, tool outcomes, latency,
  error reports and crash diagnostics. We do not send document text or contact
  details to Sentry.

## Why we use it

- Provide the assistant, sync your study data and answer document questions.
- Operate reminders, deadlines, nudges and device pairing.
- Secure the service, diagnose failures and prevent abuse.
- Improve retrieval quality using de-identified evaluation sets.

We rely on **{{LAWFUL_BASIS}}** for each purpose. Consent is recorded separately
for microphone, contacts, documents and cloud AI, and can be withdrawn in
Settings → Privacy & consent.

## Sharing

- **Cloud AI:** off by default. When enabled, only the minimum retrieved document
  passages needed for an answer are sent to the configured provider.
- **Infrastructure providers:** hosting, object storage, email/push and error
  monitoring under data-processing agreements.
- **Legal:** where required by law or to protect users.

We do not sell personal data or use it for advertising.

## Retention

- Account and study data: until you delete your account.
- Documents and vectors: until you delete the document or your account.
- Voice turns: not stored as recordings; transcripts follow chat retention.
- Logs and error reports: **{{LOG_RETENTION}}**.
- Backups: **{{BACKUP_RETENTION}}**, then rotated out.

## Your rights

You can access, export, correct or delete your data in the app. Data export is
available under Settings → Data. Account deletion removes database rows, document
bytes and vectors. You may also contact **{{PRIVACY_EMAIL}}** or the relevant
data-protection authority.

## Children

The v1 product is intended for university students and adults. It is not directed
to children below the digital-consent age in the launch country. Guardian consent
is not offered as a substitute for the minimum age requirement.

## Security

We use TLS, hashed passwords, encrypted secrets, per-user access checks, signed
file downloads, prompt-injection defences and least-privilege infrastructure.
No system is perfectly secure; report concerns to **{{SECURITY_EMAIL}}**.

## Changes

We will update this notice before changing a purpose or sharing practice and will
notify users where required.
