// Minimal Cloudflare Worker for an app website, using Workers Static Assets.
//
// wrangler.jsonc (pin account and routes so a deploy can never hit another project on a shared account):
// {
//   "name": "example-site",
//   "account_id": "<ACCOUNT_ID>",
//   "main": "worker/index.js",
//   "compatibility_date": "2026-01-01",
//   "workers_dev": false,
//   "assets": {
//     "directory": "./dist", "binding": "ASSETS", "run_worker_first": true,
//     "html_handling": "drop-trailing-slash",   // /privacy/index.html is served at /privacy; /privacy/ redirects there
//     "not_found_handling": "404-page"           // unknown paths get dist/404.html with status 404
//   },
//   "routes": [
//     { "pattern": "example.com", "custom_domain": true },
//     { "pattern": "www.example.com", "custom_domain": true }
//   ]
// }
//
// What it does:
// - www -> apex and http -> https redirects for pages, never for /.well-known/ (app links must not redirect)
// - serves apple-app-site-association and assetlinks.json as application/json, 200, short cache
// - /i/<code> invite pages: validated code, store links (Play install referrer), noindex, no-store
// - fills per-country price placeholders (%%PRICE_MONTHLY%% ...) from one table, by request.cf.country
// - security headers; noindex on any host that is not the production one
//
// Storage alternative: content-addressed KV. Replace `asset()` with a lookup in a generated
// manifest (path -> { hash, type }) and env.SITE.get(hash, "arrayBuffer"); upload KV before deploying.

const APEX = "example.com";
const HOSTS = new Set([APEX, `www.${APEX}`]); // every host listed in the app's associated domains

// Store URLs: fill in after the listings exist. Same IDs as the app's own config.
const IOS_URL = "https://apps.apple.com/app/id0000000000";
const PLAY_URL = "https://play.google.com/store/apps/details?id=com.example.app";

// Invite codes: same alphabet and length as the backend that issues them (here: 7 chars, no 0/O/1/I/L).
const INVITE_RE = /^\/i\/([2-9A-HJKMNP-Z]{7})$/i;

// ---- Prices -----------------------------------------------------------------------------------
// GENERATED from the store read-back (subscriptions-and-payments), never typed by hand.
// Keys are ISO 3166 country codes; "*" is the fallback for countries not in the table.
// The fallback says the store shows the exact price, because it may not be in the visitor's currency.
export const PRICES = {
  US: { currency: "USD", monthly: "0.00", yearly: "0.00" },
  DE: { currency: "EUR", monthly: "0.00", yearly: "0.00" },
  "*": { currency: "USD", monthly: "0.00", yearly: "0.00", approximate: true },
};
// Pages whose HTML contains price placeholders.
const PRICED_PAGES = new Set(["/", "/de"]);

export const priceFor = (country) => PRICES[String(country || "").toUpperCase()] || PRICES["*"];

// The note is in the page language; the currency follows the visitor's country.
const PRICE_NOTES = {
  en: {
    exact: "Prices for your country. The store shows the final price.",
    approximate: "Shown in US dollars as a guide. The App Store and Google Play show the exact price in your currency.",
  },
  de: {
    exact: "Preise für dein Land. Der Store zeigt den endgültigen Preis.",
    approximate: "Zur Orientierung in US-Dollar. App Store und Google Play zeigen den genauen Preis in deiner Währung.",
  },
};

export function fillPrices(html, lang, country) {
  const p = priceFor(country);
  const fmt = (amount) => new Intl.NumberFormat(lang, { style: "currency", currency: p.currency }).format(Number(amount));
  const notes = PRICE_NOTES[lang] || PRICE_NOTES.en;
  const note = p.approximate ? notes.approximate : notes.exact;
  return html
    .replaceAll("%%PRICE_MONTHLY%%", fmt(p.monthly))
    .replaceAll("%%PRICE_YEARLY%%", fmt(p.yearly))
    .replaceAll("%%PRICE_NOTE%%", note);
}

