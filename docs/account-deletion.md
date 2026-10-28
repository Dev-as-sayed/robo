# Account deletion

Robo supports two account-deletion paths:

1. **In the app:** Settings → Danger Zone → Delete my account. This is immediate
   and signs the user out after deletion.
2. **On the web:** `https://<API_DOMAIN>/account/delete`. Use this when the user
   no longer has the app or cannot sign in. The request is verified before the
   account is deleted.

The web page is required by Google Play's account-deletion policy. It must be
reachable without installing the app and must be linked from the Play Console
account-deletion field and the privacy policy.

## Public request flow

- The page is served by the API at `GET /account/delete`; its script is
  `GET /account/delete.js`. Both are outside `/api/v1`.
- The form collects the account email, an optional reason, and an explicit
  confirmation checkbox. It never asks for a password.
- `POST /api/v1/account/deletion-request` validates the email, checks for a
  matching account, and upserts one pending request per email.
- The endpoint always returns `202` with the same message so callers cannot use
  it to enumerate accounts. Requests for emails with no account are not stored.
- The endpoint shares the auth rate limiter to limit abuse.

The browser page uses the same origin as the API, so no CORS or API-base setting
is needed. TLS is terminated by Caddy in production.

## Ownership verification

A request is **not** proof of ownership. Before deleting:

1. Open the pending request with the moderator API.
2. Email the address on the account from the monitored support mailbox. Ask the
   user to reply from that address and confirm the account email and the request.
3. Check that the reply comes from the same address and that the account details
   match. Do not accept a forwarded message or a different address.
4. Process the request only after verification. If there is no reply after seven
   days, dismiss it and record why in `note`.

If the account no longer exists, complete the request with the note
`No matching account`.

## Moderator API

Requires a moderator or higher role:

```bash
# List pending requests
curl -s "$API_URL/api/v1/admin/deletion-requests?status=PENDING" \
  -H "Authorization: Bearer $MODERATOR_TOKEN"

# Mark a verified request complete (deletes the account and cascades its data)
curl -s -X PATCH "$API_URL/api/v1/admin/deletion-requests/<id>" \
  -H "Authorization: Bearer $MODERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"COMPLETED"}'

# Dismiss a request without deleting anything
curl -s -X PATCH "$API_URL/api/v1/admin/deletion-requests/<id>" \
  -H "Authorization: Bearer $MODERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"DISMISSED","note":"Ownership not verified"}'
```

Completing a verified request calls the same `deleteAccountData` path as the
in-app flow: it removes Qdrant vectors, uploaded files/object-storage objects and
the PostgreSQL user row. Foreign keys cascade to conversations, messages, tasks,
reminders, documents, contacts, consents, AI feedback and the deletion request
itself.

## Data and retention

- Only requests for existing accounts are stored. The row contains the account
  email, optional reason, status, notes and timestamps.
- Request rows are included in the user's data export.
- Deleting the account cascades the request row, so no deletion-request email is
  retained after a completed deletion.
- The daily cleanup job removes dismissed/completed request rows and stale
  pending rows after the configured retention window (90 days by default).
- Do not copy request emails into public issue trackers, chat or logs.

## Verification checklist

- [ ] Open `/account/delete` from a logged-out browser on a phone.
- [ ] Submit a request for a real test account; confirm `202` and one pending row.
- [ ] Submit the same email again; confirm there is still one row.
- [ ] Submit an unknown email; confirm `202` and no new row.
- [ ] Check the browser console and network panel for CSP or CORS errors.
- [ ] Verify an email, complete the request, and confirm the account, files and
      vectors are gone.
- [ ] Dismiss another request and confirm the account still exists.
- [ ] Publish the URL in the Play Console and the privacy policy.

## Tests

`apps/server/tests/deletion-requests.test.ts` covers request creation,
deduplication, listing, dismissal, verified deletion and the no-account case.
`apps/server/tests/account-deletion.test.ts` covers vector/file/database cleanup.
