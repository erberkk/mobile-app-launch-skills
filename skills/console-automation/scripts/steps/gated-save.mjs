// Example write step with a safety gate. Pattern: read form -> compare with targets -> abort or save -> read back.
//   TARGETS='{"United States":"USD 9.99","Germany":"EUR 8.99"}' node runner.mjs --tab "play.google.com/console" steps/gated-save.mjs
//   Add SAVE=1 only after a dry run printed "GATE OK" and a human approved the save.
// Selectors and button labels are examples: consoles change and are localized. Match the labels
// you see in YOUR console language, and keep them in one place like below.
const LABELS = { save: ["Save changes", "Save"], confirm: ["Confirm"] };

const rowsOnPage = (page) => page.evaluate(() =>
  [...document.querySelectorAll("tr, [role=row]")].map((r) => r.innerText.replace(/\s+/g, " ").trim()));

export default async (page, ctx) => {
  const targets = JSON.parse(ctx.env.TARGETS ?? "{}");
  if (!Object.keys(targets).length) return "no TARGETS given";

  // 1. Read back what the form currently holds.
  const rows = await rowsOnPage(page);
  const check = {};
  for (const [country, want] of Object.entries(targets)) {
    const row = rows.find((r) => r.startsWith(country));
    check[`${country} = ${want} (found: ${row?.slice(0, 60) ?? "missing"})`] = !!row && row.includes(want);
  }
  // Global sanity rule: nothing priced below 1 unit (catches a wrong menu item or decimal slip).
  const low = rows.filter((r) => /\b[A-Z]{3}\s*0[.,]\d\d\b/.test(r));
  check[`no price below 1 (found ${low.length})`] = low.length === 0;

  // 2. Gate: throws (runner stops, nothing saved) unless every check passes.
  ctx.gate(check);
  if (ctx.env.SAVE !== "1") return "GATE OK — dry run, not saved. Rerun with SAVE=1 after approval.";

  // 3. Save: click a visible, enabled button whose label matches exactly.
  const clickLabel = async (labels) => {
    for (const name of labels) {
      for (const b of await page.getByRole("button", { name, exact: true }).all()) {
        if ((await b.isVisible()) && (await b.isEnabled())) { await b.click(); return name; }
      }
    }
    return null;
  };
  const saved = await clickLabel(LABELS.save);
  if (!saved) return "no Save button found — nothing saved";
  await page.waitForTimeout(3000);
  const dialog = page.locator("[role=dialog]").last();
  if (await dialog.count()) {
    const text = (await dialog.innerText()).replace(/\s+/g, " ").slice(0, 300);
    // Read the confirmation text before confirming; stop if it mentions something unexpected.
    if (/publish|submit|send for review/i.test(text)) return "STOPPED: confirmation mentions publish/submit: " + text;
    await clickLabel(LABELS.confirm);
    await page.waitForTimeout(3000);
  }

  // 4. Read back after save.
  await page.reload();
  await page.waitForLoadState("networkidle").catch(() => {});
  const after = await rowsOnPage(page);
  const mismatch = Object.entries(targets).filter(([c, want]) => !after.find((r) => r.startsWith(c))?.includes(want));
  return mismatch.length ? "SAVED BUT READ-BACK MISMATCH: " + JSON.stringify(mismatch) : "saved and verified";
};
