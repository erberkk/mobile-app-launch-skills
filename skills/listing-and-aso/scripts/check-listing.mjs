#!/usr/bin/env node
// Validates store listing text: length limits, cross-platform wording (guideline 2.3.10),
// risky claims, placeholders and unverified numbers.
// Usage: node check-listing.mjs listing.json      (exit 1 on any ERROR)
// Format: see ../templates/listing.example.json
import { readFileSync } from "node:fs";

// Update here when the stores change their limits. "bytes" = UTF-8 byte count.
const LIMITS = {
  ios: { name: 30, subtitle: 30, keywords: { bytes: 100 }, promotionalText: 170, description: 4000, whatsNew: 4000 },
  android: { title: 30, shortDescription: 80, fullDescription: 4000, releaseNotes: 500 },
};

// Words that must not appear in the other store's metadata.
const FORBIDDEN = {
  ios: [/\bandroid\b/i, /google play/i, /play store/i, /health connect/i, /wear ?os/i, /galaxy/i, /\bpixel\b/i],
  android: [/app store/i, /\bios\b/i, /apple health/i, /healthkit/i, /apple watch/i, /\biphone\b/i, /\bipad\b/i, /testflight/i],
};

const RISKY = [
  [/\bunlimited\b|sınırsız|illimit|ilimitad|unbegrenzt/i, "\"unlimited\": only if there is truly no cap or fair-use limit"],
  [/\b(#1|no\.? ?1|number one|best)\b/i, "superlative / ranking claim"],
  [/\b(cure|treat|diagnos\w*|prevent\w* disease|clinically proven)\b/i, "medical claim"],
  [/\bguarantee\w*\b/i, "guarantee claim"],
  [/\bfree\b/i, "\"free\": allowed in descriptions if accurate; not in the Play title", "warn"],
];
const PLACEHOLDER = /lorem ipsum|\bTODO\b|\bTBD\b|\[[A-Z_]{3,}\]|<[A-Z_]{3,}>|coming soon/i;

const file = process.argv[2];
if (!file) { console.error("usage: node check-listing.mjs listing.json"); process.exit(2); }
const data = JSON.parse(readFileSync(file, "utf8"));
const allowed = new Set((data.facts?.allowedNumbers ?? []).map(String));
let errors = 0, warnings = 0;
const err = (where, msg) => { errors++; console.log(`ERROR ${where}: ${msg}`); };
const warn = (where, msg) => { warnings++; console.log(`warn  ${where}: ${msg}`); };

for (const [store, locales] of Object.entries(data.stores ?? {})) {
  const limits = LIMITS[store];
  if (!limits) { err(store, "unknown store (use ios / android)"); continue; }
  for (const [locale, fields] of Object.entries(locales)) {
    for (const [field, text] of Object.entries(fields)) {
      const where = `${store}/${locale}/${field}`;
      if (typeof text !== "string") continue;
      const lim = limits[field];
      if (lim !== undefined) {
        const bytes = typeof lim === "object";
        const max = bytes ? lim.bytes : lim;
        const len = bytes ? Buffer.byteLength(text, "utf8") : [...text].length;
        if (len > max) err(where, `${len}/${max} ${bytes ? "bytes" : "chars"}`);
        else if (len > max * 0.95) warn(where, `${len}/${max} — close to the limit`);
      }
      if (/Url$/.test(field)) {
        if (!/^https:\/\//.test(text)) err(where, "URL must be https");
        continue;
      }
      for (const re of FORBIDDEN[store]) if (re.test(text)) err(where, `mentions another platform: "${text.match(re)[0]}"`);
      for (const [re, why, level] of RISKY) if (re.test(text)) (level === "warn" ? warn : err)(where, why);
      if (PLACEHOLDER.test(text)) err(where, `placeholder text: "${text.match(PLACEHOLDER)[0]}"`);
      if (store === "android" && field === "title" && /\bfree\b/i.test(text)) err(where, "\"free\" in the Play title");
      if (store === "ios" && field === "keywords") {
        if (/,\s/.test(text)) warn(where, "spaces after commas waste bytes");
        const words = text.toLowerCase().split(",").map((w) => w.trim()).filter(Boolean);
        const dup = words.filter((w, i) => words.indexOf(w) !== i);
        if (dup.length) err(where, `duplicate keywords: ${[...new Set(dup)].join(", ")}`);
        const named = `${fields.name ?? ""} ${fields.subtitle ?? ""}`.toLowerCase();
        const inName = words.filter((w) => !w.includes(" ") && named.split(/\W+/).includes(w));
        if (inName.length) warn(where, `already in name/subtitle: ${inName.join(", ")}`);
      }
      for (const n of text.match(/\b\d[\d.,]*\b/g) ?? []) {
        const plain = n.replace(/[.,]$/, "");
        if (!allowed.has(plain)) warn(where, `number "${plain}" not in facts.allowedNumbers — confirm it matches the app`);
      }
    }
  }
}
console.log(`\n${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
