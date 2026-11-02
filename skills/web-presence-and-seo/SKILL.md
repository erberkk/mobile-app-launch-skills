---
name: web-presence-and-seo
description: Use when building, checking or deploying the website that a mobile app needs for its store listings and launch - privacy policy, terms, support and web account-deletion pages that work signed-out; hosting apple-app-site-association and assetlinks.json; invite/referral pages (/i/<code>) that open the app or fall back to the store with the Play install referrer; a landing page with store badges and honest per-country prices filled at the edge; Open Graph images; technical SEO (hreflang, canonical, sitemap, robots.txt, JSON-LD); Search Console, Bing Webmaster and IndexNow; AI crawler policy and llms.txt; and a Cloudflare Worker deploy with a production approval gate. Includes a site checker and an IndexNow ping script.
---

# Web presence and SEO

## Purpose

Both stores ask for URLs before they let you submit: privacy policy, support, account deletion, and for app links the `.well-known` files. This skill builds a small, fast, static site that satisfies those forms first, then makes it findable (search engines, link previews, AI assistants) without trackers, dark patterns or numbers the app cannot back up.

Do this **before** the store listing and privacy forms (`listing-and-aso`, `privacy-and-declarations`): they need live URLs.

## Prerequisites

- A domain you control, with DNS access (Cloudflare is used in the examples; any host works if it can set headers and serve files without redirects).
- The app's final identifiers and signing data from `identity-and-signing` (Team ID, bundle ID, package name, Play **app signing** SHA-256).
- The privacy policy text derived from the code/SDK scan (`privacy-and-declarations`) and the deletion flow that really exists in the app.
- Prices read back from the stores (`subscriptions-and-payments`), never typed from memory.
- Node.js 18+ for the scripts in [scripts/](scripts/).

## 1. Pages the stores require

Checklist with every store field → URL: [references/store-url-checklist.md](references/store-url-checklist.md).

