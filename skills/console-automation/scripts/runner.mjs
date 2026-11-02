#!/usr/bin/env node
// Runs step files against a tab of an already-running, logged-in Chrome (Playwright over CDP).
//
//   node runner.mjs [--port 9333] [--tab <url-regex>] [--shots shots] step1.mjs [step2.mjs ...]
//
// A step file default-exports: async (page, ctx) => result
//   ctx.text(n, from)       visible text lines (n lines, starting at the first line containing `from`)
//   ctx.gate(checks)        throws GateError unless every check is true: { "US row = 9.99": bool, ... }
//   ctx.env                 process.env (pass values like DRY_RUN=1, SAVE=1)
//   ctx.cdp()               a CDP session for the page (file uploads, downloads)
//   ctx.shot(name)          extra screenshot
// After each step the runner prints URL + result and saves <shots>/<NN>-<step>.png.
// The runner stops at the first error, gate failure or expired session.
// browser.close() on a CDP connection only detaches: Chrome and its tabs stay open.
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import { basename, join, resolve } from "node:path";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const port = opt("--port", process.env.CDP_PORT ?? "9333");
const tabRe = new RegExp(opt("--tab", "."));
const shotsDir = opt("--shots", "shots");
const steps = args;
if (!steps.length) { console.error("usage: node runner.mjs [--port 9333] [--tab regex] step.mjs ..."); process.exit(2); }
mkdirSync(shotsDir, { recursive: true });

// URLs that mean "you are signed out": stop instead of clicking around a login page.
const LOGIN = /accounts\.google\.com\/(v3\/)?signin|ServiceLogin|idmsa\.apple\.com|appleid\.apple\.com\/auth|\/login(\?|$)/i;

class GateError extends Error {}
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const context = browser.contexts()[0];
const page = context.pages().find((p) => tabRe.test(p.url())) ?? (await context.newPage());
await page.bringToFront();

const ctx = {
  env: process.env,
  context,
  async text(n = 80, from) {
    const lines = (await page.locator("body").innerText()).split("\n").map((s) => s.trim()).filter(Boolean);
    const i = from ? Math.max(0, lines.findIndex((l) => l.includes(from))) : 0;
    return lines.slice(i, i + n).join("\n");
  },
  gate(checks) {
    const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
    if (failed.length) throw new GateError("GATE FAILED: " + failed.join("; "));
    return "gate ok";
  },
  cdp: () => context.newCDPSession(page),
  shot: (name) => page.screenshot({ path: join(shotsDir, `${name}.png`) }),
};

let code = 0;
for (const [i, file] of steps.entries()) {
  const label = `${String(i + 1).padStart(2, "0")}-${basename(file, ".mjs")}`;
  let out;
  try {
    if (LOGIN.test(page.url())) throw new Error("SESSION_EXPIRED: sign in manually in the automation profile, then rerun");
    const step = (await import(pathToFileURL(resolve(file)).href + "?t=" + Date.now())).default;
    out = await step(page, ctx);
    if (LOGIN.test(page.url())) throw new Error("SESSION_EXPIRED during step");
  } catch (e) {
    out = (e instanceof GateError ? "" : "ERROR: ") + String(e.message).split("\n")[0];
    code = 1;
  }
  await page.screenshot({ path: join(shotsDir, `${label}.png`) }).catch(() => {});
  console.log(`[${label}] URL: ${page.url()}`);
  if (out !== undefined) console.log(typeof out === "string" ? out : JSON.stringify(out, null, 1));
  if (code) break;
}
await browser.close().catch(() => {}); // detach only
process.exit(code);
