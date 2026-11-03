# AI crawlers and llms.txt

Whether AI assistants and AI search features may read and cite your site is a decision for the owner (**APPROVAL**), not a default.

## Three kinds of bot

| Kind | What it does | Consideration |
|---|---|---|
| **Search / answer index** | Builds the index an assistant searches and cites | Blocking it keeps you out of that index |
| **User-initiated fetch** | Fetches a page because a user asked about it right now | Several providers say robots.txt may not apply to these |
| **Training** | Collects content that may train future models | Owner's choice |

Blocking training bots does not, by the providers' own documentation, remove you from their search features; those use separate tokens.

## User-agent tokens (verify before relying on them; names and roles change)

| Provider | Token | Kind | Official docs |
|---|---|---|---|
| OpenAI | `OAI-SearchBot` | Search | [OpenAI crawlers](https://developers.openai.com/api/docs/bots) |
| OpenAI | `ChatGPT-User` | User-initiated | same |
| OpenAI | `GPTBot` | Training | same |
| Anthropic | `Claude-SearchBot` | Search | [Anthropic crawlers](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) |
| Anthropic | `Claude-User` | User-initiated | same |
| Anthropic | `ClaudeBot` | Training | same |
| Perplexity | `PerplexityBot` | Search (not used for training, per docs) | [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers) |
| Perplexity | `Perplexity-User` | User-initiated (generally ignores robots.txt, per docs) | same |
| Google | `Googlebot` | Search | [Google crawlers](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) |
| Google | `Google-Extended` | Control token only (no separate crawler): Gemini training and grounding use. Does not affect Google Search | same |
| Apple | `Applebot` | Search (Spotlight, Siri, Safari) | [About Applebot](https://support.apple.com/en-us/119829) |
| Apple | `Applebot-Extended` | Control token only: Apple foundation-model training | same |
| Microsoft | `Bingbot` | Search (also feeds Copilot answers) | [Bing Webmaster](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b) |
| Common Crawl | `CCBot` | Open dataset widely used for training | [CCBot](https://commoncrawl.org/ccbot) |

robots.txt syntax: [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309). A bot obeys the most specific `User-agent` group that matches it, so a named group replaces (does not add to) the `*` group: repeat any `Disallow` lines you need inside it.

## Patterns

**Open (all allowed)** — see [templates/robots.txt](../templates/robots.txt).

**Search yes, training no:**

```text
User-agent: *
Allow: /

User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
User-agent: CCBot
Disallow: /

Sitemap: https://example.com/sitemap.xml
```

Things robots.txt does not do: keep a page out of the index (use `noindex`), protect private data (use auth), or bind a bot that chooses to ignore it. Pages with tokens in the URL (feedback links, invite codes) get `noindex` + `Referrer-Policy: no-referrer`, and stay crawlable so the `noindex` is seen.

## llms.txt

A proposed convention ([llmstxt.org](https://llmstxt.org/)): a Markdown file at `/llms.txt` with an H1 name, a one-paragraph `>` summary, then sections of links. No major search or assistant provider has committed to using it, and there is no evidence it changes rankings. It is cheap, so a short one is reasonable:

- Under ~30 lines; facts that are true in the shipped app (feature names as the app shows them, languages, platforms, privacy stance, "not medical/financial advice" if relevant).
- **No prices** (they vary by country and go stale); link the pricing section instead.
- Links to home, pricing, FAQ, privacy, terms, support, account deletion.
- Update it in the same change that updates the landing page or the store listing.

Template: [templates/llms.example.txt](../templates/llms.example.txt).

## Measuring without trackers (consider)

- Monthly, ask a fixed set of 5–10 questions in several assistants and note whether the app is named and which page is cited.
- Count assistant referrers (`chatgpt.com`, `perplexity.ai`, and so on) in server/edge logs, which needs no client script.
- Search Console and Bing Webmaster show queries and clicks without anything on the page.
