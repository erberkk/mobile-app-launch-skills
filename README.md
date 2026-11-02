# Mobile App Launch Skills

**Agent skills for shipping an iOS and Android app to the Apple App Store and Google Play, from developer accounts to post-launch operations.**

This repository is a set of [Claude Code](https://docs.claude.com/en/docs/claude-code) / Agent skills. Each skill is a focused, step-by-step procedure an agent can follow (and a human can read) for one part of the launch: accounts and tax, signing, subscriptions, listings, screenshots, privacy declarations, review readiness, release pipeline, console automation and post-launch operations.

The skills come from shipping a real subscription app as an indie developer. Examples lean toward Flutter, but almost everything applies to native iOS/Android, React Native or any other stack.

## Install

Copy the skill folders into a location your agent loads skills from:

```bash
# all projects (user level)
cp -r skills/* ~/.claude/skills/

# one project only
mkdir -p .claude/skills && cp -r skills/* .claude/skills/
```

Each skill is a folder with a `SKILL.md` (YAML frontmatter `name` + `description`, then the procedure) and optional `references/`, `scripts/` and `templates/`. The agent picks a skill when your request matches its description; you can also ask for one by name ("use the review-readiness skill").

Scripts are Node.js 18+ ES modules unless noted. They have no dependencies except where a `package.json` sits next to them (Playwright / Puppeteer for browser work).

## Skills

| Skill | Use it when |
|---|---|
| [launch-orchestrator](skills/launch-orchestrator/SKILL.md) | You want the whole launch sequenced, with checkpoints and approval gates |
| [accounts-and-tax](skills/accounts-and-tax/SKILL.md) | Opening Apple/Google developer accounts, reduced-fee programs, bank and tax forms, API keys and service accounts |
| [identity-and-signing](skills/identity-and-signing/SKILL.md) | Bundle/application IDs, capabilities, certificates and profiles, Play App Signing, universal links / App Links |
| [subscriptions-and-payments](skills/subscriptions-and-payments/SKILL.md) | Subscription products, trials, per-country prices, grace periods, RevenueCat, purchase testing, paywall states |
| [listing-and-aso](skills/listing-and-aso/SKILL.md) | Writing and validating names, subtitles, keywords and descriptions per locale and per store |
| [store-screenshots](skills/store-screenshots/SKILL.md) | Producing real-capture screenshots for every required device size and uploading them through the APIs |
| [privacy-and-declarations](skills/privacy-and-declarations/SKILL.md) | App Privacy labels, Play Data safety, privacy manifest, export compliance, age rating, account deletion, AI consent |
| [review-readiness](skills/review-readiness/SKILL.md) | Go/no-go before submitting, demo account, review notes, answering a rejection |
| [release-pipeline](skills/release-pipeline/SKILL.md) | CI builds, version numbers, TestFlight groups, Play testing tracks, staged rollout, remote kill switches |
| [console-automation](skills/console-automation/SKILL.md) | A console task has no API and you need to drive the web UI safely with Playwright |
| [post-launch-ops](skills/post-launch-ops/SKILL.md) | Alerts, crash reporting, AI cost guards, review monitoring and replies, capacity warnings |

Background reading: [docs/lessons.md](docs/lessons.md) collects anonymized incidents that shaped these skills.

## Principles

These rules run through every skill. They exist because each one was learned the expensive way.

1. **API first.** Create the App Store Connect API key and the Google Play service account on day one. Most of what follows (signing, metadata, screenshots, prices, TestFlight) becomes scriptable and repeatable. Use the browser only for what has no API, and then drive it with a script that verifies its own work.
2. **Verify before save.** Every automated change reads the form back and compares it with the intended values before pressing Save. On any mismatch it aborts. After saving, it reads the stored values again.
3. **Human approval gates.** An agent never triggers a release build, submits for review, publishes, changes prices, accepts agreements, or touches bank or tax data without explicit approval for that specific action. The skills mark these points with **APPROVAL**.
4. **Numbers must be real.** Screenshots, descriptions and paywalls show only what the shipped app really does and really outputs. Prices come from the store at runtime, never hardcoded. If a screenshot shows a feature the app does not have, either build the feature or change the screenshot.
5. **One source of truth.** Privacy answers, store forms, in-app wording and the privacy policy must describe the same data flows. Derive them from a code and SDK scan, not from memory.
6. **Store rules change.** Every requirement here carries a link to the official page. Check it before relying on a number, a size or a deadline.

## Scope and disclaimer

These skills describe practices, not legal, tax or financial advice. Store policies, fees, tax rules and limits change; the linked official documentation wins over anything written here. Placeholders such as `com.example.app`, `<TEAM_ID>` and `example.com` must be replaced with your own values.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Corrections with a link to the current official requirement are especially welcome.

## License

[MIT](LICENSE)
