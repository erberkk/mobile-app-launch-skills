# Structured data (JSON-LD) for an app website

Put one `<script type="application/ld+json">` block per page, generated at build time from the same source as the visible text. It is a data block, not executable script, so a strict CSP (`script-src 'self'`) does not block it. Escape `<` as `<` when serialising.

Rules that matter more than any property list:

- **Mark up only what the page shows.** A FAQ in JSON-LD must be the FAQ visible on that page, in that page's language.
- **No invented ratings.** `aggregateRating` and `review` must come from real, visible ratings that you collected. A new app has none; leave them out. Google's [structured data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) treat fake or self-serving reviews as spam.
- **`offers` only if accurate for everyone.** Store prices differ by country. A single `price` with one currency is wrong for most visitors. Use `"price": "0"` only if the app really is free to download, and describe the subscription in text.
- **Store links only after launch.** Add `downloadUrl` / `installUrl` / `sameAs` with the store URLs once the listings are live.
- Rich results are not guaranteed. Google's [software app](https://developers.google.com/search/docs/appearance/structured-data/software-app) rich result needs a rating or review, which a pre-launch app cannot honestly have; Google removed the FAQ rich result from Search in 2026 ([Search Central updates](https://developers.google.com/search/updates)). The markup is still useful as clean, machine-readable facts for search and AI systems, so keep it small and correct rather than chasing a result type.

Validate with the [Rich Results Test](https://search.google.com/test/rich-results) and the [Schema Markup Validator](https://validator.schema.org/). Vocabulary: [schema.org/MobileApplication](https://schema.org/MobileApplication), [Organization](https://developers.google.com/search/docs/appearance/structured-data/organization).

## Home page (one graph)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://example.com/#org",
      "name": "Example",
      "url": "https://example.com/",
      "logo": "https://example.com/assets/logo-512.png",
      "email": "support@example.com"
    },
    {
      "@type": "WebSite",
      "@id": "https://example.com/#site",
      "url": "https://example.com/",
      "name": "Example",
      "inLanguage": "en",
      "publisher": { "@id": "https://example.com/#org" }
    },
    {
      "@type": "MobileApplication",
      "@id": "https://example.com/#app",
      "name": "Example",
      "url": "https://example.com/",
      "description": "One sentence that matches the store short description.",
      "operatingSystem": "iOS, Android",
      "applicationCategory": "HealthApplication",
      "inLanguage": "en",
      "publisher": { "@id": "https://example.com/#org" },
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD",
        "description": "Free to download. Optional subscription; prices vary by country and are shown in the store."
      }
    }
  ]
}
```

- `applicationCategory`: a schema.org value such as `HealthApplication`, `LifestyleApplication`, `FinanceApplication`, `EducationalApplication`, `GameApplication`, `UtilitiesApplication`.
- Leave `offers` out entirely if the app is not free to download.
- The localized page (`/de`) carries the same graph with its own `url`, `inLanguage` and description. Keep `@id`s stable across languages.

### After launch, add to the MobileApplication node

```json
"downloadUrl": "https://apps.apple.com/app/id0000000000",
"installUrl": "https://play.google.com/store/apps/details?id=com.example.app",
"sameAs": [
  "https://apps.apple.com/app/id0000000000",
  "https://play.google.com/store/apps/details?id=com.example.app"
]
```

## FAQ (only for a visible FAQ)

```json
{
  "@type": "FAQPage",
  "@id": "https://example.com/#faq",
  "inLanguage": "en",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I need an account?",
      "acceptedAnswer": { "@type": "Answer", "text": "No. You can start without one. An account adds backup across devices." }
    }
  ]
}
```

Generate `mainEntity` from the same data file that renders the visible FAQ so the two cannot drift. If an answer contains a price placeholder that the Worker fills per country, the JSON-LD answer gets filled too; never write a fixed number there.

## Legal and help pages

A plain `WebPage` (or nothing) is enough:

```json
{ "@context": "https://schema.org", "@type": "WebPage", "name": "Privacy policy", "url": "https://example.com/privacy", "inLanguage": "en", "dateModified": "2026-01-15", "isPartOf": { "@id": "https://example.com/#site" } }
```

## Articles (if you publish guides)

`Article` with a real `author` (Person or Organization), `datePublished` and `dateModified`. Health, money and legal topics need named, qualified authors or sources; do not claim expert review that did not happen.
