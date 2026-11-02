---
name: subscriptions-and-payments
description: Use when setting up or changing auto-renewable subscriptions or in-app purchases on the App Store and Google Play - subscription groups and products, base plans, intro offers and free trials, per-country pricing (price points, Play decimal-comma and default-currency traps), billing grace period and account hold, RevenueCat entitlements and webhooks with the server as source of truth, customer deletion on account deletion, sandbox / license-tester purchase testing, restore purchases, and paywall error and empty states that pass review.
---

# Subscriptions and payments

## Purpose

Sell a subscription that works the same on both stores, is priced on purpose in every country, survives failed payments, and that a reviewer can actually buy.

## Prerequisites

- Paid apps agreements active, bank and tax complete (`accounts-and-tax`). Without this, products often do not load even in sandbox.
- App record exists in App Store Connect and Play Console; Play needs at least one uploaded build (any track) before you can create in-app products.
- A backend that can receive webhooks (for server-side entitlements).

## 1. Product model

Keep it simple: one subscription group / one subscription with two durations is enough for most indie apps.

| Concept | App Store | Google Play |
|---|---|---|
| Container | Subscription group (user can hold one product per group) | Subscription (product) |
| Duration/price variants | Separate products: `com.example.app.premium.monthly`, `.annual` | Base plans: `monthly`, `annual` |
| Free trial / intro | Introductory offer on each product | Offer on a base plan (eligibility: new customers) |
| Display name, description | Per product, per locale | Per subscription, per locale |
| Review | First products are reviewed **with the first app version**; each needs a review screenshot (the paywall) and review notes | No separate review of products |

Product IDs are permanent. Decide them once (**APPROVAL**).

## 2. Pricing (APPROVAL for every price)

Strategy that works for indie apps:

1. Pick a base price in USD; let both stores generate other countries from it.
2. Override only the markets where the auto-conversion is wrong for you (for example euro countries to a clean `x.99`, and markets with very different purchasing power).
3. Apple only accepts its **price points**; the exact value you want may not exist. List available points first and choose the nearest.
4. Show the saving of the annual plan computed from **store prices at runtime**, not a hardcoded percentage.
5. Record decisions with date and rationale in a private doc.

Verify after saving: read back every country row on both stores; no row below 1 unit of currency unless intended; trial still attached.

### Automation traps (when scripting the consoles)

- Play Console UIs localized to a decimal-comma locale need `9,99`; typing `9.99` can be read as `999`. Read the locale from the page before typing numbers.
- Play's "Set prices" dialog may default the currency to the account's local currency; switch it explicitly and read it back.
- Apple pricing menus: select items only inside the currently open menu; a stray click after scrolling can pick the wrong (lowest) price point and save it.
- Always run a safety gate before Confirm: abort if any target row differs or any price is suspiciously low. Then re-read after save. See `console-automation`.
- Prefer the APIs: App Store Connect API (`subscriptionPrices`, `subscriptionPricePoints`) and Play Developer API (`monetization.subscriptions`, with `convertRegionPrices` to preview conversions).

## 3. Failed payments: grace period and account hold

