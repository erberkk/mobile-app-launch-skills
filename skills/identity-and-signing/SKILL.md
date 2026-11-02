---
name: identity-and-signing
description: Use when registering an app's bundle ID / Android application ID, enabling iOS capabilities (Associated Domains, HealthKit, push, App Groups, Sign in with Apple), creating or refreshing certificates and provisioning profiles (including after enabling a capability, via codemagic-cli-tools app-store-connect commands), setting up Play App Signing and the upload key, or publishing and verifying apple-app-site-association and assetlinks.json for universal links / App Links.
---

# Identity and signing

## Purpose

Give the app one stable identity on both platforms, sign it reproducibly in CI, and make deep links verify on the first try.

## Prerequisites

- App Store Connect API key (see `accounts-and-tax`) and `codemagic-cli-tools` (`pip install codemagic-cli-tools`) or an equivalent.
- Java `keytool` for Android keys.
- HTTPS hosting for `/.well-known/` files if you use universal links / App Links.

## 1. Choose identifiers (APPROVAL — cannot be changed after release)

- iOS bundle ID and Android `applicationId`: use the same reverse-DNS string on both, for example `com.example.app`. Extensions get suffixes: `com.example.app.widget`, `com.example.app.LiveActivity`.
- Shared containers: App Group `group.com.example.app` (iOS), declared on every target that shares data.
- Once an app is published, the identifier is permanent on both stores.

## 2. iOS: App IDs and capabilities

1. Register the App ID for the app and each extension (Developer portal or API: `app-store-connect bundle-ids create`).
2. Enable only the capabilities the app uses. Each one must also be in the target's `.entitlements` file:

| Capability | Entitlement key | Notes |
|---|---|---|
| Associated Domains | `com.apple.developer.associated-domains` (`applinks:example.com`) | Needed for universal links and password autofill |
| HealthKit | `com.apple.developer.healthkit` | Also Info.plist usage strings; strict data rules (see `privacy-and-declarations`) |
| Push Notifications | `aps-environment` | APNs key in the developer portal |
| App Groups | `com.apple.security.application-groups` | Same group on app and extensions |
| Sign in with Apple | `com.apple.developer.applesignin` | Required alongside some third-party logins (guideline 4.8) |

3. **After enabling a capability, existing provisioning profiles do not contain it.** Delete and regenerate them, or the build fails or ships without the entitlement.

### Refreshing profiles from CI (codemagic-cli-tools)

```bash
set -e
BUNDLE_ID=com.example.app
keychain initialize

# Resource id of the bundle ID
BID=$(app-store-connect bundle-ids list --bundle-id-identifier "$BUNDLE_ID" \
      --strict-match-identifier --json | python3 -c 'import json,sys;print(json.load(sys.stdin)[0]["id"])')

# Enable a capability once, then drop stale App Store profiles
if ! app-store-connect bundle-ids capabilities "$BID" --json | grep -q ASSOCIATED_DOMAINS; then
  app-store-connect bundle-ids enable-capabilities "$BID" --capability "Associated Domains"
  for P in $(app-store-connect bundle-ids profiles --bundle-ids "$BID" --type IOS_APP_STORE --json \
             | python3 -c 'import json,sys;print(" ".join(p["id"] for p in json.load(sys.stdin)))'); do
    app-store-connect profiles delete "$P"
  done
fi

# Fetch or create certificate + profile for the app and each extension
for ID in "$BUNDLE_ID" "$BUNDLE_ID.widget"; do
  app-store-connect fetch-signing-files "$ID" --type IOS_APP_STORE \
    --certificate-key=@env:CERTIFICATE_PRIVATE_KEY --strict-match-identifier --create
done
keychain add-certificates
xcode-project use-profiles
```

`CERTIFICATE_PRIVATE_KEY` is the RSA private key of your distribution certificate, stored as a secure CI variable. Keeping it lets CI reuse one certificate instead of creating a new one each run (Apple limits the number of distribution certificates).

**APPROVAL** before deleting profiles or certificates in a shared team account; other apps may depend on them.

4. After the build, print the entitlements actually signed into the app and check them:

```bash
codesign -d --entitlements - "path/to/Runner.app" | grep -E "associated-domains|healthkit|application-groups|team-identifier" -A2
```

## 3. Android: Play App Signing and the upload key

- **App signing key**: held by Google; signs what users install. Let Google generate it for new apps.
- **Upload key**: yours; signs the AAB you upload. If lost, request an upload key reset in Play Console (possible because Google holds the app signing key).

Create the upload key once:

```bash
keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
```

- Store `upload.jks` and its passwords outside the repo, with a second backup. In CI, keep it as a base64 secret and write `key.properties` at build time.
- After building, fail the job if the bundle is debug-signed:

```bash
keytool -printcert -jarfile app-release.aab | grep -q "CN=Android Debug" && { echo "debug-signed"; exit 1; } || true
```

- Fingerprints for APIs and App Links: use the **app signing key** SHA-256 from Play Console (Protected with Play › Play app signing). Your local upload-key fingerprint is different. Include the upload-key fingerprint too if you install upload-signed builds outside Play for testing.

Docs: [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756).

## 4. Universal links (iOS) and App Links (Android)

Templates: [templates/apple-app-site-association](templates/apple-app-site-association), [templates/assetlinks.json](templates/assetlinks.json). Checker: [scripts/verify-links.sh](scripts/verify-links.sh).

### apple-app-site-association (AASA)

- URL: `https://example.com/.well-known/apple-app-site-association` — no extension, served as `application/json`, HTTP 200, **no redirects**.
- `appIDs` entries are `<TEAM_ID>.<bundle id>`. Take the Team ID from the developer account (Membership details) — never guess it; a wrong Team ID fails silently.
- Apple fetches the file through its CDN; changes take time. For development, `applinks:example.com?mode=developer` bypasses the CDN on devices in developer mode.
- Docs: [Supporting associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains).

### assetlinks.json

- URL: `https://example.com/.well-known/assetlinks.json`, `application/json`, HTTP 200.
- `sha256_cert_fingerprints`: the Play **app signing** certificate SHA-256 (uppercase hex with colons).
- The intent filter needs `android:autoVerify="true"`, `VIEW`, `BROWSABLE`, `DEFAULT`, scheme `https`.
- On a device (Android 12+): `adb shell pm verify-app-links --re-verify com.example.app`, then `adb shell pm get-app-links com.example.app` → `verified`.
- Docs: [Verify Android App Links](https://developer.android.com/training/app-links/verify-android-applinks).

## Decision points needing human approval

- Final identifiers (permanent).
- Enabling capabilities that change review scope (HealthKit, push).
- Deleting or revoking certificates/profiles; upload key reset requests.

## Verification

- `scripts/verify-links.sh example.com <TEAM_ID>.com.example.app <SHA256>` passes (status 200, JSON content type, no redirect, IDs and fingerprint present).
- Signed IPA entitlements include every enabled capability; AAB is not debug-signed.
- On devices: tapping an `https://example.com/...` link opens the app on both platforms.

## Common pitfalls

- Enabling a capability but reusing old profiles: the entitlement is missing in the signed app.
- Capability enabled on the app but not on the extension that needs it (App Groups, HealthKit).
- Using the upload-key fingerprint in `assetlinks.json` instead of the app signing key.
- AASA served via redirect (http→https, apex→www) or as `text/html` by a static host.
- Website and app deployed at different times: deploy the `.well-known` files first.
- Wrong Team ID copied from another account in a shared environment.
