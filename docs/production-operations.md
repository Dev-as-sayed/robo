# Production Operations

## Topology

`docker-compose.production.yml` runs Caddy, the API, PostgreSQL, Redis, Qdrant,
MinIO, Ollama, STT and TTS. Only Caddy publishes ports; databases and model
services stay on the private Docker network.

## First deploy

1. Provision a Linux VPS with at least 8 GB RAM and 40 GB disk (more for local
   models).
2. Point `API_DOMAIN` and `MINIO_DOMAIN` DNS records at the host.
3. Copy `.env.production.example` to `.env.production`, fill every secret with
   random values and set the real domains.
4. Run `docker compose -f docker-compose.production.yml up -d --build`.
5. Run `docker compose -f docker-compose.production.yml ps` and confirm every
   service is healthy.
6. Verify `https://$API_DOMAIN/health` returns `200` with a valid certificate.
7. Verify MinIO is not anonymously listable and only Caddy exposes 80/443.
8. Run the smoke checks: register, sign in, upload a document, wait for
   `indexed`, ask a document question, pair a test device.

## Secrets

- Generate passwords with `openssl rand -base64 48`.
- Keep `.env.production` mode `0600`, owned by the deploy user.
- Never build images with secrets. Build-time args are not secret storage.
- Rotate JWT, S3, provider and database credentials on a documented schedule.
- Use GitHub encrypted secrets for CI, never repository variables for keys.

## TLS

Caddy obtains and renews certificates automatically. HSTS, MIME sniffing
protection, frame denial and a permissions policy are set in `deploy/Caddyfile`.
Do not expose the API over plain HTTP; redirect is handled by Caddy.

## Backups

- Install `scripts/backup-db.sh` in cron, for example daily at 02:15.
- Copy backups to encrypted off-host storage with object lock where available.
- Back up MinIO document bytes separately.
- Test a restore monthly into a disposable database:
  `gunzip -c backup.sql.gz | docker compose ... exec -T db psql -U robo robo`.
- Qdrant vectors can be rebuilt from documents; do not treat them as the source
  of truth.

## Data export and deletion

- Exercise export and deletion against a disposable account before launch and
  after changing storage, vector or consent code.
- Create the account, upload one document, wait for `indexed`, then run:
  `VERIFY_USER_ID=<id> pnpm --dir apps/server verify:data-lifecycle --execute`.
- The check exports user data (including consent records), deletes the account,
  and then asserts that PostgreSQL rows, Qdrant points and S3 objects are gone.
- This is destructive. Never point it at a real user. Keep a database backup
  until the check passes.

## Monitoring and alerts

- Sentry: set `SENTRY_DSN`; alerts on new error groups and error-rate spikes.
- Uptime: probe `/health` every minute from outside the host.
- Logs: ship stdout JSON logs to a retained log service.
- Metrics: chat and voice turns already record latency and token usage in the
  database and logs. Alert on p95 chat latency above 5 s, voice turn p95 above
  3 s, document ingestion failures, queue depth growth and 5xx rate above 1%.
- Disk: alert at 70% and 85%; images and model volumes grow.
- Certificate expiry and backup age are also alertable.

## Load test

`tests/load/device-sessions.js` is a k6 scenario for the 500-session target.
Provide a dedicated load-test device token and run against staging:

```bash
k6 run tests/load/device-sessions.js \
  -e GATEWAY_URL=wss://staging.example.com/ws/device \
  -e DEVICE_TOKEN=... -e SESSIONS=500 -e DURATION=10m
```

Record p95 turn latency, error rate, CPU, memory and database connection usage.
Do not run this against production without a maintenance window.

## Incident response

1. Contain: revoke tokens/keys, scale down or block the affected route.
2. Preserve logs and request IDs.
3. Notify the security lead and, where required, affected users/regulator.
4. Fix, add a regression test, and rotate any exposed credential.
5. Write a blameless post-incident review with follow-up owners.

## Launch checklist (blocked on external accounts)

- [ ] Real domain, DNS and TLS certificate.
- [ ] Password manager and secret rotation record.
- [ ] Sentry project and alert routing.
- [ ] Off-host encrypted backup bucket.
- [ ] Uptime monitor and on-call rotation.
- [ ] Load test against staging with 500 sessions.
- [ ] Restore drill completed.
- [ ] Penetration test completed.
- [ ] Privacy notice and terms reviewed by counsel.
