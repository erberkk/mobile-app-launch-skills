---
name: listing-and-aso
description: Use when writing, translating, reviewing or uploading App Store and Google Play listing text - app name, subtitle, keywords, promotional text, short and full description, what's new, support/privacy/marketing URLs - per locale and per store. Includes a character-limit and policy validator script (platform-name leaks across stores per guideline 2.3.10, banned claims like "unlimited", placeholders) and guidance for honest, verifiable claims.
---

# Listing and ASO

## Purpose

Listing text that fits every limit, ranks for the right words, says nothing the app cannot back up, and never mentions the other platform.

## Prerequisites

- The feature list of the build you will submit (not the roadmap).
- Decided pricing model and free-tier limits (exact numbers from code).
- Live URLs: support, privacy policy, terms, marketing site, account deletion page.

## Field limits

| Field | App Store | Google Play |
|---|---|---|
| Name / title | 30 | 30 |
| Subtitle | 30 | — |
| Short description | — | 80 |
| Keywords | 100 (comma-separated; counted in bytes is the safe assumption for non-ASCII) | — (indexed from text) |
| Promotional text | 170 (editable without a new version) | — |
| Description | 4000 | 4000 (full description) |
| What's new | 4000 | 500 (release notes per language) |

Verify current limits in App Store Connect and Play Console help before relying on them; the validator encodes the values above in one table so it is easy to update.

## Procedure

1. **Source file.** Keep all listing text in one JSON file per app (see [templates/listing.example.json](templates/listing.example.json)): `stores.ios.<locale>` and `stores.android.<locale>`. Text is written separately per store, even if most of it is shared.
2. **Keywords (iOS).** No spaces after commas, no words already in the name or subtitle (they are indexed anyway), no competitor brand names, no plurals of words already present, no category name.
3. **Platform wording.** iOS metadata must not mention Android, Google Play, Health Connect, Wear OS or other platforms; Play metadata must not mention iPhone-only terms like App Store, Apple Health, HealthKit, Apple Watch unless the feature truly exists on Android. Apple guideline 2.3.10: don't include names, icons, or imagery of other mobile platforms or alternative app marketplaces in your app or metadata. Write store-specific sentences instead, for example "Works with Apple Health." on iOS and "Works with Health Connect." on Play.
4. **Honest claims.**
   - No "unlimited" if there is any fair-use cap or rate limit. Say "generous monthly allowance (fair use)".
   - Numbers (database sizes, free-tier counts, languages) come from the shipped build. Re-check them when the code changes.
   - No medical, financial or guaranteed-result claims unless you are licensed to make them. Health apps: "for general wellness; not medical advice".
   - No prices in name/subtitle/keywords (2.3.7); no "free", "#1", "best" or calls to action in the Play title.
5. **Promotional text (iOS)** for timely messages; it can change without review of a new version.
6. **URLs.** Support URL (a real page with contact), privacy policy URL (no login wall), marketing URL. Account deletion URL for Play (see `privacy-and-declarations`).
7. **Validate:** `node scripts/check-listing.mjs listing.json` (exit code 1 on any error). Fix and re-run until clean.
8. **Upload** via API where possible: App Store Connect `appInfoLocalizations` (name, subtitle, privacy URL) and `appStoreVersionLocalizations` (description, keywords, promotional text, what's new, support/marketing URL); Play `edits.listings.update` then `edits.commit`. **APPROVAL** before committing a Play edit or changing live iOS promotional text.
9. **Read back** after upload and diff against the JSON.

## Writing guidance

- Lead with the concrete outcome in the first 2–3 lines; that is what shows before "more".
- Use the words people search for (from keyword research), not internal feature names.
- Keep feature names consistent with what the app shows on screen.
- Short paragraphs with uppercase section headings read well on both stores (no Markdown; both stores show plain text).
- Translate with a native reviewer; check that translated strings still fit the limits.

## Decision points needing human approval

- App name and subtitle (affect brand and search); later changes on iOS need a new version.
- Any claim with a number; any comparison with competitors.
- Committing Play edits / publishing metadata.

## Verification

- Validator passes for every locale and store.
- Read-back matches the source file.
- A person who has not seen the app can read the listing and find each claimed feature in under a minute.

## Common pitfalls

- One shared description pasted into both stores, carrying "Health Connect" into iOS (rejection under 2.3.10).
- Free-tier numbers in the description older than the code.
- "Unlimited AI" when the backend has daily caps.
- Keyword field stuffed with spaces and duplicates, wasting bytes.
- Privacy policy URL that redirects to a login or a page that does not mention the app.
