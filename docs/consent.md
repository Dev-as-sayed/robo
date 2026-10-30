# Consent Records

Robo records consent per user and per purpose in `UserConsent`:

- `MICROPHONE` — voice capture.
- `CONTACTS` — reading a contact you select in the system contact picker.
- `DOCUMENTS` — storing and indexing uploaded files.
- `CLOUD_AI` — sending retrieved document passages to a cloud model.

Each record stores `granted`, `policyVersion`, `source`, `grantedAt` and
`revokedAt`. The API is:

- `GET /api/v1/users/me/consents`
- `PUT /api/v1/users/me/consents/:kind` with `{ "granted": true|false }`

The mobile app records consent when the user saves the privacy section, selects
a contact in the system picker, uploads a document or changes the cloud-AI
setting. Consent records are
included in data export and cascade-delete with the account.

This is an audit trail, not a substitute for platform permission prompts. A user
can grant the OS permission while withdrawing application consent, in which case
the feature must remain disabled.
