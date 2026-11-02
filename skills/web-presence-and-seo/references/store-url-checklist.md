# Store URL checklist

Fill the "Your URL" column, open each URL in a private window on a phone (signed-out, no cookies), and run `scripts/check-site.mjs` before pasting anything into a console. Field names drift; check the linked help page when a label does not match.

## App Store Connect

| Field | Where | Required | Per localization | Page it points to | Your URL |
|---|---|---|---|---|---|
| Privacy Policy URL | App Privacy | Yes | Yes | `/privacy` (`/<lang>/privacy`) | |
| User Privacy Choices URL | App Privacy | No | Yes | Page where users manage choices / opt out, if you have one | |
| Support URL | Version information | Yes | Yes | `/support` (contact must be reachable) | |
| Marketing URL | Version information | No | Yes | `/` (`/<lang>`) | |
| License agreement (EULA) | App Information | Standard Apple EULA applies unless you add your own | Per region | `/terms` if custom; also link terms in the subscription paywall and description | |
| Account deletion | In the app | Yes, in-app start (5.1.1(v)) | — | Web page only as an extra or as the final step the app links to directly | |

Docs: [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information), [Required, localizable and editable properties](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties), [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), [Account deletion (5.1.1(v))](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

Subscription apps: the paywall and the App Store description need working links to the privacy policy and terms of use (EULA). Missing links are a common rejection reason (see `review-readiness`).

## Google Play Console

| Field | Where | Required | Page it points to | Your URL |
|---|---|---|---|---|
| Privacy policy | App content › Privacy policy (and Data safety) | Yes, for every app | `/privacy` | |
| Delete account URL | App content › Data safety (account deletion section) | Yes, if users can create an account | `/delete-account` | |
| Partial data deletion | Data safety (data deletion questions) | Answer only if you offer deleting some data without deleting the account; if the form asks for a link, use an anchor on the deletion page | `/delete-account#some-data` | |
| Website | Store settings › Store listing contact details | No | `/` | |
| Email | Store listing contact details | Yes | A monitored address on your domain | |
| Terms | Linked from the listing description / in-app | Recommended for subscriptions | `/terms` | |

Docs: [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111), [Prepare your app for review (privacy policy URL rules)](https://support.google.com/googleplay/android-developer/answer/9859455), [Data safety form](https://support.google.com/googleplay/android-developer/answer/10787469).

## Requirements every URL above must meet

- [ ] HTTPS with a valid certificate; HTTP 200 on the final URL; at most one redirect for pages (none for `.well-known`).
- [ ] No login, cookie wall, paywall, geo-block or bot challenge. Readable without JavaScript.
- [ ] HTML page, not a PDF or a file download.
- [ ] Names the app exactly as on the store listing (and the developer name).
- [ ] Privacy policy describes the same data, purposes and recipients as the App Privacy and Data safety answers.
- [ ] Deletion page: request path on the page itself (button, form or a mailto with a fixed subject), what is deleted, what is kept and for how long, how long the deletion takes, and "deleting your account does not cancel a store subscription" with links to Apple and Google subscription management.
- [ ] Each language version exists or falls back to the default language without a 404; `hreflang` lists them.
- [ ] URL is final. Changing it later means updating both consoles and old app versions still link the old one; keep a permanent 301.

## App links (not store form fields, but checked at review and by the OS)

| File | URL | Must |
|---|---|---|
| AASA | `https://<host>/.well-known/apple-app-site-association` | 200, `application/json`, no redirect, contains `<TEAM_ID>.<bundle id>` |
| Asset links | `https://<host>/.well-known/assetlinks.json` | 200, `application/json`, no redirect, contains the package name and the Play **app signing** SHA-256 |

Repeat for every host the app claims (apex and `www` if both are listed).
