# Google Play production access (new personal accounts)

Applies to personal developer accounts created after 13 Nov 2023. Official page: [App testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465). Observed in Play Console in November 2026; the form can change, so read it again before you apply.

## When you can apply

- The Dashboard shows a counter: "N testers opted in continuously for D days". The **Apply for production** button unlocks when it reaches 12 testers and 14 days.
- Exactly 12 is enough, but one tester leaving resets the count. Recruit more than 12, and tell testers not to leave the test until access is granted.
- Only the closed test counts. A tester who opts out and back in starts their 14 days again.

## The form

There are three steps: **About your closed test**, **About your app**, **About your production readiness**. Leaving or closing the dialog before you click **Next** or **Apply** loses what you typed, so draft the answers in a file first.

Every free-text answer is limited to **300 characters**. Long drafts must be cut down.

| Step | Question (paraphrased) | Type |
|---|---|---|
| Closed test | Where did you find your testers (friends and family, a paid testing service, ...)? | Text, 300 |
| Closed test | How easy was it to recruit testers? | Very difficult / Difficult / Neither / Easy / Very easy |
| Closed test | What engagement did you get? Did testers use all features? Did usage match what you expect in production? If not, explain the difference. | Text, 300 |
| Closed test | Summarise the feedback and how you collected it. | Text, 300 |
| App | Who is the target audience? | Text, 300 |
| App | How does the app provide value to users? | Text, 300 |
| App | Expected installs in the first year | 0–10K / 10K–100K / 100K–1M / 1M+ / Don't know |
| Readiness | What did you change based on the closed test? | Text, 300 |
| Readiness | How did you decide the app is ready for production? | Text, 300 |

Google states that the "About your app" answers are not shown on Play and do not affect feature access or visibility.

## Answers that worked

Answers in this pattern were approved on the first application, within about a day. Google's stated review time is up to 7 days.

- **Numbers from your own data for the test window**, not impressions. For example: app opens, onboardings completed, and counts for each core action. Use only numbers you can back up; Play Console sees install and vitals data.
- **Name every main feature that testers used**, because the question asks about all features. Describe the normal usage pattern (for example "daily logging is the core, training a few times a week") instead of listing weak spots.
- **Feedback mapped to fixes.** Name the channels (tester group chat, in-app feedback form, crash and error reports), then list the concrete issues. In the changes answer, list the builds shipped during the test and what each fix was.
- **Say that no paid tester service was used**, if that is true.
- **Readiness backed by evidence**: crash and ANR rate from Android vitals, automated test coverage, and that the final build was with testers before you applied. It also helps to mention the same codebase passing App Store review.
- Keep the target audience consistent with the Target audience and content declaration, for example the minimum age.

Common reasons for refusal: fewer than 12 testers for 14 days, testers who installed once and stopped, no updates during the test, and vague answers ("testers liked it", "fixed some bugs"). A refusal does not penalise the account. Keep testing (usually another 14 days), then apply again with new data.

## After access is granted

- The **production track starts with no countries**. The release review shows "No countries or regions selected" until you add them in Production › Countries/regions. Saving them creates separate items in the Publishing overview.
- The first production release goes to 100%. Staged rollout appears only for later updates.
- You can promote the build that testers used: Closed testing › Promote release › Production. Release notes are copied with it.
- **APPROVAL:** sending the changes for review. With managed publishing off, the release goes live as soon as it is approved.
