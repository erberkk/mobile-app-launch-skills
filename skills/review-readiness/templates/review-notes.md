# Review notes template

Paste into App Store Connect › App Review Information › Notes (and adapt for Play › App access instructions). Replace every `<...>`. Credentials go only into the dedicated fields, never into this file in a repo.

```
Hello, and thank you for reviewing <APP NAME>.

OVERVIEW
<APP NAME> is <one sentence: what it does, for whom>. <Guest mode: "It can be used without an account." / "An account is required.">
<If iPhone-only: "The app is designed for iPhone; on iPad it runs in iPhone compatibility mode.">

DEMO ACCOUNT (premium active)
The credentials are in the Sign-in fields. Sign in: <exact path, e.g. Profile > Sign in > "Use email and password">.
The account has sample data (<what: profile, history, plans...>) and an active premium entitlement, so all features can be reviewed without a purchase.

WHERE TO FIND KEY FEATURES
- <Feature 1>: <tab / button path>
- <Feature 2>: <path>
- Premium features: <list and paths>

IN-APP PURCHASES
Subscription group "<GROUP>" with <product ids> (auto-renewable<, N-day free trial for eligible new subscribers>).
To test a purchase: <sign out (Profile > Sign out) / create a new account>, open <paywall path> and use a Sandbox Apple Account.
The paywall shows price, billing period, trial terms, Restore Purchases, Terms of Use and Privacy Policy. Subscribers can manage or cancel at <path>.

AI FEATURES (if any)
<Feature> uses <AI provider> as a processor through our server. Before first use the app asks for consent, naming the provider; it can be withdrawn in <path>. Content is not used to train models <only if true>. Health data from <Apple Health> is never sent to the AI provider.

HEALTH DATA (if any)
Apple Health access is optional: <path>. We read <types> and write <types>. Health data is not used for advertising and is not shared with third parties.

ACCOUNT DELETION
<path, e.g. Profile > Delete account>. It permanently deletes the account and its data<, and requires re-authentication>. It does not cancel an App Store subscription; the screen explains how to cancel. Web: https://example.com/delete-account

TRACKING / ADS
<"No advertising, no tracking, no ATT prompt." or describe accurately.>

SCREEN RECORDING
A recording from a physical <iPhone> on the latest <iOS>, starting at app launch, is attached to our reply in App Review messages (<file name>). It shows onboarding, account creation with <providers>, the main features, the sandbox purchase, premium features and account deletion.

EXTERNAL SERVICES
- <Auth/database provider, region>: <what for>
- <Payments: StoreKit via <wrapper>>: subscriptions and entitlement status
- <AI provider>: <features>, called only from our server
- <Data sources, e.g. food/maps API>: <what for>
- <Email provider>: sign-in codes / transactional email
- <Health framework>: optional, on device

REGIONAL DIFFERENCES
<"The app works the same in all regions; prices follow each storefront." or list differences.>

REGULATED CONTENT
<"General wellness app, not a medical device; no protected third-party content." or list documents.>

CONTACT
<email> · https://example.com/support
```
