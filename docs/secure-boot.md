# ESP32-S3 Secure Boot and OTA Plan

## Goals

- Only signed Robo firmware executes.
- Flash contents are encrypted at rest.
- OTA updates are signed, versioned and rollback-protected.
- A failed update returns to the last known-good image.
- Per-device identity keys are generated on-device and never leave it.

## Boot chain

1. ROM verifies the first-stage bootloader with a secure-boot key digest.
2. First-stage bootloader verifies the second-stage bootloader.
3. Second-stage bootloader verifies the application image.
4. Application verifies OTA metadata before marking an image valid.

Use ESP-IDF Secure Boot v2 (RSA-3072 or ECDSA) and enable flash encryption in
release mode. Keep the signing key offline in an HSM or encrypted hardware token;
never commit it or place it in CI variables that are available to pull requests.

## Partition layout

- `factory` or recovery app.
- Two OTA slots (`ota_0`, `ota_1`).
- `otadata` with active/valid flags.
- NVS with device identity and pairing state.
- Encrypted NVS for Wi-Fi credentials and device token.

## Signing and release

1. Build reproducibly from a tagged commit.
2. Generate a manifest with version, model, minimum version, SHA-256 and signature.
3. Sign the image digest with the offline release key.
4. Upload the image and manifest to a private bucket.
5. Publish only after staged rollout approval.

CI may run unsigned builds and tests. A separate protected release environment
holds the signing credential and requires human approval.

## Rollback protection

- Store a monotonic security version in eFuse.
- Reject manifests below the installed security version.
- Mark a new image valid only after boot, network connection and a self-test.
- If the self-test fails, boot the previous slot and report the failure.

## Provisioning

- Generate the device key pair in the ESP32-S3 hardware crypto peripheral.
- Print only a public device identifier in the QR code.
- Pair with a short-lived, one-time code stored hashed on the server.
- Never expose the device token in logs, QR codes or the app UI.

## Production steps (not yet executed)

- [ ] Buy and inventory target ESP32-S3 modules.
- [ ] Create offline signing keys and document custodians.
- [ ] Build and flash a secure-boot development unit.
- [ ] Verify unsigned images are rejected.
- [ ] Verify encrypted flash cannot be read on a second board.
- [ ] Rehearse a failed OTA and rollback.
- [ ] Complete a hardware security review.
