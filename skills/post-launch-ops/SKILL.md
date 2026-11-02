---
name: post-launch-ops
description: Use when preparing or running operations for a live mobile app - instant alerts through Slack incoming webhooks (alert / growth / premium channel pattern), crash and error reporting with PII scrubbing and anonymous rate buckets, cost guards for AI features (per-user daily ceilings, monthly budgets, recording cost on aborted streams), monitoring and replying to App Store and Google Play reviews through their APIs, store console notifications, and backend capacity alerts.
---

# Post-launch operations

## Purpose

Know about problems before users write reviews, keep variable costs (especially AI) bounded, and answer users quickly. Set all of this up **before** release.

## Prerequisites

- A backend that can run scheduled jobs (cron) and send HTTP requests.
- A Slack workspace (or any chat with incoming webhooks) used only for this app's alerts.
- API access from `accounts-and-tax` (App Store Connect key; Play service account with reply-to-reviews permission).

## 1. Alert channels

Three channels, one incoming webhook each (stored as backend secrets, never in the app):

| Channel | What | When |
|---|---|---|
| `#alert` | Errors needing action: crash spike, failed webhooks, payment processing errors, AI cost ceiling hit, capacity warnings, expensive-model escalations | Instantly |
| `#growth` | Signups, activation, retention counts, review summary | Daily digest |
| `#premium` | Trials started, conversions, cancellations, refunds, billing issues | Daily digest (or instantly for refunds) |

Rules:

- Escape user-controlled text before posting (Slack mrkdwn: `&`, `<`, `>`), and never include emails, names or message contents; use hashed or internal IDs.
- Deduplicate: one message per incident key per time window (e.g. per error fingerprint per hour) to avoid floods.
- Every alert says what happened, how many, since when, and the first action to take.

Sender skeleton: [templates/notify.ts](templates/notify.ts).

## 2. Crash and error reporting

- Use a crash SDK or your own endpoint; either way:
  - **Scrub PII** on the device before sending: emails, phone numbers, tokens, IPs (v4 and v6), free-text user input. Unit-test the scrubber.
  - Send app version, build, OS, device class, a stack fingerprint, and a **coarse, anonymous rate bucket** (e.g. sessions-per-day bucket) instead of user IDs, if reports are "not linked" in your privacy answers.
  - Let users turn reporting off in settings if your privacy policy says so.
  - Keep retention short (e.g. 30 days) and state it in the policy.
- Upload debug symbols / mapping files from CI (obfuscated builds are unreadable otherwise).
- Alert on rate, not single events: e.g. a fingerprint seen by > N installs in an hour, or crash-free sessions below a threshold.
- Also watch store-side vitals: Play Console Android vitals (crash and ANR rates) and Xcode Organizer / App Store Connect crashes.

## 3. AI cost guards

AI features are the one cost that scales with a single user's behaviour. Guard at the server:

- **Per-user daily ceilings** (requests and/or estimated cost) and a **monthly budget** per plan; free tiers get a small lifetime or monthly allowance.
- Count cost from the provider's reported token usage per request, priced per model; store per user per day.
- **Record cost even when the stream is aborted** (user closes the screen, timeout, client disconnect): accumulate usage as the stream progresses and write it in a `finally` block. Otherwise aborted streams are free compute.
- Rate-limit bursts per user and per IP (guests), with `Retry-After`.
- Default to the cheapest adequate model; escalate to a larger model only on explicit signals, and post every escalation to `#alert` while you tune it.
- When a budget is reached: degrade (cheaper model, fewer requests) rather than fail silently; warn once at ~80%. Do not advertise "unlimited".
- Daily job: total AI spend vs revenue; alert if spend per active subscriber exceeds a threshold.

See [references/ai-cost-guard.md](references/ai-cost-guard.md) for a schema and handler sketch.

## 4. Store reviews

- **App Store**: list reviews with `GET /v1/apps/{id}/customerReviews` (sort by `-createdDate`), reply with `POST /v1/customerReviewResponses`. Turn on App Store Connect email notifications for developer responses.
- **Google Play**: `reviews.list` and `reviews.reply` (Android Publisher API; covers recent reviews with text). Enable Play Console email notifications for low-star reviews.
- Daily job: fetch new reviews, post a summary to `#growth`, post 1–2 star reviews to `#alert` with the app version.
- Replies: draft automatically if you like, but a human approves before posting (**APPROVAL**). Be short, specific, no copy-paste walls, never ask for personal data in public; offer the support address.
- In-app rating prompts: use the system APIs (`SKStoreReviewController` / `requestReview`, Play In-App Review); never offer rewards for ratings.

## 5. Capacity and service alerts

- Backend plan limits (database size, egress, function invocations, connection count): a daily job compares usage with the plan limits and alerts at 70% and 90%.
- Health check: an external uptime check on the API and the website, alerting to `#alert`.
- Webhook failures (RevenueCat, store notifications): alert on any non-2xx run of more than a few minutes.
- Store console notifications: enable email for policy issues, pre-launch reports, vitals, payouts and agreement changes. A changed agreement that is not accepted can stop sales.

## 6. Routine

| Cadence | Task |
|---|---|
| Daily | Read `#alert`; reply to new low-star reviews; check vitals after each rollout step |
| Weekly | Crash top-5, AI spend vs revenue, review themes, tester feedback |
| Per release | Staged rollout watch, kill switch ready, symbols uploaded |
| Monthly | Agreements/tax status, certificate and key expiry dates, dependency updates, store policy announcements |

## Decision points needing human approval

Posting review replies, changing AI budgets or ceilings, plan upgrades (cost), anything that changes what data is collected (update privacy answers first).

## Verification

- Send a test alert to each channel; trigger a test crash in a release build and see it arrive scrubbed.
- Abort an AI stream mid-way in a test and check the cost row was written.
- Run the review job once by hand and check the summary.

## Common pitfalls

- Alerts that include user emails or chat text.
- Alert floods that train everyone to ignore the channel.
- Cost recorded only on successful completion.
- Discovering the free backend tier paused the project because nobody watched usage.
- Replying to reviews defensively or with personal data requests.
