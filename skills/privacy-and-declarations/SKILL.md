---
name: privacy-and-declarations
description: Use when filling in or auditing App Store privacy and compliance answers and Google Play App content declarations - Apple App Privacy labels, Play Data safety (CSV import), Health apps declaration and Health Connect permissions, advertising ID, PrivacyInfo.xcprivacy and required-reason APIs, export compliance (ITSAppUsesNonExemptEncryption), age rating, account deletion (in-app, web URL, re-authentication), consent and disclosure for AI features, and rules for health data. Derives every answer from a code and SDK scan so the forms, the privacy policy and the in-app text say the same thing.
---

# Privacy and declarations

## Purpose

Truthful, consistent privacy answers in both stores, backed by evidence from the code. Most privacy rejections are inconsistencies: the policy says one thing, the app does another, the form says a third.

## Prerequisites

- Source code access (app and backend) and the lock files (`pubspec.lock`, `Podfile.lock`, Gradle dependencies, `package.json`).
- The current privacy policy and terms.
- Knowledge of every backend endpoint and third-party service that receives user data.

## 1. Build the data inventory (from code, not memory)

Run [scripts/scan-sdks.mjs](scripts/scan-sdks.mjs) at the repo root. It lists known SDKs from lock files with the data categories they typically touch, and greps for required-reason API usage, permission strings, ad ID and tracking APIs. Then complete the inventory by reading the network layer and backend:

| Data | Source (screen / SDK) | Sent off device? To whom | Linked to user? | Purpose | Retention | Optional? |
|---|---|---|---|---|---|---|

Rules:

- "Processed only on the device" means never sent, including to your own server. If it is synced to your backend, it is collected.
- Your processors (hosting, AI provider acting on your instructions, payment SDK) are still "collected"; whether they count as "shared" differs by store (below).
- Anonymous crash reports and usage counts are still collected (Diagnostics / Usage Data), usually "not linked".

Save the inventory as `docs/privacy-inventory.md`. Every answer below cites a row.

## 2. Apple App Privacy (App Store Connect › App Privacy)