| Page | Path (suggested) | Rules |
|---|---|---|
| Privacy policy | `/privacy` | Public, no login, no geo-blocking, HTML (not PDF), names the app, matches the store privacy answers |
| Terms | `/terms` | Needed if you sell subscriptions (Apple's standard EULA or your own; link it in the app and the listing) |
| Support / contact | `/support` | A real way to reach you (email or form), not just an FAQ |
| Account deletion (web) | `/delete-account` | Google Play requires this URL. Names the app as on the listing, lets the user **request** deletion from the page itself, says what is deleted, what is kept and for how long, and that a store subscription must be cancelled separately |

- Apple requires deletion to **start inside the app** (guideline 5.1.1(v)); a web page does not replace that. Play requires both the in-app path and the web URL. Docs: [Apple account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion), [Play account deletion](https://support.google.com/googleplay/android-developer/answer/13327111), [Play privacy policy URL rules](https://support.google.com/googleplay/android-developer/answer/9859455).
- **Signed-out and stable.** No cookie wall, no login, no JavaScript needed to read the text. Do not rename paths after submission; if you must, keep a 301 from the old path.
- **Per language.** One URL per language (`/privacy`, `/de/privacy`) with `hreflang`; App Store Connect lets you set a privacy URL per localization. If a page is not translated, link the default-language page rather than a 404.
- Show the "last updated" date on legal pages and keep old versions in version control.

## 2. App links hosting

Templates for the files themselves are in `identity-and-signing/templates/`. This section is about serving them.

- `https://<domain>/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`: HTTP **200**, `Content-Type: application/json`, **no redirect** (not http→https, not apex→www, not trailing slash), no auth, no bot challenge page.
- Decide apex vs `www` once. Serve the files on every host listed in the entitlements / intent filters; redirect the other host for pages only, never for `/.well-known/`.
- Static hosts often serve the extensionless AASA as `application/octet-stream`. Route `/.well-known/*` through the Worker (see the template) or set the header explicitly, then check with `scripts/check-site.mjs`.
- Deploy the `.well-known` files **before** the app build that claims the domain. Apple fetches AASA through its CDN, so changes can take a while to show.

### Invite / referral pages (`/i/<code>`)

- The Worker validates the code against the exact alphabet and length the backend issues, then fills a template. Nothing else from the URL reaches the HTML.
- If the app is installed, universal links / App Links open it directly (the path must be in the AASA `components` and the Android intent filter). If not, the page shows both store buttons and a "copy code" button as the manual fallback.
- Android: append the code to the Play URL as `&referrer=<url-encoded key=value>` and read it in the app with the [Play Install Referrer API](https://developer.android.com/google/play/installreferrer). iOS has no install referrer; ask the user to paste the code, or prefill it from the clipboard **only** after an explicit tap.
- Headers: `X-Robots-Tag: noindex`, `Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`. Keep `/i/` out of the sitemap. Do not `Disallow` it in robots.txt: a crawler that cannot fetch the page never sees the `noindex`.

## 3. Landing page

- **Same visual language as the store screenshots** (colours, type, the same real UI cards). A visitor arriving from the site should recognise the store page.
- **Store badges** only in the official artwork, unmodified, with the required spacing and wording; link straight to the listing. Rules: [Apple marketing guidelines](https://developer.apple.com/app-store/marketing/guidelines/), [Google Play badges](https://partnermarketinghub.withgoogle.com/brands/google-play/).
- **Before launch**: one line "Coming soon to the App Store and Google Play", not three disabled badges. **At launch** (after the release is live): swap in real badge links, add the Smart App Banner meta ([docs](https://developer.apple.com/documentation/webkit/promoting-apps-with-smart-app-banners)), update `llms.txt` and the JSON-LD. Keep this as a single config flag so it is one change. **APPROVAL** before switching.
- **Honest prices.** Prices come from one file generated from the store read-back. Pages contain placeholders (`%%PRICE_MONTHLY%%`); the Worker fills them by the visitor's country (`request.cf.country`) and says "the store shows the exact price in your currency" for countries outside the table. The page language never decides the currency. No crossed-out "was" prices, no fake countdowns, no pre-ticked anything.
- **Fast and accessible.** Text in HTML (not rendered by JS), one CSS file, little or no JS, self-hosted fonts with `font-display: swap`, hero image sized and `fetchpriority="high"`. Targets: LCP < 2.5 s, CLS < 0.1, INP < 200 ms ([Web Vitals](https://web.dev/articles/vitals)). Contrast and focus states per [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/); `prefers-reduced-motion` respected.
- **Analytics.** Prefer none or server-side/cookieless counts (edge logs, privacy-friendly analytics without identifiers). If you set no cookies and load no third-party scripts, you need no cookie banner; do not show one "just in case". If you add any tracker, the consent banner, privacy policy and store privacy answers must all change together.

## 4. Social share images

- One Open Graph image per language: **1200×630** PNG/JPG, under ~1 MB, text large enough to read at thumbnail size. Absolute `https://` URLs in `og:image` and `twitter:image`, plus `og:image:width/height/alt`, `og:title`, `og:description`, `og:url`, `twitter:card=summary_large_image`. Spec: [ogp.me](https://ogp.me/), [Meta sharing guide](https://developers.facebook.com/docs/sharing/webmasters/).
- Messaging apps cache previews aggressively. After changing an image, give it a **new file name** (or `?v=2`), then re-scrape in the [Sharing Debugger](https://developers.facebook.com/tools/debug/) ("Scrape Again"). WhatsApp and other messengers keep their own caches with no public refresh tool, so a new image URL is the reliable fix; test by sending the link in a new chat.

## 5. Technical SEO

- **Title** (≈50–60 chars, brand + what it does) and **meta description** (≈150–160 chars) unique per page and language. [Title links](https://developers.google.com/search/docs/appearance/title-link), [snippets](https://developers.google.com/search/docs/appearance/snippet).
- **hreflang**: every language version lists all versions **including itself**, plus `x-default`; pairs must be reciprocal. [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions).
- **Canonical**: self-referencing, absolute, on the final (non-redirecting) URL. [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).
- **Sitemap** with only 200, indexable, canonical URLs and a real `<lastmod>` (date the content changed, e.g. from git, not the build time). [Template](templates/sitemap.example.xml), [docs](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- **robots.txt**: [template](templates/robots.txt), [intro](https://developers.google.com/search/docs/crawling-indexing/robots/intro). robots.txt controls crawling, not indexing; use `noindex` for pages that must stay out of results.
- **Structured data** (JSON-LD): Organization, WebSite, MobileApplication; FAQPage only for a FAQ visible on the page. Examples and rules: [references/structured-data.md](references/structured-data.md).
- Non-production hosts (preview, `*.workers.dev`) send `X-Robots-Tag: noindex`.

## 6. Discovery

1. **Google Search Console**: add a *Domain* property, add the `google-site-verification` **TXT** record at the apex, verify, submit the sitemap, request indexing for the home pages. [Verify ownership](https://support.google.com/webmasters/answer/9008080).
2. **Bing Webmaster Tools**: import from Search Console, or verify with the DNS record Bing gives (a CNAME), then submit the sitemap. [Add and verify](https://www.bing.com/webmasters/help/add-and-verify-site-12184f8b).
3. **IndexNow** (Bing, Yandex, Seznam, Naver and others; not Google): host `/<key>.txt` containing the key, deploy, then run `node scripts/indexnow-ping.mjs` (dry run) and `--send`. The script checks the key file is live first. [Protocol](https://www.indexnow.org/documentation).
4. **AI crawlers and llms.txt**: decide per bot whether to allow search/answer bots and training bots (owner's decision, **APPROVAL**). Bot list, purposes and official links: [references/ai-crawlers.md](references/ai-crawlers.md). Add a short [llms.txt](templates/llms.example.txt) with the product summary and key URLs, no prices.

DNS records are shared infrastructure: add the new record; never edit or delete existing TXT/SPF/MX records. **APPROVAL** before any DNS change.

## 7. Deploy (Cloudflare Worker example)

Template: [templates/worker.example.js](templates/worker.example.js). It serves `.well-known` files with the right type and no redirect, fills per-country price placeholders, renders `/i/<code>`, adds security headers and noindex on non-production hosts.

Two storage options:
- **Workers Static Assets** (simplest): `"assets": { "directory": "./dist", "binding": "ASSETS", "run_worker_first": true }` in `wrangler.jsonc`; the Worker calls `env.ASSETS.fetch()`. [Docs](https://developers.cloudflare.com/workers/static-assets/).
- **KV** (content-addressed): the build writes files under their hash and a `manifest.js` (path → hash, type); upload with `wrangler kv bulk put` **before** deploying the Worker, so the new manifest never points at a missing file. [KV commands](https://developers.cloudflare.com/workers/wrangler/commands/kv/).

Steps:
1. `node build.mjs` → `dist/` (fails on any missing translation key or unfilled placeholder other than the price ones).
2. Unit tests (`node --test`): run the Worker's `fetch` against stub assets. Cover: AASA/assetlinks 200 + `application/json` + no redirect; `www`/`http` redirect for pages only; `/i/<bad>` → 404, `/i/<good>` → noindex + no-store; every price region fills every placeholder (no `%%` left); malformed percent-encoding → 404, not 500.
3. Preview: `npx wrangler deploy --dry-run`, or deploy to a preview host and run `node scripts/check-site.mjs https://<preview-host>`.
4. **APPROVAL** — production deploy (`npx wrangler deploy`). Pin `account_id`, `name` and routes in `wrangler.jsonc` so the command cannot target another project on a shared account.
5. After deploy: `node scripts/check-site.mjs https://example.com --invite <sample code>`, then the IndexNow ping.

## Decision points needing human approval

- Production deploys and DNS changes.
- Wording of legal pages (privacy, terms, deletion); the owner signs off on any change.
- AI training crawlers allow/deny.
- The "coming soon" → "download" switch and any price shown on the site.
- Adding analytics, a waitlist form or anything that collects personal data.

## Verification

- `node scripts/check-site.mjs https://example.com --paths /privacy,/terms,/support,/delete-account` exits 0: required pages 200 signed-out, AASA/assetlinks JSON without redirect, OG tags with reachable absolute images, reciprocal hreflang, sitemap URLs all 200.
- Every URL in the store-url checklist opens in a private window on a phone.
- [Rich Results Test](https://search.google.com/test/rich-results) and [Schema Markup Validator](https://validator.schema.org/) show no errors; [PageSpeed Insights](https://pagespeed.web.dev/) mobile LCP < 2.5 s.
- Search Console: sitemap "Success"; Bing: IndexNow submissions visible.

## Common pitfalls

- Privacy URL that redirects to a login, a PDF, or a generic company policy that never names the app.
- Deletion page that only says "delete in the app" (Play wants a request path on the page) or forgets to mention cancelling the store subscription.
- AASA served via apex→www redirect, as `text/html`, or behind a bot challenge.
- `Disallow: /i/` in robots.txt together with a `noindex` header that crawlers then never see.
- Prices hardcoded per language (EUR on the German page for a visitor in Switzerland) or left as stale numbers after a store price change.
- `aggregateRating` invented for a new app, or `offers` with a price that is only true in one country.
- OG image updated but previews still old: change the file name, then re-scrape.
- `lastmod` set to the build time on every deploy; search engines learn to ignore it.
