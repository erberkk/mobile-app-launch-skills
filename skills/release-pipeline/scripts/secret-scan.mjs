#!/usr/bin/env node
// Fails (exit 1) when a git-tracked file looks like it contains a secret. Run as the first CI step.
// Usage: node secret-scan.mjs            (scans `git ls-files`)
// Allow a known false positive by adding "secret-scan:allow" on the same line.
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const PATTERNS = [
  ["private key block", /-----BEGIN (RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
  ["Google service account", /"type":\s*"service_account"/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Stripe secret key", /\bsk_(live|test)_[0-9a-zA-Z]{16,}/],
  ["Anthropic key", /\bsk-ant-[0-9a-zA-Z_-]{20,}/],
  ["OpenAI-style key", /\bsk-(proj-)?[0-9a-zA-Z_-]{32,}/],
  ["Slack webhook", /hooks\.slack\.com\/services\/T[0-9A-Z]+\/B[0-9A-Z]+\/[0-9a-zA-Z]+/],
  ["Slack token", /\bxox[abpr]-[0-9a-zA-Z-]{10,}/],
  ["GitHub token", /\bgh[pousr]_[0-9a-zA-Z]{36,}/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["RevenueCat secret key", /\bsk_[0-9a-zA-Z]{20,}/],
  ["JWT (service role?)", /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/],
  ["password assignment", /(password|passwd|secret)\s*[:=]\s*["'][^"'\s]{8,}["']/i],
];
const BLOCKED_FILES = [/\.p8$/, /\.p12$/, /\.jks$/, /\.keystore$/, /\.mobileprovision$/, /(^|\/)key\.properties$/, /(^|\/)\.env(\..*)?$/];

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
let found = 0;
for (const f of files) {
  if (BLOCKED_FILES.some((re) => re.test(f)) && !f.endsWith(".example")) { console.log(`BLOCKED FILE  ${f}`); found++; continue; }
  let text;
  try { if (statSync(f).size > 1_000_000) continue; text = readFileSync(f, "utf8"); } catch { continue; }
  if (text.includes("\u0000")) continue; // binary
  text.split("\n").forEach((line, i) => {
    if (line.includes("secret-scan:allow")) return;
    for (const [name, re] of PATTERNS) if (re.test(line)) { console.log(`${name.padEnd(24)} ${f}:${i + 1}`); found++; }
  });
}
console.log(found ? `\n${found} possible secret(s). Remove them and rotate the keys.` : "secret scan: clean");
process.exit(found ? 1 : 0);
