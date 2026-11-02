#!/usr/bin/env node
// Replaces Google Play listing images (screenshots + feature graphic) in one edit.
// Usage: DRY_RUN=0 PACKAGE=com.example.app GOOGLE_SA_PATH=/secure/sa.json node upload-play.mjs <out-dir>
// DRY_RUN defaults to 1: uploads into an edit and then DELETES the edit instead of committing it.
// Commit (DRY_RUN=0) publishes listing changes: get approval first.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createSign } from "node:crypto";

const TYPES = { "play-phone": "phoneScreenshots", "play-tablet-7": "sevenInchScreenshots", "play-tablet-10": "tenInchScreenshots" };
const LANGS = { en: "en-US" }; // local folder -> Play language code

const DRY = process.env.DRY_RUN !== "0";
const out = process.argv[2], pkg = process.env.PACKAGE;
if (!out || !pkg || !process.env.GOOGLE_SA_PATH) { console.error("usage: PACKAGE=... GOOGLE_SA_PATH=... node upload-play.mjs <out-dir>"); process.exit(2); }

async function token() {
  const sa = JSON.parse(readFileSync(process.env.GOOGLE_SA_PATH, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc({ alg: "RS256", typ: "JWT" })}.${enc({ iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) });
  const j = await res.json();
  if (!j.access_token) throw new Error("token error " + JSON.stringify(j));
  return j.access_token;
}
const T = await token();
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${pkg}`;
async function call(url, method = "GET", body, type = "application/json") {
  const res = await fetch(url, { method, headers: { Authorization: `Bearer ${T}`, ...(body ? { "Content-Type": type } : {}) },
    body: body && type === "application/json" ? JSON.stringify(body) : body });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

const edit = await call(`${API}/edits`, "POST", {});
console.log("edit", edit.id, DRY ? "(dry run: will be deleted)" : "");
try {
  for (const [folder, lang] of Object.entries(LANGS)) {
    for (const [device, imageType] of Object.entries(TYPES)) {
      let files; try { files = readdirSync(join(out, folder, device)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort(); } catch { continue; }
      if (!files.length) continue;
      await call(`${API}/edits/${edit.id}/listings/${lang}/${imageType}`, "DELETE"); // deleteall
      for (const f of files) {
        const type = f.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
        await call(`${UPLOAD}/edits/${edit.id}/listings/${lang}/${imageType}?uploadType=media`, "POST", readFileSync(join(out, folder, device, f)), type);
      }
      console.log(`${lang} ${imageType}: ${files.length} uploaded in order`);
    }
    try {
      const fg = readFileSync(join(out, folder, "play-feature.png"));
      await call(`${API}/edits/${edit.id}/listings/${lang}/featureGraphic`, "DELETE");
      await call(`${UPLOAD}/edits/${edit.id}/listings/${lang}/featureGraphic?uploadType=media`, "POST", fg, "image/png");
      console.log(`${lang} featureGraphic uploaded`);
    } catch (e) { if (!String(e.message).includes("ENOENT")) throw e; }
  }
  if (DRY) { await call(`${API}/edits/${edit.id}`, "DELETE"); console.log("dry run: edit deleted, nothing published"); }
  else { await call(`${API}/edits/${edit.id}:commit`, "POST"); console.log("committed"); }
} catch (e) {
  await call(`${API}/edits/${edit.id}`, "DELETE").catch(() => {});
  throw e;
}
