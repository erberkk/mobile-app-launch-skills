#!/usr/bin/env node
// Uploads screenshots to the editable App Store version, replacing each set, in file order.
// Usage: DRY_RUN=0 APP_ID=<numeric app id> node upload-asc.mjs <out-dir>
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (see asc-auth.mjs). DRY_RUN defaults to 1 (no writes).
// Map local device folders to screenshotDisplayType values. Check the current enum
// (ScreenshotDisplayType in the App Store Connect API reference) before use; new devices add values.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { asc } from "./asc-auth.mjs";

const DISPLAY_TYPES = {
  "ios-69": "APP_IPHONE_67",
  "ios-61": "APP_IPHONE_61",
  "ipad-13": "APP_IPAD_PRO_3GEN_129",
  // "ios-duo-outer": "<verify enum>", "ios-duo-inner": "<verify enum>",
};
const LOCALES = { en: "en-US" }; // local folder -> App Store locale

const DRY = process.env.DRY_RUN !== "0";
const out = process.argv[2];
const appId = process.env.APP_ID;
if (!out || !appId) { console.error("usage: APP_ID=... node upload-asc.mjs <out-dir>"); process.exit(2); }

// 1. Editable version (PREPARE_FOR_SUBMISSION and similar states)
const versions = await asc(`/v1/apps/${appId}/appStoreVersions?filter[platform]=IOS&filter[appStoreState]=PREPARE_FOR_SUBMISSION,DEVELOPER_REJECTED,REJECTED,METADATA_REJECTED&limit=1`);
const version = versions.data[0];
if (!version) throw new Error("no editable iOS version; create one first");
console.log("version", version.attributes.versionString, version.attributes.appStoreState, DRY ? "(dry run)" : "");

const locs = await asc(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
for (const [folder, locale] of Object.entries(LOCALES)) {
  const loc = locs.data.find((l) => l.attributes.locale === locale);
  if (!loc) { console.log(`skip ${locale}: no localization on this version`); continue; }
  const sets = await asc(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`);

  for (const [device, displayType] of Object.entries(DISPLAY_TYPES)) {
    const dir = join(out, folder, device);
    let files;
    try { files = readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort(); } catch { continue; }
    if (!files.length) continue;
    console.log(`${locale} ${displayType}: ${files.length} files`);
    if (DRY) continue;

    // 2. Find or create the set; remove existing screenshots
    let set = sets.data.find((s) => s.attributes.screenshotDisplayType === displayType);
    if (!set) {
      set = (await asc("/v1/appScreenshotSets", { method: "POST", body: { data: { type: "appScreenshotSets",
        attributes: { screenshotDisplayType: displayType },
        relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } } } } } })).data;
    }
    const existing = await asc(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
    for (const s of existing.data) await asc(`/v1/appScreenshots/${s.id}`, { method: "DELETE" });

    // 3. Reserve, upload parts, commit — in order
    const ids = [];
    for (const f of files) {
      const path = join(dir, f), buf = readFileSync(path);
      const r = (await asc("/v1/appScreenshots", { method: "POST", body: { data: { type: "appScreenshots",
        attributes: { fileName: f, fileSize: statSync(path).size },
        relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } } } } })).data;
      for (const op of r.attributes.uploadOperations) {
        const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
        const res = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
        if (!res.ok) throw new Error(`upload part failed ${res.status} for ${f}`);
      }
      await asc(`/v1/appScreenshots/${r.id}`, { method: "PATCH", body: { data: { type: "appScreenshots", id: r.id,
        attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(buf).digest("hex") } } } });
      ids.push(r.id);
      console.log("  uploaded", f);
    }
    // 4. Order
    await asc(`/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, { method: "PATCH",
      body: { data: ids.map((id) => ({ type: "appScreenshots", id })) } });
  }
}
console.log(DRY ? "dry run only; set DRY_RUN=0 to upload" : "done; read back and wait for assetDeliveryState COMPLETE");
