# Support and FAQ

Robo gives students an in-app **Help & FAQ** screen and a configurable support
channel. The screen lives at `apps/mobile/app/(app)/help.tsx` and is linked from
Settings → Account.

## Support channel

Configure the release channel before submitting to a store:

```bash
# apps/mobile/.env
EXPO_PUBLIC_SUPPORT_EMAIL=support@your-domain.example
EXPO_PUBLIC_SUPPORT_URL=https://your-domain.example/support
```

- `EXPO_PUBLIC_SUPPORT_EMAIL` takes priority and opens the phone's mail app.
- `EXPO_PUBLIC_SUPPORT_URL` is the fallback when no email is set. The checked-in
  default points to the public GitHub issue tracker so development builds always
  have a working channel.
- Set a monitored mailbox or support page before release. Do not ship a personal
  or unmonitored address.
- The same contact must be entered in the Play Console support fields and the
  store listing.

## What the in-app FAQ covers

- Creating tasks and reminders, including by chat.
- Microphone and contacts consent.
- Reporting an incorrect, unsafe or offensive AI answer.
- Exporting and deleting account data.
- Cloud AI for documents.
- Reconnecting a Robo device.
- What still works without a connection.

The copy is intentionally short and action-oriented. Update
`apps/mobile/app/(app)/help.tsx` and this document together when behavior
changes.

## Support workflow

1. Triage new messages daily during beta. Aim to acknowledge within one business
   day and close account-access or data-deletion issues within seven days.
2. Ask for the account email, phone model, app version and steps to reproduce.
   Never ask for a password, API key or full document contents.
3. For AI-quality reports, use the in-app Report action so the response and
   message ID are recorded. Moderators can list open reports with
   `GET /api/v1/admin/ai-feedback?status=OPEN` and close them with
   `PATCH /api/v1/admin/ai-feedback/:id`.
4. For account deletion, point users to Settings → Danger Zone while signed in.
   The public web deletion resource is still a release blocker; see
   [the Play policy review](play-policy-review.md).
5. For privacy or security incidents, follow
   [the production runbook](production-operations.md) and do not discuss raw
   user data in public issue threads.

## Common replies

**A reminder did not ring.** Check the reminder time zone in Settings, then open
Reminders and confirm the reminder is still active. On Android, allow
notifications and disable battery optimization for Robo.

**The device is offline.** Confirm the device and phone are on the same Wi-Fi
network, power-cycle the device, and check Devices for the last-seen time. If the
device was removed, pair it again.

**Robo gave a wrong answer.** Ask a narrower question or upload the source
material, then tap Report and choose "Incorrect or unhelpful". Reporting does not
delete the conversation.

**I want my data removed.** Signed-in users can export or delete from Settings.
If the app is already uninstalled, contact support from the configured support
channel while the public deletion page is pending.

## Release checklist

- [ ] Set `EXPO_PUBLIC_SUPPORT_EMAIL` or `EXPO_PUBLIC_SUPPORT_URL` in the EAS
      production environment.
- [ ] Confirm the mailbox or support page is monitored.
- [ ] Add the same contact to the Play Console listing.
- [ ] Verify the Help & FAQ link on a signed-in production build.
- [ ] Re-read the FAQ after any permission, deletion or AI-reporting change.
