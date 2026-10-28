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

## Release checklist

- [ ] Expo project ID and EAS credentials configured.
- [ ] Sentry DSN and source-map upload configured.
- [ ] Screenshots, descriptions, privacy labels and content ratings prepared.
- [ ] Physical Android and iOS smoke tests pass.
- [ ] Push notifications verified on both platforms.
- [ ] Store review and legal approval complete.
