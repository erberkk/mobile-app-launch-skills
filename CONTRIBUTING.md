# Contributing

Thanks for helping. The goal is a small set of accurate, practical skills, not an encyclopedia.

## What helps most

- **Corrections** when a store rule, size, fee or deadline changed. Include the link to the official page and the date you checked it.
- **Lessons** from a real launch that would have saved you a rejection, a lost day or a wrong price. Keep them anonymous.
- **Scripts** that remove a manual step, with a dry-run mode and a read-back check.

## Rules

1. One skill = one folder `skills/<name>/` with `SKILL.md`. Keep `SKILL.md` focused (roughly 150–400 lines). Put long material in `references/`.
2. Frontmatter needs `name` (matches the folder) and a `description` that says precisely **when** to use the skill.
3. Every requirement that can change links to the official Apple or Google page. Do not invent numbers; if a value is uncertain, say so and link the source.
4. Mark actions that need a human decision with **APPROVAL** (builds, submissions, publishing, prices, agreements, banking, tax).
5. No private data: no real app names, bundle IDs, team IDs, account IDs, emails, keys, domains or prices. Use `com.example.app`, `<TEAM_ID>`, `example.com`.
6. Plain, professional English. Short sentences. Use "the stores" or "App Store and Google Play" when a sentence applies to both.
7. Scripts: Node.js 18+ ES modules, no secrets in code (read them from environment variables or files outside the repo), a `DRY_RUN` default where the script writes anything.

## Pull requests

Describe what changed and why, and link the source for any factual change. Run a quick search for anything that looks like a real identifier before opening the PR.