- Map each inventory row to Apple's categories (Contact Info, Health & Fitness, User Content, Identifiers, Purchases, Usage Data, Diagnostics…), purposes, **linked** vs **not linked**, and **tracking**.
- Tracking = linking your data with third-party data for targeted ads or ad measurement, or sharing with data brokers. No ads SDK and no data broker usually means "No tracking" and no ATT prompt.
- Optional disclosure applies only when **all** of Apple's conditions are met (infrequent, optional, user-initiated each time, not tracking/ads). Rarely applies to app features.
- Docs: [App privacy details](https://developer.apple.com/app-store/app-privacy-details/).

## 3. Google Play Data safety (Policy › App content › Data safety)

- Same inventory, Play's taxonomy (Personal info, Health and fitness, Photos and videos, Messages, App activity, App info and performance, Device or other IDs, Financial info…).
- **Sharing** excludes transfers to service providers processing on your behalf; an SDK that builds cross-customer ad profiles is sharing.
- **Ephemeral**: processed only in memory, not stored, only for the real-time request (e.g. a photo analysed and discarded).
- Use **Export to CSV / Import from CSV**: keep the CSV in the repo (`store/data-safety.csv`) so changes are reviewed like code. Importing overwrites all answers.
- Docs: [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469).

## 4. Other Play declarations

- **Health apps declaration**: every app must complete it, even with no health features. [Docs](https://support.google.com/googleplay/android-developer/answer/14738291).
- **Health Connect**: one justification per permission; request only permissions a visible feature uses; a rationale activity (`ACTION_SHOW_PERMISSIONS_RATIONALE`) linking to the policy. Play may ask for a screen recording of the flow.
- **Advertising ID**: declare whether you use it. If no ads/attribution SDK, declare "No" and make sure no dependency adds `com.google.android.gms.permission.AD_ID` (check the merged manifest; remove with `tools:node="remove"` if added).
- **Target audience, content rating (IARC), ads, app access, news, financial features, government**: answer from the inventory. If any part is behind login, give reviewer credentials in App access.
- **Account deletion**: see section 8.

## 5. Privacy manifest (iOS)

- Add `PrivacyInfo.xcprivacy` to the app target (template: [templates/PrivacyInfo.xcprivacy](templates/PrivacyInfo.xcprivacy)).
- Declare `NSPrivacyTracking`, `NSPrivacyTrackingDomains`, `NSPrivacyCollectedDataTypes` (consistent with App Privacy) and `NSPrivacyAccessedAPITypes` for each **required-reason API** category the app's own code uses: file timestamp, system boot time, disk space, active keyboards, UserDefaults. Choose the approved reason codes from Apple's list. Flutter apps use UserDefaults via plugins such as `shared_preferences` — check each plugin ships its own manifest; add what your code and plugins without manifests use.
- After building, inspect the App Store Connect email / build warnings for missing manifest reasons.
- Docs: [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), [Required reason API](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api).

## 6. Export compliance (iOS)

- `ITSAppUsesNonExemptEncryption` in Info.plist: `false` is appropriate when the app uses no encryption or only exempt encryption (for example HTTPS through the OS, standard algorithms used only to protect the user's own data in an app whose main function is not security). Setting it skips the per-build questions.
- If you implement or bundle proprietary cryptography, or encryption is a primary feature, answer the questions instead and check whether documentation or an annual self-classification report applies.
- This is a legal classification; when unsure, ask a trade-compliance adviser. Docs: [Complying with encryption export regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations).

## 7. Age rating

- Answer the current Apple questionnaire and Play IARC questionnaire truthfully, including questions on health/wellness topics, AI chat or generated content, user-generated content and unrestricted web access.
- Keep the rating consistent with your Terms' minimum age and any in-app age gate. If the questionnaire result is lower than your Terms' minimum, use the store's option to set a higher rating rather than leaving a mismatch.

## 8. Account deletion

- **In-app**: if users can create an account, they can start deletion inside the app (account settings). Deactivation alone is not enough. Guest/auto-created accounts too. Re-authentication or confirmation is allowed but must not be unnecessarily hard. Apple: [Offering account deletion](https://developer.apple.com/support/offering-account-deletion-in-your-app/).
- **Web URL (Play)**: a page, reachable without the app or login, naming the app as on the listing, explaining how to request deletion, what is deleted and what is retained (and why), and any prior steps (cancel the subscription). Docs: [Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111).
- **Subscriptions**: deleting the account does not cancel a store subscription. Warn in the deletion sheet and link to the store's subscription management.
- **Sign in with Apple**: revoke the user's tokens via the Sign in with Apple REST API on deletion.
- **Third parties**: delete the user at processors too (e.g. the RevenueCat customer, analytics/crash identifiers, email lists).
- **Re-auth rollout**: if you add a re-authentication requirement to the delete endpoint, ship the app that handles the new response **at the same time** as the backend change, or keep the old behaviour for old app versions.
- Use one wording for the path everywhere (app, policy, store forms, web page), e.g. "Profile › Delete account".

## 9. AI features

- Apple 5.1.2(i): disclose where personal data is shared with third parties, **including third-party AI**, and get explicit permission first.
- Before first use of an AI feature: a short consent sheet naming the provider and role ("processed by <AI provider> to generate the answer"), what is sent, that it is **not used to train models** (only if the provider's terms say so for your plan), and retention (provider's and yours). A switch in settings to withdraw.
- Policy wording: the AI provider acts as a **processor/service provider** on your instructions; list it with location and retention.
- Store forms: AI inputs (messages, photos, text) are collected data (User Content); usually not "shared" on Play when the provider is a processor.
- Content safety: AI answers for health/finance topics carry a "not professional advice" line; crisis topics get a safe response.

## 10. Health data

- **Never send HealthKit / Health Connect data to AI providers or other third parties.** Apple (5.1.3) restricts health data use and disclosure; Health Connect's policy restricts transfers too. The simplest compliant design: data read from Apple Health / Health Connect stays on the device (or in the user's own account storage only, disclosed), and features that call an AI use only data the user typed into your app.
- Do not use health data for advertising or marketing; do not store it in iCloud.
- Info.plist usage strings (`NSHealthShareUsageDescription`, `NSHealthUpdateUsageDescription`) must state the real use. If the string says "never shared with third parties", the code must guarantee it.
- Enforce it in code: the request builder for AI calls takes an explicit allow-list of fields; add a test that fails if a health-sourced field appears in an AI payload.

## Decision points needing human approval

Final answers on every form (the account holder is legally responsible), the export compliance classification, the age rating, the AI provider and its data terms, any change to what health data leaves the device.

## Verification

- Every form answer cites an inventory row; inventory cites code.
- Diff check: privacy policy ↔ App Privacy ↔ Data safety CSV ↔ in-app consent text ↔ Info.plist strings. No contradictions.
- Test: delete a test account; confirm backend rows, processor records and auth user are gone; web deletion page reachable logged out.
- Build shows no privacy-manifest warnings.

## Common pitfalls

- "Data never leaves the device" in the policy while a sync or AI feature sends it.
- Forgetting your own anonymous crash/usage reporting in the forms.
- A dependency silently adding the AD_ID permission.
- Health data flowing into an AI prompt through a "context" builder that includes "everything we know".
- Deletion path named differently in app, policy and store forms.
- Age rating 4+ while Terms say 16+.
