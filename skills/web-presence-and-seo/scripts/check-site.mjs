#!/usr/bin/env node
// Checks an app website the way the stores, the OS and link-preview scrapers see it: signed-out, no cookies.
//
//   node check-site.mjs https://example.com
//   node check-site.mjs https://example.com --paths /privacy,/terms,/support,/delete-account,/de/privacy
//   node check-site.mjs https://example.com --invite ABCD234 --app-links --max 100
//
// Checks:
//   - required pages: HTTP 200 (one same-host redirect is a warning), HTML, no login form, no noindex, no unfilled %%placeholders%%
//   - /.well-known/apple-app-site-association and assetlinks.json: 200 with NO redirect, application/json, valid shape
//     (a 404 is a warning unless --app-links says the app uses them)
//   - robots.txt and sitemap: reachable, every sitemap URL 200 without redirect and indexable
//   - every page: title, meta description, absolute canonical, Open Graph + Twitter tags, og:image reachable (1200x630 suggested)
//   - hreflang: self-reference present, x-default present, every pair reciprocal
//   - --invite <CODE>: /i/<CODE> answers 200 with noindex and no-store
// Exit code 1 if any ERROR. Node 18+, no dependencies.

const args = process.argv.slice(2);
const base = args[0] && !args[0].startsWith("--") ? new URL(args[0]) : null;
if (!base) {
  console.error("usage: node check-site.mjs <https://host> [--paths /a,/b] [--invite CODE] [--app-links] [--max N]");
  process.exit(2);
}
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const origin = base.origin;
const requiredPaths = (opt("paths") || "/,/privacy,/terms,/support,/delete-account").split(",").map((p) => p.trim()).filter(Boolean);
const maxPages = Number(opt("max") || 50);
const appLinksRequired = args.includes("--app-links");
const UA = "Mozilla/5.0 (compatible; check-site/1.0)";

let errors = 0, warnings = 0;
const err = (where, msg) => { errors++; console.log(`ERROR ${where}: ${msg}`); };
const warn = (where, msg) => { warnings++; console.log(`warn  ${where}: ${msg}`); };
const ok = (where, msg = "") => console.log(`ok    ${where}${msg ? ` ${msg}` : ""}`);

// ---- fetch helpers ------------------------------------------------------------------------------
const cache = new Map();
async function get(url) {
  const key = String(url);
  if (cache.has(key)) return cache.get(key);
  const p = (async () => {
    try {
      const res = await fetch(key, { redirect: "manual", headers: { "User-Agent": UA, "Accept-Language": "en" } });
      const buf = Buffer.from(await res.arrayBuffer());
      return { url: key, status: res.status, headers: res.headers, buf, text: buf.toString("utf8") };
    } catch (e) {
      return { url: key, status: 0, headers: new Headers(), buf: Buffer.alloc(0), text: "", error: e.message };
    }
  })();
  cache.set(key, p);
  return p;
}
// Follows at most one redirect, and only on the same host.
async function getPage(url) {
  let r = await get(url);
  if (r.status >= 300 && r.status < 400) {
    const loc = r.headers.get("location");
    const next = loc && new URL(loc, url);
    if (!next || next.host !== new URL(url).host) return { ...r, redirectedTo: next && next.href, offHost: true };
    const r2 = await get(next.href);
    return { ...r2, redirectedFrom: url };
  }
  return r;
}

// ---- tiny HTML head parser ------------------------------------------------------------------------
const attrs = (tag) => {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  return out;
};
function parseHead(html) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const meta = (k) => metas.find((a) => (a.property || a.name || "").toLowerCase() === k)?.content;
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].trim();
  const canonical = links.find((a) => (a.rel || "").toLowerCase() === "canonical")?.href;
  const alternates = links.filter((a) => (a.rel || "").toLowerCase() === "alternate" && a.hreflang).map((a) => ({ lang: a.hreflang.toLowerCase(), href: a.href }));
  return { title, canonical, alternates, meta };
}
const abs = (u, from) => { try { return new URL(u, from).href; } catch { return null; } };
const isNoindex = (r, head) => /noindex/i.test(r.headers.get("x-robots-tag") || "") || /noindex/i.test(head.meta("robots") || "");

function imageSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + len;
    }
  }
  return null;
}

// ---- page checks ------------------------------------------------------------------------------
const pages = new Map(); // final url -> { head }
const checkedImages = new Set();

