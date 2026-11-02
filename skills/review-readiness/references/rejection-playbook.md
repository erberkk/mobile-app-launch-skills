# Rejection playbook

## 1. Read precisely

- Note the guideline number(s), the device and OS the reviewer used, and any attached screenshot or video.
- Open the current text of that guideline: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) or the Play policy linked in the email / Policy status page.
- Rejections often list several issues; each needs its own answer.

## 2. Reproduce

- Same device class (iPad if they used iPad), clean install, fresh store account, the demo account from your notes.
- Check backend logs for the reviewer's session at the review time: failed sign-ins, 4xx/5xx on purchase validation, rate limits.
- Expect more than one layer (account state, backend, metadata).

## 3. Decide: fix, clarify or appeal

| Situation | Action |
|---|---|
| Real bug or missing requirement | Fix, new build if needed, reply with what changed, resubmit |
| Reviewer could not find a feature / sign in | Improve notes (exact paths), fix the account, reply, resubmit (often no new build) |
| Metadata issue | Edit metadata, reply, resubmit; no new build |
| Reviewer misread a verifiable fact (e.g. thinks content is user-generated when it is not) | Reply with evidence first; appeal only if the reply does not resolve it |
| Policy disagreement | Appeal via the App Review Board (Apple) or the Play policy appeal form, with a calm, factual explanation |

## 4. Reply in Resolution Center (App Store) — template

```
Hello,

Thank you for the feedback on guideline <x.y.z>.

What we found: <one or two sentences, factual>.
What we changed: <list; build number if new>.
How to verify: <exact steps, account to use, where to look>.

<Optional: a short screen recording link showing the flow.>

Kind regards,
<name>
```

Rules: no blame, no long explanations, no promises you will not keep. Answer every point. Attach a short video if a flow is hard to find.

## 5. Google Play

- Policy rejections arrive in Policy status / Inbox with the policy name. Fix and submit a new release or update the declaration; use the appeal form only for a misunderstanding.
- Repeated policy violations affect the account; do not resubmit unchanged.

## 6. After approval

Write the incident into your lessons file: what was rejected, root cause, how it was caught, and the checklist line that now prevents it.
