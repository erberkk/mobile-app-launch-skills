# Lessons from real launches

Anonymized incidents from shipping subscription apps to the App Store and Google Play as a small team. Each one changed a checklist line in the skills. They are here so you can recognise the pattern before it costs you a review cycle.

## Review

**"We were unable to complete the purchase" had three causes at once.** (2.1(b)) The demo account had been put in a frozen state by a moderation flow; the backend rejected the reviewer's purchase because the store transaction was already bound to a different (test) user; and server-side validation sent new StoreKit 2 signed transactions to the legacy receipt endpoint, which returned an error. Fixing one layer would not have been enough. → `review-readiness`: test with a fresh sandbox account on a clean install; `subscriptions-and-payments`: decide and test restore/transfer rules.

**The billing note said "App Store or Google Play" on iOS.** (2.3.10) A platform-agnostic string in a subscription sheet was enough for a metadata rejection. → Pick platform-specific strings at runtime; the listing validator flags other-platform words.

**Screenshots had a hand-drawn status bar that looked like Android.** (2.3.10) → Real captures only; no status bar unless it is the real iOS one.

**An iPhone-only app was reviewed on an iPad.** The reviewer used an iPad in compatibility mode; layouts and a sign-in sheet misbehaved there. → Run the full flow on an iPad simulator even for iPhone-only apps.

**"We cannot access all features."** (2.1) The demo account was empty: no history, no content, nothing to see on half of the screens. A demo video did not help. → Demo account filled with data and premium unlocked server-side.

**Restore Purchases and a manage-subscription link were missing.** (3.1.1 / 3.1.2) Both were added only after rejection. → Paywall checklist.

**Terms and privacy links opened an in-app route that required sign-in.** → Legal links open in the browser and work signed out.

**A two-stage account deletion (pause, then 30-day recovery) confused review.** → One clear, permanent deletion path, with re-authentication and a note about subscriptions.

**Push tokens were never delivered.** Adopting the scene-based app lifecycle skipped the plugin's method swizzling; nobody noticed until review. → Exercise push, deep links and widgets on TestFlight before submitting.

**The backend went down during review.** A free-tier database provider had an outage while the app was in review. → Backend on a plan and with alerts suited to the review window; no deploys during review.

## Privacy

**The policy said health data "never leaves the phone"; the code synced it and fed it to the AI assistant.** Sleep data from the platform health store was added to the server for a new insights feature, and the assistant's context builder included "everything we know about the user". Caught in a pre-submission audit, not by review. The fix was a rule, not a sentence: data from Apple Health / Health Connect never goes to the AI provider or any third party, enforced by an allow-list in the request builder and a test. → `privacy-and-declarations` sections 9–10.

**The store privacy answers were older than the app.** They still said "no diagnostics collected" after an anonymous crash reporter and usage counters had shipped. → Derive answers from a code scan each release.

**The free-tier numbers differed between the handoff doc, the store description and the code.** → Numbers in listings come from code; the validator warns on numbers not listed as facts.

**A delete-account endpoint started requiring re-authentication before the app that understood the new response shipped.** Old app versions would have shown a generic error. → Ship the backend change and the app change together, or keep the old behaviour for old versions.

## Screenshots and claims

**A screenshot showed a settings row the app didn't have.** It came from a design mock. Instead of removing it, the team built the feature, because it was a good idea — and only then shipped the screenshot. → Screenshots are real captures; if a frame and the app disagree, fix one of them before upload.

**An AI food parser counted a composite dish twice** (the dish and its listed ingredients), so a screenshot-worthy daily total was inflated. → Numbers in screenshots must be what the app really outputs for the demo data; an evaluation set with expected ranges caught the regression.

**"Unlimited" in a draft listing while the backend had daily caps.** → Say "generous allowance (fair use)"; the validator blocks "unlimited".

## Payments and console automation

**Typing `9.99` into a decimal-comma console produced `999.99`.** The console was localized; the dot was read as a thousands separator. → Read the page locale and format numbers for it; gate before saving.

**A mouse click after scrolling a price menu picked the lowest price point, and it was saved.** → Click only inside the open menu; safety gate rejects any price below 1 and any row that differs from the target; read back after save.

**The price dialog defaulted to the account's local currency.** → Select and read back the currency explicitly.

**The exact target price did not exist as an Apple price point.** → List available points first and choose the nearest on purpose; mirror it on Play for consistency.

**A key file downloaded through the automated browser vanished.** → Enable downloads via CDP (`Browser.setDownloadBehavior`) before clicking download.

**The paywall showed "Coming soon" when the SDK key was missing from a release build.** To a reviewer this is "IAP not available". → CI fails when public SDK keys are missing; paywall shows retry on load errors.

## Release

**Native code (widgets, live activity, share extensions) was written but never compiled until the release build.** → Build native targets in CI from day one.

**The Play closed-test track and tester list were ready, but no release was in the track, so the 14-day counter never started.** → The counter needs a live closed-test release and opted-in testers; check the count weekly.

**A closed-test tester started the "free trial" and asked whether they would be charged. They would have been.** The tester list was on the closed track but not ticked under Play's account-wide License testing, so the purchase was real. → Tick the closed-test email list under License testing before any tester can reach the paywall; testers should see "Test card, always approves".

**The first iOS submission could not select a build.** The App Store version was named `1.0` while every build was `1.0.0`; the Build section showed only "Upload your builds". → Name the store version exactly like the builds' marketing version.

**The first subscriptions could not be added to the review draft.** One subscription had no display-name localization, and neither had a review screenshot. → Fill localization and a real paywall screenshot for every product before "Add for Review".

**The Instagram account-linking pop-up offered the founder's personal account.** The browser was logged in to the personal profile; continuing would have linked it to the brand Page and converted it to a professional account. → Read the "Log in as …" name in every OAuth pop-up; switch to the brand account first.

**A month of content was planned as if the app were live on both stores on day 1.** iOS was still in review and Android needed 14 more days of closed testing, so most CTAs ("free on iOS & Android") were wrong, and an audit also found claims that contradicted the app. → Phase the calendar on real launch events and check every claim against the shipped build.

**The self-hosted scheduler's backend would not start after removing Elasticsearch.** Temporal's database still held the default text search attributes from the Elasticsearch setup. → Disable the default attributes and recreate the Temporal database before scheduling anything.

**The version was pulled from review to add a product-page Header image; the new draft no longer contained the subscriptions.** Removing a version from review marks the version and its subscriptions "Developer Rejected" and empties the draft. → Add every product-page asset before submitting; if you must pull a version, re-add the group and each subscription and check the draft lists all items.

**The first iOS submission came back as 2.1 "Information Needed", not a rejection for a bug.** Apple asked for a device screen recording from launch through registration, paid features and account deletion, plus purpose, setup steps, external services, regional differences and regulatory status. The notes had only covered the demo login. → `review-readiness` section 6 lists all six items; answer them in the first submission.
**A guest rate limit (by IP) was accidentally applied to paying subscribers.** → Test limits per user type; alert on limit hits for premium users.

**An escalation to a larger AI model fired far more often than intended.** After fixing the escalation rule, cost per request dropped by more than an order of magnitude. → Alert on every expensive-model escalation while tuning; track AI cost per paying user daily.