async function checkPage(url, { required = false } = {}) {
  const where = new URL(url).pathname || "/";
  const before = errors;
  const r = await getPage(url);
  if (r.error) return err(where, `request failed: ${r.error}`);
  if (r.offHost) return err(where, `redirects to another host (${r.redirectedTo})`);
  if (r.redirectedFrom) (required ? warn : err)(where, `redirects to ${new URL(r.url).pathname}; use the final URL in store forms and the sitemap`);
  if (r.status !== 200) return err(where, `status ${r.status}`);
  const ctype = r.headers.get("content-type") || "";
  if (!/text\/html/i.test(ctype)) return err(where, `content-type ${ctype || "none"} (expected text/html)`);
  if (r.headers.get("set-cookie")) warn(where, "sets a cookie; if the site claims no cookies, fix it, otherwise disclose it");
  if (/<input\b[^>]*type\s*=\s*["']?password/i.test(r.text)) err(where, "contains a password field; store URLs must work signed-out");
  const leftovers = r.text.match(/%%[A-Z0-9_]+%%/g);
  if (leftovers) err(where, `unfilled placeholders: ${[...new Set(leftovers)].join(", ")}`);

  const head = parseHead(r.text);
  pages.set(r.url, { head, where });
  if (isNoindex(r, head)) (required ? err : warn)(where, "noindex");
  if (!head.title) err(where, "missing <title>");
  else if ([...head.title].length > 65) warn(where, `title ${[...head.title].length} chars (aim for ~50-60)`);
  const desc = head.meta("description");
  if (!desc) warn(where, "missing meta description");
  else if ([...desc].length > 170) warn(where, `meta description ${[...desc].length} chars (aim for ~150-160)`);
  if (!head.canonical) warn(where, "missing canonical");
  else if (!/^https:\/\//.test(head.canonical)) err(where, `canonical must be absolute https: ${head.canonical}`);
  else if (abs(head.canonical) !== r.url) warn(where, `canonical points elsewhere: ${head.canonical}`);

  for (const k of ["og:title", "og:description", "og:url", "og:image", "twitter:card"]) if (!head.meta(k)) warn(where, `missing ${k}`);
  const img = head.meta("og:image");
  if (img) {
    if (!/^https:\/\//.test(img)) err(where, `og:image must be an absolute https URL: ${img}`);
    else if (!checkedImages.has(img)) {
      checkedImages.add(img);
      const ir = await getPage(img);
      const it = ir.headers.get("content-type") || "";
      if (ir.status !== 200) err(where, `og:image ${img} status ${ir.status}`);
      else if (!it.startsWith("image/")) err(where, `og:image content-type ${it}`);
      else {
        const size = imageSize(ir.buf);
        if (size && (size[0] !== 1200 || size[1] !== 630)) warn(where, `og:image is ${size[0]}x${size[1]} (1200x630 recommended)`);
        if (ir.buf.length > 1024 * 1024) warn(where, `og:image is ${(ir.buf.length / 1024 / 1024).toFixed(1)} MB; some apps skip large previews`);
      }
    }
  }
  if (errors === before) ok(where);
}

// ---- hreflang reciprocity ---------------------------------------------------------------------
async function checkHreflang() {
  for (const [url, { head, where }] of [...pages]) {
    if (!head.alternates.length) continue;
    const self = head.alternates.find((a) => abs(a.href, url) === url);
    if (!self) err(where, "hreflang set does not include the page itself");
    if (!head.alternates.some((a) => a.lang === "x-default")) warn(where, "no hreflang x-default");
    for (const a of head.alternates) {
      const target = abs(a.href, url);
      if (!target || !/^https:\/\//.test(a.href)) { err(where, `hreflang ${a.lang} href must be absolute https: ${a.href}`); continue; }
      if (target === url) continue;
      if (!pages.has(target)) await checkPage(target);
      const other = pages.get(target);
      if (!other) { err(where, `hreflang ${a.lang} -> ${target} is not a 200 HTML page`); continue; }
      const back = other.head.alternates.some((b) => abs(b.href, target) === url);
      if (!back) err(where, `hreflang ${a.lang} -> ${new URL(target).pathname} does not link back`);
    }
  }
}

// ---- .well-known --------------------------------------------------------------------------------
async function checkWellKnown(path, validate) {
  const r = await get(new URL(path, origin));
  if (r.status === 404 && !appLinksRequired) return warn(path, "404 (fine only if the app uses no universal links / App Links)");
  if (r.status >= 300 && r.status < 400) return err(path, `redirects to ${r.headers.get("location")}; app-link files must answer 200 directly`);
  if (r.status !== 200) return err(path, `status ${r.status}`);
  const ctype = r.headers.get("content-type") || "";
  if (!/^application\/json/i.test(ctype)) err(path, `content-type ${ctype || "none"} (expected application/json)`);
  let json;
  try { json = JSON.parse(r.text); } catch { return err(path, "not valid JSON"); }
  const problem = validate(json);
  if (problem) err(path, problem);
  else ok(path);
}
const aasa = (j) => {
  const details = j?.applinks?.details;
  if (!Array.isArray(details) || !details.length) return "applinks.details missing";
  const ids = details.flatMap((d) => d.appIDs || (d.appID ? [d.appID] : []));
  if (!ids.length) return "no appIDs";
  const bad = ids.filter((id) => !/^[A-Z0-9]{10}\.[\w.-]+$/.test(id));
  if (bad.length) return `appIDs must be <TEAM_ID>.<bundle id>: ${bad.join(", ")}`;
  if (ids.some((id) => /^(ABCDE12345|XXXXXXXXXX)\./.test(id))) return "placeholder Team ID";
  return null;
};
const assetlinks = (j) => {
  if (!Array.isArray(j) || !j.length) return "must be a non-empty JSON array";
  const android = j.filter((s) => s?.target?.namespace === "android_app");
  if (!android.length) return "no android_app target";
  for (const s of android) {
    if (!s.target.package_name) return "target.package_name missing";
    const fps = s.target.sha256_cert_fingerprints || [];
    if (!fps.length) return "sha256_cert_fingerprints missing";
    const bad = fps.filter((f) => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
    if (bad.length) return `fingerprints must be uppercase hex with colons: ${bad.join(", ")}`;
    if (!(s.relation || []).includes("delegate_permission/common.handle_all_urls")) return "relation must include delegate_permission/common.handle_all_urls";
  }
  return null;
};

// ---- run ------------------------------------------------------------------------------------------
console.log(`Checking ${origin} (signed-out, no cookies)\n`);

for (const p of requiredPaths) await checkPage(new URL(p, origin).href, { required: true });

await checkWellKnown("/.well-known/apple-app-site-association", aasa);
await checkWellKnown("/.well-known/assetlinks.json", assetlinks);

const robots = await get(new URL("/robots.txt", origin));
let sitemapUrl = new URL("/sitemap.xml", origin).href;
if (robots.status !== 200) err("/robots.txt", `status ${robots.status}`);
else {
  if (!/text\/plain/i.test(robots.headers.get("content-type") || "")) warn("/robots.txt", "content-type should be text/plain");
  const sm = robots.text.match(/^\s*sitemap:\s*(\S+)/im);
  if (sm) sitemapUrl = sm[1]; else warn("/robots.txt", "no Sitemap: line");
  if (/^\s*user-agent:\s*\*\s*[\r\n]+\s*disallow:\s*\/\s*$/im.test(robots.text)) err("/robots.txt", "User-agent: * is disallowed from the whole site");
  ok("/robots.txt");
}

const sm = await get(sitemapUrl);
if (sm.status !== 200) err("sitemap", `${sitemapUrl} status ${sm.status}`);
else {
  const locs = [...new Set([...sm.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]))];
  if (!locs.length) err("sitemap", "no <loc> entries");
  if (!/<lastmod>/.test(sm.text)) warn("sitemap", "no <lastmod>");
  if (locs.some((l) => /\/i\//.test(l))) err("sitemap", "contains /i/ invite URLs (they are noindex)");
  ok("sitemap", `${locs.length} URL(s)`);
  for (const loc of locs.slice(0, maxPages)) {
    const r = await get(loc);
    const where = `sitemap ${new URL(loc).pathname}`;
    if (r.status !== 200) { err(where, `status ${r.status} (sitemap URLs must be final 200 URLs)`); continue; }
    if (!pages.has(loc)) await checkPage(loc);
    const page = pages.get(loc);
    if (page && isNoindex(r, page.head)) err(where, "noindex page listed in the sitemap");
  }
  if (locs.length > maxPages) warn("sitemap", `only the first ${maxPages} URLs checked (--max)`);
}

await checkHreflang();

const code = opt("invite");
if (code) {
  const path = `/i/${code}`;
  const r = await get(new URL(path, origin));
  if (r.status !== 200) err(path, `status ${r.status}`);
  else {
    if (!/noindex/i.test(r.headers.get("x-robots-tag") || "") && !/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(r.text)) err(path, "invite page is not noindex");
    if (!/no-store|private/i.test(r.headers.get("cache-control") || "")) warn(path, "invite page should be Cache-Control: private, no-store");
    if (!/apps\.apple\.com/.test(r.text) || !/play\.google\.com/.test(r.text)) warn(path, "no App Store and/or Google Play link (store fallback)");
    if (/referrer=/.test(r.text) === false) warn(path, "Play link has no referrer= parameter (install referrer)");
    if (/%%[A-Z0-9_]+%%/.test(r.text)) err(path, "unfilled placeholders");
    ok(path);
  }
  const bad = await get(new URL("/i/%3Cscript%3E", origin));
  if (bad.status === 200) err("/i/<invalid>", "an invalid code returns 200; validate the code and answer 404");
}

console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exitCode = errors ? 1 : 0;
