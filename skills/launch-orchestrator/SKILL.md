---
name: launch-orchestrator
description: Use when planning or running the end-to-end launch of a mobile app on the Apple App Store and Google Play, or when unsure which launch step comes next. Sequences the other launch skills (accounts, signing, subscriptions, listing, screenshots, privacy, review readiness, release pipeline, console automation, post-launch ops) into phases with checkpoints and human approval gates, and keeps a launch status file up to date.
---

# Launch orchestrator

## Purpose

Shipping to both stores is a few dozen tasks with long waits in between (D-U-N-S numbers, agreement processing, a 14-day closed test, review queues). Doing them in the wrong order costs weeks. This skill gives the order, the checkpoints, and the places where a human must decide.

## Prerequisites

- A working app build on both platforms (it does not need to be final).
- The person who owns the developer accounts is reachable for approvals.
- A place for the status file: `docs/launch-status.md` in the app repo (create it from the template below).

## Phases

Start long waits first. The critical paths are usually **account verification** (days to weeks), **Google Play closed testing for new personal accounts** (12+ testers opted in for 14 continuous days) and **subscription products approval**, which happens together with the first app version.

### Phase 0 — Accounts and keys (week 0)

Skill: `accounts-and-tax`.

1. Enroll in the Apple Developer Program and create a Google Play Console developer account (choose individual vs organization deliberately).
2. Accept the paid apps agreements; submit bank and tax forms. **APPROVAL** (banking/tax data is entered by the account owner).
3. Create the App Store Connect API key and the Google Play service account. Store them outside the repo.
4. Apply for the reduced-fee programs (App Store Small Business Program; Google Play's 15% tier where applicable).

**Checkpoint 0:** both accounts verified, agreements "Active", API key and service account tested with one read-only call each.

### Phase 1 — Identity, signing, CI (week 0–1)

Skills: `identity-and-signing`, `release-pipeline`.

1. Register the bundle ID / application ID, enable only the capabilities the app uses.
2. Set up signing in CI (App Store profiles via the API; Play App Signing with a separate upload key).
3. Pin toolchain versions in CI; add the secret scan; first internal builds to TestFlight and Play internal testing. **APPROVAL** for every CI build that uploads to a store.
4. Publish `apple-app-site-association` and `assetlinks.json` if you use universal links / App Links; verify fingerprints.

**Checkpoint 1:** a signed build installs from TestFlight and from Play internal testing on real devices.

### Phase 2 — Start the clock on Google Play closed testing (as early as possible)

Skill: `release-pipeline`.

If the Play account is a personal account created after 13 Nov 2023, production access requires a closed test with at least 12 opted-in testers for 14 continuous days. Start this as soon as you have a stable build; it does not need final screenshots or prices.

**Checkpoint 2:** closed-test release approved, ≥12 testers opted in, day counter running. Record the start date in the status file.

### Phase 3 — Monetization (week 1–2)

Skill: `subscriptions-and-payments`.

1. Create subscription group and products, intro offers, per-country prices. **APPROVAL** for every price.
2. Configure billing grace period / account hold.
3. Wire RevenueCat (or your own server) with server-side entitlements and webhooks.
4. Test purchases end to end on devices (sandbox / license testers), including restore and expiry.

**Checkpoint 3:** a purchase on each platform unlocks premium, the backend records the entitlement, restore works on a reinstall. Without this, do not submit for review.

### Phase 4 — Store presence (parallel with Phase 3)

Skills: `listing-and-aso`, `store-screenshots`, `privacy-and-declarations`.

1. Listing text per locale and per store; run the validator.
2. Screenshots from real captures for every required size; upload through the APIs.
3. Privacy: code/SDK scan → App Privacy, Data safety, privacy manifest, export compliance, age rating, account deletion URL, health and AI disclosures. Privacy policy updated to match.

**Checkpoint 4:** validator passes, screenshots uploaded in the right order, every console section shows complete, privacy policy URL live.

### Phase 5 — Review readiness and submission

Skill: `review-readiness`.

1. Run the go/no-go checklist; produce the report.
2. Prepare the demo account (password sign-in, filled with data, premium unlocked) and the review notes.
3. **APPROVAL:** submit the iOS version (with its subscriptions attached) and, once the 14-day test is complete, apply for Play production access, then submit the production release.

**Checkpoint 5:** both apps approved. Release manually (not automatically) so you control the moment.

### Phase 6 — Launch and operate

Skills: `release-pipeline` (staged rollout, kill switches), `post-launch-ops`.

1. Release. On Play use a staged rollout for updates (the first production release cannot be staged).
2. Alerts, crash reporting, AI cost guards and review monitoring are live **before** the release, not after.
3. Update the website "coming soon" text and store links after release.

## Status file template

Keep `docs/launch-status.md` current; every agent reads it first.

```markdown
# Launch status (updated YYYY-MM-DD)

| Phase | State | Blocker / next action | Owner |
|---|---|---|---|
| 0 Accounts & keys | done / in progress / waiting | | |
| 1 Identity & CI | | | |
| 2 Play closed test | started YYYY-MM-DD, testers N/12 | | |
| 3 Monetization | | | |
| 4 Store presence | | | |
| 5 Review | | | |
| 6 Launch & ops | | | |

## Approvals log
- YYYY-MM-DD — <action> — approved by <role>

## Decisions
- Prices: (link to the decision, not the numbers if the repo is public)
```

## Human approval gates (never skip)

| Action | Why |
|---|---|
| Triggering a CI build that uploads to a store | Burns build numbers; may reach testers |
| Submitting for review / applying for production | Starts a public process; a rejection stays on record |
| Publishing or releasing a version | Irreversible for users who update |
| Creating or changing prices, offers, trials | Direct revenue impact; some changes notify subscribers |
| Accepting agreements, entering bank or tax data | Legal commitments by the account holder |
| Revoking keys, deleting profiles or products | Can break CI or live purchases |
| Deploying backend changes during a review | Reviewers test against your live backend |

Ask for each action separately. Approval for one build is not approval for the next.

## Verification

- Every checkpoint has evidence in the status file (build number, screenshot of the console state, command output).
- Before Phase 5, run `review-readiness` and attach its report.

## Common pitfalls

- Starting the Play 14-day test late; it is often the longest pole.
- Submitting the first app version without attaching the first subscriptions; they are reviewed together.
- Doing console work by hand before the API key exists, then redoing it.
- Changing backend behaviour while the app is in review (a reviewer hits the new behaviour with the old app).
- Letting the privacy policy, in-app consent text and store privacy answers drift apart.