- **Apple Billing Grace Period**: off by default. Options 3, 16 or 28 days (weekly subscriptions capped at 6), for all renewals or paid-to-paid only, sandbox only or production + sandbox. Turn it on in sandbox first, test, then production. [Docs](https://developer.apple.com/help/app-store-connect/manage-subscriptions/enable-billing-grace-period-for-auto-renewable-subscriptions).
- **Google Play**: grace period is on by default per base plan and adjustable; account hold is on by default and lasts 60 days minus the grace period. [Docs](https://developer.android.com/google/play/billing/lifecycle/subscriptions).
- During grace the user keeps access; during account hold access is removed until payment recovers. Your entitlement logic must follow the store state, which is why the server is the source of truth.

## 4. RevenueCat (or your own server)

Using RevenueCat (any equivalent works the same way):

1. Connect stores: App Store In-App Purchase key (`.p8`, Key ID, Issuer ID) and the Play service account JSON (with financial data and orders/subscriptions permissions for this app only). Set the App Store Server Notifications URL and Google Real-time developer notifications (Pub/Sub topic) to RevenueCat.
2. Model: products → one **entitlement** (`premium`) → one **offering** (`default`) with packages (`$rc_monthly`, `$rc_annual`).
3. App: configure the SDK with the **public** platform keys (`appl_…`, `goog_…`); pass them at build time, not committed. Identify the user with your backend user ID (`logIn(userId)`) so purchases follow the account.
4. **Server as source of truth**: a webhook endpoint (Bearer secret) writes an `entitlements` row (`user_id`, `entitlement`, `active`, `expires_at`, `source`) for events like `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `BILLING_ISSUE`, `EXPIRATION`, `PRODUCT_CHANGE`, `TRANSFER`. Premium-gated server features check this table, never a client flag. Make the handler idempotent (event id) and tolerant of out-of-order events (compare event timestamps).
5. **Restore behaviour**: decide what happens when one store account is used by two app accounts (transfer to the new user vs keep). Test it; reviewers often use a fresh store account.
6. **Account deletion**: when a user deletes their account, also delete the RevenueCat customer: `DELETE https://api.revenuecat.com/v2/projects/{project_id}/customers/{customer_id}` with a v2 secret key that has `customer_information:customers:read_write`. Deletion does **not** cancel a store subscription; tell the user how to cancel before deleting.
7. Manual grants (support, reviewers): insert an entitlement row with `source = 'manual'` and an explicit expiry; keep a log.

See [references/webhook-handler.md](references/webhook-handler.md) for a handler skeleton.

## 5. Testing purchases

| | iOS | Android |
|---|---|---|
| Tester | Sandbox Apple Account (App Store Connect › Users and Access › Sandbox), or TestFlight | License testers (Play Console › Settings › License testing) on an internal/closed test install |
| Cost | TestFlight and sandbox purchases are free | License testers are not charged |
| Renewal speed | Sandbox renewals are accelerated (a month lasts minutes) | Test renewals are accelerated |

Test matrix (each platform): first purchase with trial, purchase without trial (ineligible), restore on reinstall, restore on a second device, cancel → expiry, billing failure → grace (sandbox setting), upgrade/downgrade between monthly and annual, purchase while signed out / guest (if allowed), backend `entitlements` row written for each case.

Rule: **no review submission until a real purchase has unlocked premium end to end on both platforms.**

## 6. Paywall that passes review

Apple 3.1.2 and Play subscription policies expect, on the purchase screen:

- Price and billing period from the store (localized), and what the user gets.
- Trial terms next to the price that follows (for example "7 days free, then $X / year"); the billed amount must be the most prominent price element, not hidden under the trial.
- Shown only to eligible users: trial wording when the store says the user is eligible.
- Restore Purchases, Terms of Use (EULA) and Privacy Policy links (opening without login).
- Manage / cancel subscription link for subscribers (store subscription page).

Error and empty states (common cause of guideline **2.1(b)** "could not find / purchase the IAP"):

- Offerings fail to load → show "Couldn't load prices. Try again" with a retry button, not "Coming soon" with a disabled button.
- Missing SDK key in a release build must fail CI, not silently show an empty paywall.
- No placeholder text (`[PRICE]`, lorem ipsum) can ever render.

## Decision points needing human approval

Product IDs, prices per country, trial length, grace period settings, manual entitlement grants, restore/transfer behaviour.

## Verification

- Both stores: products "Ready to Submit"/"Active", review screenshot attached (iOS), every price row read back.
- Device test matrix passed; webhook rows present; RevenueCat customer deleted after a test account deletion.
- Paywall checked in every supported language, small and large text sizes.

## Common pitfalls

- First subscription not attached to the first app version submission → products never reviewed.
- Hardcoded prices or saving percentages that drift from the store.
- Client-side premium flag trusted by the server.
- Webhook not idempotent; duplicate `RENEWAL` extends access twice.
- Treating account deletion as subscription cancellation.
- Reviewer's fresh Apple Account conflicts with an existing transfer rule → purchase "fails".
