# Robo Threat Model

## Assets

- Account credentials, refresh tokens and pairing codes.
- Study records, contacts, uploaded documents and extracted chunks.
- Voice audio in transit and transcripts.
- AI provider keys, S3 credentials, database credentials, signing keys.
- Device firmware and update chain.

## Actors

- Unauthenticated internet users and credential-stuffing bots.
- A signed-in user trying to read another user's data.
- A stolen phone or paired device.
- A malicious document author attempting prompt injection.
- A compromised dependency or infrastructure provider.
- An attacker with physical access to a device or server.

## Trust boundaries

1. Mobile app ↔ API over TLS.
2. Device ↔ gateway over WSS with a device token.
3. API ↔ PostgreSQL, Redis, Qdrant, S3 and model providers.
4. Uploaded documents ↔ model prompt context (untrusted data).
5. Build/release pipeline ↔ signed firmware and app binaries.

## Key threats and controls

| Threat | Controls |
| --- | --- |
| IDOR / cross-user reads | Every repository query includes `userId`; ownership tests; no client-supplied user IDs. |
| Token theft | Short-lived access tokens, hashed refresh tokens, rotation/revocation, device tokens scoped to one device. |
| Password attacks | Argon2/bcrypt hashes, login rate limits, generic error messages, account lockout via rate policy. |
| Prompt injection in documents | Passages wrapped as untrusted data, injection heuristics, system instruction not to follow document commands, no tool execution from document text. |
| Malicious uploads | MIME allow-list, size/quota checks, checksums, private bucket, signed short-lived URLs, isolated parsing. |
| OCR/parser denial of service | Upload limits, parser timeouts, retry caps, worker backoff. |
| Vector leakage | Qdrant filters always include `userId`; deletes by document/user. |
| Secrets leakage | Env-only secrets, no secrets in git, redacted logs, Sentry header scrubbing, secret scanning in CI. |
| Replay / forged device events | Device authentication, hello timeout, heartbeat, pairing-code expiry and one-time use. |
| Dependency compromise | Lockfiles, `allowBuilds`, audit gate for critical findings, Dependabot, review. |
| Lost device | Device revocation, token revocation, remote user session sign-out. |
| Backup theft | Encrypted backups, restricted bucket, retention and restore testing. |
| Firmware tampering | Secure boot, signed OTA, flash encryption, rollback protection (see secure-boot plan). |

## Residual risks

- LLM hallucinations and provider outages.
- Screenshots or shoulder-surfing on a user device.
- A user voluntarily sharing their own data.
- Zero-days in dependencies or the platform.
- Cloud AI provider retention outside our control (mitigated by opt-in and
  provider terms, not eliminated).

## Open items

- Independent penetration test before public launch.
- Real dependency and container image scanning with remediation SLAs.
- Rate-limit tuning under the 500-session load test.
- Firmware secure-boot provisioning and signed OTA rehearsal.
