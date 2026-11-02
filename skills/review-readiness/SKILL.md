---
name: review-readiness
description: Use before submitting an app version or a first subscription for App Store or Google Play review, or after receiving a rejection. Runs a go/no-go checklist and writes a report - demo account that signs in with a password (no email one-time code), filled with data and premium unlocked; review notes; in-app purchases visible and purchasable (guideline 2.1(b)); iPad compatibility mode for iPhone-only apps; no placeholders or "coming soon"; metadata matching the app; live privacy URLs; crash-free cold start - and gives a playbook for replying in Resolution Center and deciding when to appeal.
---

# Review readiness

## Purpose

Submit once and pass. Most rejections are not about the app's idea; they are a reviewer who could not sign in, could not buy, saw a placeholder, or found a contradiction between metadata and app.

## Prerequisites

- The exact build to submit is on TestFlight / a Play testing track.
- `subscriptions-and-payments` Checkpoint passed (a real purchase unlocked premium on both platforms).
- `privacy-and-declarations` completed; `listing-and-aso` validator clean; screenshots uploaded.

## Think like a zero-knowledge reviewer

The reviewer installs a clean build on a device you did not test (often an iPad, even for an iPhone-only app), with a fresh store account, in a different country, and has minutes, not hours. They read your notes, try the sign-in, look for the purchase, and compare screenshots with the app. Every rejection seen in practice combined two or three small layers: account state + backend behaviour + metadata.

## Procedure

### 1. Demo account

- Credentials go into App Store Connect › App Review Information ("Sign-in required") and Play › App content › App access. Never in the repo.
- **The account signs in with email + password.** If your normal sign-in is an email one-time code or magic link, the reviewer cannot receive it. Add a password path for the review address only (server-side allow-list) or a fixed test code that only works for that address.
- **Filled with data**: profile complete, a few days of history, every main screen populated. An empty account hides features and invites "we could not locate feature X".
- **Premium unlocked** via a server-side manual entitlement (no expiry during review), so reviewers see paid features without buying.
- Separately, make sure a **new** user can reach the paywall and buy with the reviewer's sandbox account (they will test the purchase too).
- Do not change, delete or re-seed this account while a review is open.

### 2. Purchases (2.1(b) and 3.1.x)

- First-version subscriptions are attached to the version in App Store Connect ("In-App Purchases and Subscriptions" section) and have a review screenshot and notes.
- On TestFlight with a **fresh** sandbox Apple Account (not linked to any of your app accounts): products load, purchase works, restore works.
- Paywall error state shows retry, never a disabled "Coming soon".
- If an IAP cannot be reached in the app (e.g. only for a region), explain why in the review notes.
- Restore Purchases, Terms and Privacy links, manage-subscription link present.

### 3. Devices and builds

- Cold start with no network, slow network, and airplane mode toggled: no crash, no infinite spinner.
- **iPad**: even an iPhone-only app runs on iPad in compatibility mode and may be reviewed there. Run the full flow on an iPad simulator: sign-in (including Sign in with Apple), paywall scrolling, purchase sheet, keyboard over forms, permission prompts, rotation. If HealthKit or another API is unavailable there, show a polite message, not a crash.
- Smallest supported phone and largest text size: no clipped buttons on the paywall or consent screens.
- Release build, not debug: no debug banner, no test menus, analytics/crash reporting on in production configuration.

### 4. Content and metadata

- Search the app's strings and listings for: `TODO`, `lorem`, `coming soon`, `beta`, `test`, `[PRICE]`, placeholder images. None may render.
- iOS build and metadata contain no Android / Google Play wording; Play contains no Apple-only wording (2.3.10). Includes in-app strings such as "Cancel in App Store or Google Play" — pick the platform's text at runtime.
- Every screenshot matches the current UI; every number in the description matches the app.
- Privacy policy, terms, support and account-deletion URLs load without login, mention the app, and match the privacy forms.
- Age rating consistent with Terms.

### 5. Backend

- Backend is up and on a plan that will not hit limits during review (free tiers pausing or throttling = rejection).
- No deploys of breaking changes during review. Backward-compatible API for the build in review.
- Alerts are on (`post-launch-ops`) so you notice an outage during review.

### 6. Review notes

Fill in [templates/review-notes.md](templates/review-notes.md). Keep it factual: where features are, how to sign in, how to test the purchase, how AI and health data are handled, where account deletion is.

### 7. Go/no-go report

Fill in [templates/go-no-go-report.md](templates/go-no-go-report.md) with evidence for each line (screenshot, build number, command output). Any **No** on a blocking line means no submission.

### 8. Submit (APPROVAL)

Ask the account holder for explicit approval with the report attached. On iOS choose **manual release** so approval does not publish immediately. On Play, production access (new personal accounts) needs the completed 14-day closed test and the production access application first.

## After a rejection

See [references/rejection-playbook.md](references/rejection-playbook.md): read the exact guideline, reproduce, fix the root cause (often more than one layer), reply in Resolution Center with specifics, resubmit; appeal only when the reviewer misread a fact you can prove.

## Decision points needing human approval

Submitting, choosing release method, replying to a rejection (tone and commitments), filing an appeal, granting premium to the review account.

## Verification

The go/no-go report is complete with evidence, and someone who did not build the feature walked the review notes on a clean device and succeeded.

## Common pitfalls

- Demo account depends on an email code the reviewer cannot read.
- Demo account empty, frozen, or deleted by a cleanup job.
- Products in "Missing Metadata" (no review screenshot), so they never load in review.
- A reviewer's fresh Apple Account collides with your restore/transfer rules and the purchase "fails".
- Backend on a free tier that pauses after inactivity or rate-limits the reviewer.
- "Coming soon" anywhere in the build.
- In-app text mentioning the other store.
