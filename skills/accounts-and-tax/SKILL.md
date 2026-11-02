---
name: accounts-and-tax
description: Use when opening or configuring Apple Developer Program and Google Play Console accounts for a paid or subscription app - choosing individual vs organization, D-U-N-S, Play personal-account testing requirement, App Store Small Business Program and Google Play reduced service fee, paid apps agreements, bank and tax forms (W-8BEN for non-US individuals), and creating the App Store Connect API key and Google Play service account. Includes a Turkey-specific reference for App Store and Google Play income under the Income Tax Law article 20/B.
---

# Accounts and tax

## Purpose

Get both developer accounts able to sell, at the lowest legitimate fee, with API access set up first so later work is scriptable.

## Prerequisites

- Legal identity documents of the account holder (individual) or the legal entity details and a D-U-N-S number (organization).
- A bank account that can receive international transfers (for some tax regimes, a dedicated account; see the Turkey reference).
- A secure place for secrets outside any repository (password manager or an encrypted folder).

## Decision 1 — Individual or organization (APPROVAL)

| | Individual / personal | Organization |
|---|---|---|
| Apple seller name on the App Store | Your legal personal name | The legal entity name |
| D-U-N-S number | Not needed | Required (free from Dun & Bradstreet; allow ~5 business days plus ~2 for Apple to receive it) |
| Google Play testing before production | **New personal accounts: closed test with ≥12 testers opted in for 14 continuous days** | Not required |
| Google Play public details | Legal name, country, developer email shown | Legal name, address, email, phone shown |

Choose deliberately: changing later means account migration or app transfer. Sources: [Apple D-U-N-S](https://developer.apple.com/support/D-U-N-S/), [Play account information](https://support.google.com/googleplay/android-developer/answer/13628312), [Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465).

## Procedure

### 1. Apple Developer Program

1. Enroll at developer.apple.com with the Apple Account that will be the **Account Holder**. Turn on two-factor authentication.
2. In App Store Connect › **Business** (Agreements, Tax, and Banking): accept the **Paid Apps** agreement. **APPROVAL** — the account holder accepts it.
3. Add bank account and complete tax forms. A non-US individual normally completes **W-8BEN** (certifies foreign status; may claim treaty benefits). Organizations use W-8BEN-E. The forms are filled in by the account holder; an agent can explain fields but does not choose treaty claims. Reference: [IRS Form W-8BEN](https://www.irs.gov/forms-pubs/about-form-w-8-ben).
4. Wait until the agreement shows **Active**. Paid products cannot be sold (and subscriptions often cannot be fetched in sandbox) until then.
5. Apply to the **App Store Small Business Program** after the Paid Apps agreement is accepted. Eligibility: up to USD 1 million proceeds in the prior calendar year (new developers qualify), counting all associated developer accounts. Commission is 15% (and lower in some cases). Proceeds adjust from 15 days after the end of the fiscal month of approval. Verify at [Small Business Program](https://developer.apple.com/app-store/small-business-program/).

### 2. Google Play Console

1. Create the developer account with the right type (Decision 1). Verify identity, contact email and phone; the payments profile name and address must match your documents (or D&B profile for organizations).
2. Set up the **payments profile** (merchant account), bank account and tax information in the Payments profile. **APPROVAL**.
3. Service fee: Google Play has a reduced tier (historically 15% on the first USD 1M of earnings per year, 15% on auto-renewing subscriptions), and is rolling out a revised fee structure in some markets. Check what applies to you and whether enrollment is needed at [Service fees](https://support.google.com/googleplay/android-developer/answer/112622).
4. If personal and new: plan the closed test now (see `release-pipeline`). It is usually the longest wait of the whole launch.

### 3. API access first (do this before any console work)

#### App Store Connect API key

1. The **Account Holder** requests API access once (Users and Access › Integrations › App Store Connect API). Approval is case by case.
2. **Account Holder or Admin** generates a **Team key**. Give it the narrowest role that covers your automation. **App Manager** covers apps, metadata, screenshots, pricing, TestFlight and (with the right options) certificates and profiles for most indie setups; use **Admin** only if a task truly needs it. Team keys apply to all apps in the account, so app access cannot be limited per key.
3. Download the `.p8` file (it can only be downloaded once), note the **Key ID** and **Issuer ID**. Store all three outside the repo.
4. Test with one read-only call (for example list apps) before relying on it.

Docs: [App Store Connect API](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/), [Creating API keys](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api).

Separate keys you will also need later: an **In-App Purchase key** (for RevenueCat / server-side receipt APIs) — see `subscriptions-and-payments`.

#### Google Play service account

1. In Google Cloud, create a project (or use an existing one), enable the **Google Play Android Developer API**, create a service account and a JSON key. Store the JSON outside the repo.
2. In Play Console › **Users and permissions**, invite the service account email. Grant only what it needs, scoped to the specific app: release management for CI, store presence for listings/screenshots, financial data and orders/subscriptions for a billing backend (for example RevenueCat). Keep other apps in the same account untouched.
3. Permissions can take time to propagate; test with a read-only call (for example `edits.insert` then `edits.delete`, or list reviews).

Docs: [Play Developer API getting started](https://developers.google.com/android-publisher/getting_started).

Why first: with these two credentials, signing, builds, metadata, screenshots, TestFlight groups and much of pricing are scriptable. Browser clicking becomes the exception (`console-automation`).

### 4. Country-specific tax regimes

Income from app stores is taxed where you live. The stores withhold or remit some taxes (VAT/sales tax on consumer prices in many countries) but your personal or corporate income tax is yours to handle. Get local advice.

- Turkey: see [references/turkey-gvk-20b.md](references/turkey-gvk-20b.md).

## Decision points needing human approval

- Account type (individual vs organization).
- Accepting agreements, entering bank and tax data, treaty claims.
- Enrolling in fee programs (requires agreeing to terms).
- Creating keys with Admin role; revoking keys (can break CI).

## Verification

- Apple: Business page shows Paid Apps agreement **Active**, bank and tax **Complete**.
- Play: payments profile verified; app creation allowed; no pending verification banners.
- API key and service account each succeed on one read-only call.
- Secrets exist only in the secret store and CI variables; a secret scan of the repo finds nothing.

## Common pitfalls

- Creating the API key late and doing dozens of console tasks by hand first.
- Forgetting associated developer accounts on the Small Business Program form.
- Payments profile name not matching ID documents; verification stalls.
- Losing the `.p8` (only downloadable once) — you must revoke and regenerate, then update CI.
- Granting the Play service account account-wide admin when it shares a console with other apps.
- Assuming a fee tier applies automatically; some programs require enrollment.
