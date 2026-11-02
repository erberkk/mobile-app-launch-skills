// App Store Connect API helper: ES256 JWT + fetch wrapper. No dependencies.
// Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH (path to the .p8 file, kept outside the repo).
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const b64url = (b) => Buffer.from(b).toString("base64url");

export function ascToken() {
  const { ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH } = process.env;
  if (!ASC_KEY_ID || !ASC_ISSUER_ID || !ASC_KEY_PATH) throw new Error("set ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_PATH");
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: ASC_KEY_ID, typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" }));
  const key = createPrivateKey(readFileSync(ASC_KEY_PATH));
  const sig = sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(sig)}`;
}

export async function asc(path, { method = "GET", body } = {}) {
  const res = await fetch(path.startsWith("http") ? path : `https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${ascToken()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json.errors ?? json).slice(0, 400)}`);
  return json;
}
