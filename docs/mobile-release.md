# Mobile Release

## EAS

`apps/mobile/eas.json` defines development, preview and production profiles.
Run `eas init` once to attach the Expo project ID; EAS writes it to `app.json`.
Then:

```bash
cd apps/mobile
eas build --profile development --platform android
eas build --profile production --platform all
eas submit --profile production --platform all
```

Store the Expo token in GitHub Actions only when automated builds are enabled.
The EAS project ID, signing keys and store listings are external-account items
and are intentionally not committed.

## Sentry

Set `EXPO_PUBLIC_SENTRY_DSN` in the EAS environment. The app initialises Sentry in
`app/_layout.tsx` with `sendDefaultPii: false`. Configure source-map upload in the
EAS build profile once the Sentry organisation/project exists.

## Support contact

Set `EXPO_PUBLIC_SUPPORT_EMAIL` (preferred) or `EXPO_PUBLIC_SUPPORT_URL` in the
EAS production environment. The in-app Help & FAQ action uses the email when
present and falls back to the public issue tracker otherwise. Use the same
monitored contact in the Play Console and store listing; see
[`support-faq.md`](support-faq.md).

## Maestro

Flows live in `.maestro/`. Smoke test:

```bash
maestro test .maestro/smoke.yaml
```

Authenticated flow (requires a test account):

```bash
ROBOTEST_EMAIL=... ROBOTEST_PASSWORD=... maestro test .maestro/sign-in.yaml
```

Maestro needs a running emulator/simulator and a development or preview build.
Add `expo-dev-client` before producing development builds.

## Play policy

`docs/play-policy-review.md` records the current permission inventory, Data
safety mapping and launch blockers. Re-run the manifest check before every store
submission:

```bash
cd apps/mobile
pnpm exec expo config --type introspect
```

The production build must target Android 16 (API 36) or higher. The current
Expo 51 build targets API 34, so the SDK upgrade is a release blocker.

## Release checklist

- [ ] Expo project ID and EAS credentials configured.
- [ ] Sentry DSN and source-map upload configured.
- [ ] Target Android 16 (API 36) and re-test permissions, notifications and links.
- [ ] In-app AI answer reporting is available.
- [ ] Public account-deletion page and privacy-policy URL are live.
- [ ] Data safety, content rating and adult audience answers completed.
- [ ] Contacts policy decision recorded (Contact Picker or Play declaration).
- [ ] Screenshots, descriptions, privacy labels and content ratings prepared.
- [ ] Physical Android and iOS smoke tests pass.
- [ ] Push notifications verified on both platforms.
- [ ] Store review and legal approval complete.
