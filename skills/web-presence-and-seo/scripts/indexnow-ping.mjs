#!/usr/bin/env node
// Submits a site's URLs to IndexNow (Bing, Yandex, Seznam, Naver and others; Google does not use it).
// Run AFTER the deploy is live: the key file must already be reachable.
//
//   node indexnow-ping.mjs --host example.com --key <KEY>                 # dry run: URLs from https://example.com/sitemap.xml
//   node indexnow-ping.mjs --host example.com --key <KEY> --send          # POST to https://api.indexnow.org/indexnow
//   node indexnow-ping.mjs --host example.com --key <KEY> --urls /,/de --send
//   node indexnow-ping.mjs --host example.com --key-file src/<KEY>.txt --sitemap https://example.com/sitemap.xml
//
// The key is public by design: a file https://<host>/<KEY>.txt whose content is the key.
// Protocol: https://www.indexnow.org/documentation
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const usage = () => {
  console.error("usage: node indexnow-ping.mjs --host <host> (--key <KEY> | --key-file <path>) [--sitemap <url>] [--urls /a,/b] [--send]");
  process.exit(2);
};

const host = opt("host");
if (!host || /[/:]/.test(host)) usage();

let key = opt("key");
const keyFile = opt("key-file");
if (!key && keyFile) {
  key = readFileSync(keyFile, "utf8").trim();
  if (basename(keyFile) !== `${key}.txt`) throw new Error("key file name must be <key>.txt and contain exactly the key");
}
if (!key) usage();
if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) throw new Error("key must be 8-128 characters of a-z, A-Z, 0-9 or '-'");

const origin = `https://${host}`;
const keyLocation = `${origin}/${key}.txt`;

await main().catch((e) => {
  console.error(`FAIL ${e.message}`);
  process.exitCode = 1;
});

async function main() {
  // 1. The key file must be live and contain the key, or every engine answers 403.
  const kres = await fetch(keyLocation, { redirect: "manual" });
  const ktext = kres.ok ? (await kres.text()).trim() : "";
  if (kres.status !== 200 || ktext !== key) {
    console.error(`FAIL ${keyLocation}: status ${kres.status}${kres.status === 200 ? ", content does not equal the key" : ""}. Deploy the key file first.`);
    process.exitCode = 1;
    return;
  }
  console.log(`OK   key file ${keyLocation}`);

  // 2. URL list: --urls, or every <loc> in the sitemap.
  let urlList;
  const urls = opt("urls");
  if (urls) {
    urlList = urls.split(",").map((u) => new URL(u.trim(), origin).href);
  } else {
    const sitemapUrl = opt("sitemap") || `${origin}/sitemap.xml`;
    const sres = await fetch(sitemapUrl);
    if (!sres.ok) throw new Error(`sitemap ${sitemapUrl}: status ${sres.status}`);
    urlList = [...(await sres.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  }
  urlList = [...new Set(urlList)];
  const foreign = urlList.filter((u) => new URL(u).host !== host);
  if (foreign.length) throw new Error(`URLs on another host (IndexNow answers 422): ${foreign.join(", ")}`);
  if (!urlList.length) throw new Error("no URLs to submit");

  if (!args.includes("--send")) {
    console.log(`dry run: ${urlList.length} URL(s); add --send to submit`);
    console.log(urlList.join("\n"));
    return;
  }

  // 3. Submit in batches of up to 10,000 URLs.
  const meaning = { 200: "accepted", 202: "accepted, key validation pending", 400: "bad request", 403: "key not valid", 422: "URL/host or key mismatch", 429: "too many requests" };
  for (let i = 0; i < urlList.length; i += 10000) {
    const batch = urlList.slice(i, i + 10000);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key, keyLocation, urlList: batch }),
    });
    console.log(`${res.status} ${meaning[res.status] || res.statusText} (${batch.length} URLs)`);
    if (res.status >= 400) process.exitCode = 1;
  }
}
