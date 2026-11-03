---
name: console-automation
description: Use when a task in App Store Connect, Google Play Console, RevenueCat, Google Cloud or another web console has no usable API and must be done through the browser - drives a dedicated, already logged-in Chrome profile with Playwright over CDP using a runner script and one small step file per action, with screenshots after each step, read-back safety gates before Save, no submit/publish clicks without approval, large file uploads via CDP DOM.setFileInputFiles, localized console UIs, session expiry handling, and strict scoping so other apps in the same account stay untouched.
---

# Console automation

## Purpose

Do console work that has no API reliably, repeatably and safely, with evidence of every change. The browser is the last resort: first check the App Store Connect API, the Google Play Developer API and the vendor's API.

## Prerequisites

- Node.js 18+, `npm i` in [scripts/](scripts/) (installs `playwright-core` only; it uses your installed Chrome).
- A **dedicated Chrome profile** used only for automation, signed in once by a human to each console (2FA done by the human).
- Knowledge of which apps in the account are in scope. Everything else is out of scope.

## Setup

1. Start Chrome with the profile and a local CDP port: `scripts/start-chrome.sh` (macOS/Linux/Git Bash) or `scripts/start-chrome.ps1` (Windows). It binds to `127.0.0.1` only. Do not use a port another local service already uses.
2. In that window, sign in to each console and open one tab per console.
3. Keep the profile directory private (it holds live sessions). Never commit it.

## The runner

[scripts/runner.mjs](scripts/runner.mjs) connects over CDP, picks the tab whose URL matches `--tab`, runs one or more step files in order, prints the URL and the step's result, and saves a screenshot after every step. It stops at the first error, failed gate or expired session. Disconnecting only detaches; Chrome stays open.

```bash
node runner.mjs --tab "play.google.com/console" steps/read-price-rows.mjs
TARGETS='{"Germany":"EUR 8.99"}' node runner.mjs --tab "play.google.com/console" steps/gated-save.mjs        # dry run
SAVE=1 TARGETS='{"Germany":"EUR 8.99"}' node runner.mjs --tab "play.google.com/console" steps/gated-save.mjs # after approval
```

A step file is small and does one thing:

```js
export default async (page, ctx) => {
  // navigate / read / act
  return "what happened";       // printed by the runner
};
```

Write a new step file per action (navigate, read, fill, gate+save, verify) instead of one long script. When something breaks you rerun only the failing step, and the screenshots show exactly where it stopped.

## Procedure for any change

1. **Read first.** A read-only step that extracts the current state as text (rows, field values). Save the output.
2. **Plan the diff.** Write the target values in env/JSON. Get **APPROVAL** for the change itself (prices, declarations, testers…).
3. **Fill** in a step that only fills, never saves.
4. **Gate**: read the form back from the DOM and compare with the targets; also check global sanity rules (no price below 1, row count unchanged, correct currency). Abort on any mismatch. See [scripts/steps/gated-save.mjs](scripts/steps/gated-save.mjs).
5. **Save** only with `SAVE=1`, and read any confirmation dialog text before confirming; stop if it mentions publish, submit or review.
6. **Verify**: reload and read back; compare with targets; keep the screenshot.
7. Log what changed, when, and the approval reference.

## Safety rules

- **Never click Submit, Publish, Send for review, Release, Start rollout, Delete, Revoke or Accept agreement** without a separate explicit approval for that click. Ideally leave those clicks to the human.
- **Scope**: assert the app name or package in the page header at the start of every write step; abort if it is not the app in scope. Shared accounts hold other apps; never touch them.
- **One write per step**, with a gate before it.
- **Exact labels, visible and enabled elements only.** Click buttons by exact accessible name and check `isVisible()`/`isEnabled()`. Menus: click items only inside the currently open menu container; a click after scrolling can land on another item.
- **No secrets in step files or output.** Do not print tokens, cookies or key contents; mask them.
- Some agent environments block certain actions (IAM grants, key revocation, form submission) by policy. Do not work around such blocks; hand the click to the human.

## Practical lessons

- **Localized UIs.** The console renders in the account's language. Labels, date formats and **decimal separators** differ: in a decimal-comma locale, typing `9.99` can become `999`. Read `document.documentElement.lang` and format numbers accordingly; keep labels per language in one map.
- **Default currency.** Price dialogs may default to the account's local currency; select and read back the currency explicitly.
- **Large uploads.** Playwright's `setInputFiles` over CDP streams the file through the protocol and fails for large files (tens of MB, e.g. AABs or videos). Use CDP `DOM.setFileInputFiles` with the path ([scripts/steps/upload-large-file.mjs](scripts/steps/upload-large-file.mjs)).
- **Downloads** (e.g. a key file shown once) are lost unless you call `Browser.setDownloadBehavior` with a secure download path before clicking.
- **Session expiry.** The runner stops when the tab lands on a sign-in page. A human signs in again in the automation window; do not automate passwords or 2FA.
- **Slow SPAs.** Prefer waiting for a specific element or text over fixed sleeps; when a fixed wait is unavoidable, keep it short and follow with a check.
- **Virtualized tables** render only visible rows. Scroll in steps and collect rows until the count stops growing, then gate on the full set.
- **Selectors drift.** Consoles change monthly. Prefer roles and visible text over CSS classes; keep selectors in one place per step. Example: App Store Connect's add-to-draft menu item reads "Draft Submission (1)" on one page and "Draft iOS Submission (1)" on another; match both.
- **Material checkboxes.** A forced click on the hidden `<input>` can look checked without updating the form, so Save does nothing. Click the visible checkbox by its bounding box, then read the state back.
- **Confirm dialogs after Save.** Account-wide settings (e.g. Play License testing) open a "save changes?" dialog; the change is lost unless the step confirms it. Always reload and read the value back after saving.
- **Guards that compare text** should match on a stable prefix or a regex, not on a truncated string; a too-strict guard aborts a correct run (harmless, but wastes a cycle).

## Decision points needing human approval

Every saving action (with the planned diff), every submit/publish/delete/revoke click, any change outside the in-scope app.

## Verification

- Each change has: read-before output, gate output, save result, read-after output, screenshot.
- A final read-only step confirms the console state equals the target.

## Common pitfalls

- A gate that checks only the rows you changed, missing a row broken by a mis-click elsewhere.
- Reusing a step written for one console language in another.
- Running write steps against the wrong tab (another app's page) — assert scope first.
- Leaving the automation profile signed in on a shared machine.
