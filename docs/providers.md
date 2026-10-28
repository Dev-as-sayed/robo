# Provider Limits and Data Terms

Checked against provider documentation on **2026-10-25**. Free tiers change
without notice; the provider console is authoritative. Use paid plans for beta
and production traffic, and never send a student's private documents to a free
tier that may use inputs for model improvement.

## AI and speech providers

| Provider | Used for | Env vars | Free-tier limits | Data handling |
| --- | --- | --- | --- | --- |
| Google Gemini API | General chat, structured output, vision | `GEMINI_API_KEY`, `LLM_*_CHAIN` | Free tier is available on selected Flash/Flash-Lite models and is rate-limited per model. Exact RPM/TPM/RPD are shown in AI Studio and change frequently. Paid tiers have monthly spend caps. | Free-tier prompts and responses can be used to improve Google products. Paid-tier terms differ. Send only data the user has consented to share. |
| Groq | Fast voice chat fallback, Whisper fallback | `GROQ_API_KEY`, `LLM_*_CHAIN` | Example free limits for `openai/gpt-oss-120b`: 30 RPM, 1,000 requests/day, 8K tokens/min, 200K tokens/day. Whisper: 7,200 audio seconds/hour and 28,800/day. Limits are per organization and can vary by model. | Groq's services terms state that inputs/outputs are not used to train models, except for abuse/legal handling. Confirm the current DPA before enabling for real users. |
| OpenRouter | Optional model fallback | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `LLM_*_CHAIN` | Free `:free` model variants: 20 RPM and 50 requests/day with less than $10 lifetime credits; 1,000 requests/day after $10. Paid models have no OpenRouter plan cap, but upstream limits apply. | Routing may go to third-party providers with different retention and training policies. Review provider routing and privacy settings; do not assume free variants are private. |
| Ollama (local) | Private-document chain, local fallback, embeddings | `OLLAMA_BASE_URL`, `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBEDDING_MODEL` | No request fee; limited by the host's CPU/GPU/RAM. | Stays on the host. Back up and secure the volume; prompts still appear in server logs unless redacted. |

## App, monitoring and storage

| Provider | Used for | Env vars | Free-tier limits | Data handling |
| --- | --- | --- | --- | --- |
| Expo / EAS | Development builds, store submission, optional EAS Update | `EXPO_PUBLIC_API_URL`, EAS project ID | Free plan: 15 Android and 15 iOS builds per month, low-priority queue, 60 CI/CD workflow minutes, 1,000 EAS Update MAU. | Build credentials and app binaries are stored by Expo. Do not commit signing keys. Review the Expo privacy policy and data-processing terms. |
| Sentry | Server/mobile crash and error reporting | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`, `EXPO_PUBLIC_SENTRY_DSN` | Developer plan: one user, 5K errors/month, 5 GB logs, 5 GB application metrics, 50 replays and one uptime monitor. | The app disables default PII and the server scrubs auth/cookie headers. Review event payloads before adding user context. |
| Cloudflare R2 | Optional production document storage | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` | 10 GB-month Standard storage, 1M Class A operations, 10M Class B operations and free internet egress per month. | Student documents remain in the bucket until account deletion or cleanup. Use a private bucket, signed URLs and the provider DPA. |
| MinIO (self-hosted) | Local/Compose document storage | `S3_*` | No fee; limited by disk. | Data stays on the host. Back up the volume and restrict network access. |
| Qdrant (self-hosted) | Document chunk vectors | `QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION` | No fee; limited by RAM/disk. | Vectors are derived from private documents. Delete by `userId` on account deletion and rebuild from documents after a loss. |
| PostgreSQL / Redis (self-hosted) | Primary data and rate limits | `DATABASE_URL`, `REDIS_URL` | No fee; limited by the host. | Contains account, chat and consent data. Encrypt backups and apply the documented retention period. |

## Rules before enabling a provider

1. Create the account and key under a project-owned identity, not a personal
   account that can leave with one developer.
2. Put keys in the server environment or a secret manager, never in the mobile
   app, firmware, Git or build args.
3. Record the current console limits and the DPA/privacy terms in the launch
   folder; this table is a starting point, not a contract.
4. Keep Ollama or another local path configured for private documents, and do
   not silently fall through to a cloud provider.
5. Re-check limits before the closed beta and after any pricing change.
