// Example read-only step: list price rows of the currently open pricing table.
// Safe to run any time; changes nothing.
//   node runner.mjs --tab "play.google.com/console" steps/read-price-rows.mjs
export default async (page) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("tr, [role=row]")]
      .map((r) => r.innerText.replace(/\s+/g, " ").trim())
      .filter((t) => /\b[A-Z]{3}\b\s*[\d.,]+/.test(t)));   // rows that contain a currency code + amount
  // The console's locale decides the decimal separator. Report it so later steps type numbers correctly.
  const lang = await page.evaluate(() => document.documentElement.lang || navigator.language);
  return { lang, count: rows.length, sample: rows.slice(0, 10) };
};
