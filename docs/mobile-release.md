# Mobile Release

## EAS

`apps/mobile/eas.json` defines development, preview and production profiles.
The Expo project is linked as `@amsayed231/robo`, and `app.json` contains its
project ID. Then:

```bash
cd apps/mobile
eas build --profile development --platform android
eas build --profile production --platform all
eas submit --profile production --platform all
```

Store the Expo token in GitHub Actions only when automated builds are enabled.
Signing keys and store listings are external-account items and are intentionally
not committed.

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

The mobile app runs on Expo SDK 54 / React Native 0.81, whose Android defaults
compile and target Android 16 (API 36). Rebuild and re-test permissions,
notifications, edge-to-edge layout, photo picking, contacts and WebSocket
reconnect behavior before every store submission.

## Release checklist

- [x] Expo project ID linked (`@amsayed231/robo`).
- [ ] EAS signing credentials configured.
- [ ] Sentry DSN and source-map upload configured.
- [x] Upgrade to Expo SDK 54 with compile/target SDK 36.
- [ ] Rebuild and re-test permissions, notifications, edge-to-edge layout and links on Android 16.
- [ ] In-app AI answer reporting is available.
- [ ] Deploy the public account-deletion page and privacy-policy URL, then enter both in Play Console.
- [ ] Data safety, content rating and adult audience answers completed.
- [x] Contacts policy decision recorded: the app uses the native single-contact picker instead of a broad import.
- [ ] Screenshots, descriptions, privacy labels and content ratings prepared.
- [ ] Physical Android and iOS smoke tests pass.
- [ ] Push notifications verified on both platforms.
- [ ] Store review and legal approval complete.