// ---- Headers ----------------------------------------------------------------------------------
const SECURITY = {
  "Content-Security-Policy": "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), browsing-topics=()",
  "X-Frame-Options": "DENY",
};

const WELL_KNOWN_JSON = new Set(["/.well-known/apple-app-site-association", "/.well-known/assetlinks.json"]);

const withHeaders = (res, extra = {}, status = res.status) => {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...SECURITY, ...extra })) headers.set(k, v);
  return new Response(res.body, { status, headers });
};

const redirect = (to) => new Response(null, { status: 301, headers: { Location: to, ...SECURITY } });

async function asset(env, request, path) {
  const url = new URL(request.url);
  url.pathname = path;
  return env.ASSETS.fetch(new Request(url, { method: "GET", headers: request.headers }));
}

// Picks a page language from ?lang= or Accept-Language among the languages you have templates for.
export function pickLang(param, acceptLanguage, supported = ["en", "de"]) {
  const p = String(param || "").toLowerCase();
  if (supported.includes(p)) return p;
  for (const part of String(acceptLanguage || "").split(",")) {
    const tag = part.trim().split(";")[0].toLowerCase().split("-")[0];
    if (supported.includes(tag)) return tag;
  }
  return supported[0];
}

export const playInviteUrl = (code) =>
  // "&" is escaped because the URL is written into an href attribute.
  `${PLAY_URL}&amp;referrer=${encodeURIComponent(`invite=${code}`)}`;

async function invitePage(request, env, code) {
  const url = new URL(request.url);
  const lang = pickLang(url.searchParams.get("lang"), request.headers.get("Accept-Language"));
  // Templates are built into dist/_tpl/ and never served as pages themselves.
  const tpl = await asset(env, request, `/_tpl/invite.${lang}.html`);
  if (!tpl.ok) return new Response("Temporarily unavailable", { status: 503, headers: { "Retry-After": "30", ...SECURITY } });
  const c = code.toUpperCase(); // the only value from the URL that reaches the HTML, and only after the regex
  const html = (await tpl.text())
    .replaceAll("%%CODE%%", c)
    .replaceAll("%%IOS%%", IOS_URL)
    .replaceAll("%%PLAY%%", playInviteUrl(c));
  return new Response(request.method === "HEAD" ? null : html, {
    status: 200,
    headers: {
      ...SECURITY,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      Vary: "Accept-Language",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD", ...SECURITY } });
    }

    // App-link files: same response on every claimed host, no redirect of any kind.
    if (WELL_KNOWN_JSON.has(path)) {
      const res = await asset(env, request, path);
      if (!res.ok) return withHeaders(res);
      return withHeaders(res, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" });
    }

    // Canonical host and scheme for everything else.
    if (HOSTS.has(url.hostname) && (url.hostname !== APEX || url.protocol === "http:")) {
      url.hostname = APEX;
      url.protocol = "https:";
      return redirect(url.toString());
    }
    // Clean URLs (/privacy/ -> /privacy) are handled by html_handling in the assets config.

    // Page templates are filled by their own route and never served as they are.
    if (path.startsWith("/_tpl/")) return withHeaders(await asset(env, request, "/__not_found__"), { "Cache-Control": "no-store" }, 404);

    const invite = path.match(INVITE_RE);
    if (invite) return invitePage(request, env, invite[1]);

    const res = await asset(env, request, path);
    const extra = {};
    if (url.hostname !== APEX) extra["X-Robots-Tag"] = "noindex"; // previews, workers.dev, staging

    if (res.ok && PRICED_PAGES.has(path)) {
      const country = request.cf && request.cf.country;
      const lang = path === "/de" ? "de" : "en";
      const html = fillPrices(await res.text(), lang, country);
      // The body differs per country: keep it out of shared caches.
      Object.assign(extra, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-cache" });
      const headers = new Headers(res.headers);
      headers.delete("Content-Length");
      headers.delete("ETag");
      for (const [k, v] of Object.entries({ ...SECURITY, ...extra })) headers.set(k, v);
      return new Response(request.method === "HEAD" ? null : html, { status: 200, headers });
    }
    return withHeaders(res, extra);
  },
};
