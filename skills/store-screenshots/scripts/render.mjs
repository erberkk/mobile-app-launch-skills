#!/usr/bin/env node
// Renders panorama store screenshots from real app captures.
// Usage: node render.mjs <frames.json> <out-dir>
// Needs: npm i (playwright-core) and a local Chrome/Chromium (CHROME_PATH, or Playwright's default channel).
// Capture paths in frames.json are relative to the frames.json folder.
import { chromium } from "playwright-core";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const [cfgPath, outDir = "out"] = process.argv.slice(2);
if (!cfgPath) { console.error("usage: node render.mjs <frames.json> <out-dir>"); process.exit(2); }
const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const base = dirname(resolve(cfgPath));
const template = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "../templates/panorama.html")).href;

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" });
const page = await browser.newPage({ deviceScaleFactor: 1 }); // 1 CSS px = 1 output px

for (const locale of cfg.locales) {
  for (const [device, d] of Object.entries(cfg.devices)) {
    const frames = cfg.frames[locale].map((f) => {
      const file = join(base, d.captures.replace("{locale}", locale), f.capture);
      if (!existsSync(file)) throw new Error(`missing capture ${file}`);
      return { ...f, capture: pathToFileURL(file).href };
    });
    await page.setViewportSize({ width: d.w * frames.length, height: d.h });
    await page.goto(template);
    await page.evaluate((c) => { window.CONFIG = c; window.build(); },
      { frame: { w: d.w, h: d.h }, theme: cfg.theme, phone: cfg.phone, frames });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })));
    });
    const dir = join(outDir, locale, device);
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < frames.length; i++) {
      const file = join(dir, String(i + 1).padStart(2, "0") + ".png");
      // omitBackground stays false so the PNG has no transparent pixels
      await page.screenshot({ path: file, clip: { x: i * d.w, y: 0, width: d.w, height: d.h } });
    }
    console.log(`rendered ${locale}/${device}: ${frames.length} frames`);
  }
  if (cfg.feature) {
    const { w, h } = cfg.feature;
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><html><body style="margin:0;width:${w}px;height:${h}px;background:${cfg.theme.bg};
      font-family:${cfg.theme.font},system-ui,sans-serif;color:${cfg.theme.ink};display:flex;align-items:center;padding:0 72px;box-sizing:border-box">
      <h1 style="font-size:64px;font-weight:800;letter-spacing:-.03em;max-width:60%;line-height:1.05"></h1></body></html>`);
    await page.$eval("h1", (el, t) => { el.textContent = t; }, cfg.feature.headline[locale] ?? "");
    await page.evaluate(() => document.fonts.ready);
    mkdirSync(join(outDir, locale), { recursive: true });
    await page.screenshot({ path: join(outDir, locale, "play-feature.png") });
  }
}
await browser.close();
console.log("next: node check-images.mjs", outDir);
