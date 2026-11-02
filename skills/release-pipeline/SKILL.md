---
name: release-pipeline
description: Use when setting up or running CI builds and releases for iOS and Android - Codemagic (or similar) workflows with pinned Flutter/Xcode versions, secret scan step and failure email, version and build numbers, TestFlight internal and external groups (including re-adding testers who were removed), Google Play tracks from internal to closed testing (new personal accounts need 12+ opted-in testers for 14 continuous days) to production, staged rollouts, remote kill switches for risky UI via a public read-only config table, and approval gates so nothing is built or submitted without explicit human approval.
---

# Release pipeline

## Purpose

Reproducible signed builds, a clear path from tester to production on both stores, and the ability to switch off a risky feature without a new release.

## Prerequisites

- `identity-and-signing` done (signing works in CI).
- App Store Connect API key in CI (as a team integration or env variables) and Play service account with release permissions for this app.
- A backend table or static JSON for remote config (any hosting that is publicly readable and cacheable).

## 1. CI workflow

Template: [templates/codemagic.yaml](templates/codemagic.yaml). Principles:

- **Pin toolchains exactly** (`flutter: 3.x.y`, `xcode: 26.x`, `cocoapods: 1.x.y`, `java: 17`). Bump on purpose, after running the full test suite locally on the new version. Keep the last known-good version noted as a fallback.
- **Secret scan first.** The first step of every workflow fails the build if a tracked file looks like it contains a key ([scripts/secret-scan.mjs](scripts/secret-scan.mjs) or gitleaks).
- **Secrets only in CI variable groups**, marked secure, one group per app and platform. Public SDK keys (e.g. RevenueCat `appl_`/`goog_`) are passed with `--dart-define` but never committed.
- **Verify the artefact**: Android — not debug-signed; iOS — print the signed entitlements.
- **Obfuscate and keep symbols** (`--obfuscate --split-debug-info`), upload them as artefacts so crash stacks can be decoded.
- **Failure email** to a monitored address; success emails off.
- **Upload only.** CI uploads to TestFlight / Play internal track; it does not submit for review or promote to production.
- If one CI account hosts several products, reference shared integrations (e.g. the App Store Connect key) by name and never edit them from this app's config.

**APPROVAL: every build that uploads to a store.** Ask per build; state the commit, workflow and what changed.

## 2. Version and build numbers

- `version` (marketing, e.g. `1.4.0`) changes per release; `build number` must increase for every upload on each store.
- Use the CI build counter (`--build-number=$BUILD_NUMBER`) so it is monotonic. Never reuse a number; a failed upload still consumes it on Apple once processed.
- Tag the commit with `v<version>+<build>` after a successful upload.

## 3. TestFlight

| | Internal group | External group |
|---|---|---|
| Who | Members of your App Store Connect team (up to 100) | Anyone by email or public link (up to 10,000) |
| Review | No beta review | First build of a version needs Beta App Review |
| Use | Daily builds, owner testing | Friends, early users |

- Builds expire after 90 days.
- After processing, a build must be **added to each group** (or enable automatic distribution for internal groups).
- Export compliance: with `ITSAppUsesNonExemptEncryption` set in Info.plist, builds do not wait for the compliance question.
- **"Tester removed" / tester sees nothing**: testers can drop out of a group (removed by an account change, an invitation expired, or a group was recreated). Check the group's tester list via API (`GET /v1/betaGroups/{id}/betaTesters`), re-add by email (`POST /v1/betaTesters` with the group relationship) and make sure the latest build is assigned to that group. Ask the tester to accept the new invitation in the TestFlight app.

## 4. Google Play tracks

`internal testing` → `closed testing` → (`open testing`) → `production`.

- **Internal testing**: up to 100 testers, available within minutes, no review delay. Upload every CI build here.
- **Closed testing**: tester lists (email lists or Google Groups), opt-in link. Releases are reviewed.
- **New personal developer accounts** (created after 13 Nov 2023): before applying for production access, run a closed test with **at least 12 testers opted in for at least 14 continuous days**, then answer the production access questionnaire (how you tested, feedback received, changes made). Source: [Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).
  - Start early; the counter runs only while a closed-test release is live and testers stay opted in.
  - Recruit more than 12 (some will not opt in or will leave). Track opt-ins weekly.
  - Collect real feedback (in-app feedback form) and keep a change log; you will cite it in the questionnaire.
- **Production**: first release goes to 100% (staged rollout is only for updates). Use **managed publishing** if you want to control the exact moment changes go live.

## 5. Staged rollout (Play) and phased release (iOS)

- Play updates: start at 5–20%, watch crash rate and ANRs in Android vitals and your own alerts for 24–48 h, then increase. **Halt** stops new users from getting the version; users who have it keep it. Fix forward with a new build. [Docs](https://support.google.com/googleplay/android-developer/answer/6346149).
- iOS: phased release for automatic updates over 7 days; can be paused. Users can always update manually.

## 6. Remote kill switches

For risky UI (a new native component, a redesigned flow, a third-party integration), ship a switch you can flip without a build:

- A **public, read-only** config source: e.g. a table `app_config(platform text primary key, min_version text, flags jsonb)` readable by anonymous clients through row-level security, or a static JSON on a CDN. Template: [templates/app_config.sql](templates/app_config.sql).
- The app reads it at launch (with the forced-update check), **caches the last value on device** so offline launches honour it, and treats missing keys as the default.
- Flags default to the safe behaviour if the read fails only when the new behaviour is the risky one; document the default per flag.
- Never put secrets or per-user data in this table.
- Flip with one SQL statement and record who flipped it and why:

```sql
update public.app_config set flags = flags || '{"new_tab_bar": false}' where platform = 'ios';
```

## Decision points needing human approval

Every store-uploading build, submitting for review, promoting to production, rollout percentage changes, halting a rollout, flipping a kill switch in production, toolchain version bumps.

## Verification

- CI log shows secret scan pass, pinned versions, signature check, upload success.
- TestFlight: build processed, assigned to groups, testers see it. Play: release live on the intended track.
- Kill switch tested on a device: flip off → relaunch → old behaviour; airplane mode → cached value used.

## Common pitfalls

- Unpinned Xcode or Flutter changing a release build silently.
- CI submitting to review automatically.
- Starting the Play closed test after everything else is "done".
- Testers removed from a TestFlight group without noticing; "the app disappeared".
- Kill switch read on every screen instead of once (latency, cost) or not cached (no effect offline).
- Native code that has never been compiled until the release build; build it in CI early.
