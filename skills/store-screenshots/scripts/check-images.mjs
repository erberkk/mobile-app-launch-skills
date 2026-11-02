#!/usr/bin/env node
// Checks rendered store images: exact size per device folder, no alpha channel, count limits, numbering.
// Usage: node check-images.mjs <out-dir>     (layout: <out>/<locale>/<device>/NN.png, <out>/<locale>/play-feature.png)
// No dependencies: reads the PNG header directly. JPEGs are size-checked only.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

// Keep in sync with references/device-matrix.md. Each entry lists accepted portrait sizes.
const DEVICES = {
  "ios-69": { sizes: [[1320, 2868], [1290, 2796], [1260, 2736]], max: 10 },
  "ios-61": { sizes: [[1206, 2622], [1179, 2556]], max: 10 },
  "ios-duo-outer": { sizes: [[1398, 2034]], max: 10 },
  "ios-duo-inner": { sizes: [[2007, 2853]], max: 10 },
  "ipad-13": { sizes: [[2064, 2752], [2048, 2732]], max: 10 },
  "play-phone": { play: "phone", max: 8 },
  "play-tablet-7": { play: "tablet", max: 8 },
  "play-tablet-10": { play: "tablet", max: 8 },
};

function pngInfo(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20), colorType = buf[25];
  let alpha = colorType === 4 || colorType === 6;
  // tRNS chunk also means transparency
  for (let off = 8; off < buf.length - 8;) {
    const len = buf.readUInt32BE(off), type = buf.toString("ascii", off + 4, off + 8);
    if (type === "tRNS") alpha = true;
    if (type === "IDAT" || type === "IEND") break;
    off += 12 + len;
  }
  return { w, h, alpha };
}
function jpegSize(buf) {
  for (let off = 2; off < buf.length;) {
    if (buf[off] !== 0xff) return null;
    const marker = buf[off + 1], len = buf.readUInt16BE(off + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
      return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7), alpha: false };
    off += 2 + len;
  }
  return null;
}
const info = (file) => {
  const buf = readFileSync(file);
  return extname(file).toLowerCase() === ".png" ? pngInfo(buf) : jpegSize(buf);
};
const playOk = (kind, w, h) => {
  const lo = Math.min(w, h), hi = Math.max(w, h);
  if (kind === "phone") return lo >= 320 && hi <= 3840 && hi <= 2 * lo;
  return lo >= 1080 && hi <= 7680 && Math.abs(hi / lo - 16 / 9) < 0.01;
};

const root = process.argv[2];
if (!root) { console.error("usage: node check-images.mjs <out-dir>"); process.exit(2); }
let errors = 0;
const err = (m) => { errors++; console.log("ERROR " + m); };

for (const locale of readdirSync(root).filter((d) => statSync(join(root, d)).isDirectory())) {
  const ldir = join(root, locale);
  const feature = join(ldir, "play-feature.png");
  try {
    const f = info(feature);
    if (!f || f.w !== 1024 || f.h !== 500) err(`${feature}: must be 1024x500`);
    if (f?.alpha) err(`${feature}: has alpha channel`);
  } catch { console.log(`note  ${locale}: no play-feature.png`); }

  for (const device of readdirSync(ldir).filter((d) => statSync(join(ldir, d)).isDirectory())) {
    const spec = DEVICES[device];
    if (!spec) { console.log(`note  unknown device folder ${locale}/${device} (skipped)`); continue; }
    const files = readdirSync(join(ldir, device)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
    if (!files.length) err(`${locale}/${device}: empty`);
    if (files.length > spec.max) err(`${locale}/${device}: ${files.length} files, max ${spec.max}`);
    files.forEach((f, i) => {
      if (!f.startsWith(String(i + 1).padStart(2, "0"))) err(`${locale}/${device}/${f}: numbering gap (expected ${String(i + 1).padStart(2, "0")})`);
      const m = info(join(ldir, device, f));
      if (!m) return err(`${locale}/${device}/${f}: unreadable image`);
      if (m.alpha) err(`${locale}/${device}/${f}: has alpha channel / transparency`);
      const ok = spec.play ? playOk(spec.play, m.w, m.h)
        : spec.sizes.some(([w, h]) => (m.w === w && m.h === h) || (m.w === h && m.h === w));
      if (!ok) err(`${locale}/${device}/${f}: ${m.w}x${m.h} not accepted for ${device}`);
    });
    console.log(`ok    ${locale}/${device}: ${files.length} checked`);
  }
}
console.log(`\n${errors} error(s)`);
process.exit(errors ? 1 : 0);
