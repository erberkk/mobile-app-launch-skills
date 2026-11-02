#!/usr/bin/env node
// Starting point for the privacy inventory: finds known SDKs in lock files and greps the code
// for APIs and permissions that affect App Privacy, Data safety and the privacy manifest.
// Usage: node scan-sdks.mjs [repo-root]      Output: Markdown report on stdout.
// This is a heuristic. Read the network layer and backend before answering any form.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const root = process.argv[2] ?? ".";
const SKIP = new Set(["node_modules", ".git", "build", ".dart_tool", "Pods", ".gradle", "DerivedData", ".idea"]);
const CODE_EXT = new Set([".dart", ".swift", ".m", ".mm", ".kt", ".java", ".ts", ".tsx", ".js", ".plist", ".xml", ".gradle", ".kts"]);

// name fragment -> what to check in the forms
const SDKS = [
  [/firebase_analytics|FirebaseAnalytics|firebase-analytics/i, "Analytics: Usage Data / App activity; may use device IDs"],
  [/crashlytics/i, "Crash data / App info and performance; device identifiers"],
  [/sentry/i, "Crash and performance data; check PII scrubbing settings"],
  [/purchases_flutter|RevenueCat|purchases-android|react-native-purchases/i, "Purchase history; app user ID sent to RevenueCat"],
  [/google_mobile_ads|GoogleMobileAds|play-services-ads/i, "ADS: tracking, advertising data, AD_ID, ATT"],
  [/facebook|FBSDK/i, "Meta SDK: check auto-logged events, tracking, ATT"],
  [/appsflyer|adjust|branch|kochava|singular/i, "Attribution SDK: device IDs, likely tracking"],
  [/onesignal|firebase_messaging|FirebaseMessaging/i, "Push token (device ID); messaging"],
  [/supabase|firebase_auth|FirebaseAuth|auth0|amplify/i, "Account data: email, user ID"],
  [/health|HealthKit|health-connect|connect-client/i, "HEALTH: HealthKit / Health Connect rules, declarations"],
  [/geolocator|location|CoreLocation|play-services-location/i, "Location: precise vs coarse, on device or sent?"],
  [/image_picker|camera|photo_manager/i, "Photos/camera: is the image uploaded?"],
  [/speech_to_text|speech|SFSpeech/i, "Audio / speech: on-device or server recognition?"],
  [/google_sign_in|sign_in_with_apple|GoogleSignIn|AuthenticationServices/i, "Sign-in providers: email, user ID; Apple token revocation on deletion"],
  [/mixpanel|amplitude|segment|posthog/i, "Product analytics: Usage Data, identifiers"],
  [/install_referrer|installreferrer/i, "Install referrer: attribution data"],
];
const CODE = [
  [/UserDefaults|NSUserDefaults|shared_preferences/, "Required-reason API: UserDefaults"],
  [/creationDate|modificationDate|fileModificationDate|NSFileModificationDate|\.stat\(|lastModified/, "Required-reason API: file timestamp (check context)"],
  [/systemUptime|mach_absolute_time/, "Required-reason API: system boot time"],
  [/volumeAvailableCapacity|NSFileSystemFreeSize|statfs/, "Required-reason API: disk space"],
  [/activeInputModes/, "Required-reason API: active keyboards"],
  [/ATTrackingManager|NSUserTrackingUsageDescription/, "App Tracking Transparency present"],
  [/AdvertisingIdClient|permission\.AD_ID|ASIdentifierManager|advertisingIdentifier/, "Advertising ID usage"],
  [/NS\w+UsageDescription/, "iOS permission usage string (check wording matches real use)"],
  [/android\.permission\.\w+/, "Android permission"],
  [/ITSAppUsesNonExemptEncryption/, "Export compliance key"],
];

const lockFiles = ["pubspec.lock", "ios/Podfile.lock", "Podfile.lock", "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
  "android/app/build.gradle", "android/app/build.gradle.kts", "app/build.gradle", "app/build.gradle.kts", "Package.resolved"];
console.log(`# Privacy scan of ${root}\n\n## SDKs found in lock/build files\n`);
const sdkHits = new Map();
for (const f of lockFiles) {
  const p = join(root, f);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, "utf8");
  for (const [re, note] of SDKS) {
    const m = text.match(new RegExp(re.source, "gi"));
    if (m) sdkHits.set(note, new Set([...(sdkHits.get(note) ?? []), ...m.map((x) => x.toLowerCase()), `(${f})`]));
  }
}
if (!sdkHits.size) console.log("- none matched (check the lock file names for your stack)");
for (const [note, names] of sdkHits) console.log(`- **${note}** — ${[...names].join(", ")}`);

console.log("\n## Code signals\n");
const hits = new Map();
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    if (!CODE_EXT.has(extname(name)) || st.size > 2_000_000) continue;
    const lines = readFileSync(p, "utf8").split("\n");
    lines.forEach((line, i) => {
      for (const [re, note] of CODE) {
        const m = line.match(re);
        if (m) {
          const list = hits.get(note) ?? [];
          if (list.length < 15) list.push(`${relative(root, p)}:${i + 1} \`${m[0]}\``);
          hits.set(note, list);
        }
      }
    });
  }
})(root);
for (const [note, list] of hits) console.log(`### ${note}\n${list.map((l) => "- " + l).join("\n")}\n`);
console.log("## Next\n- Read every network call (app) and every outbound call (backend). Fill docs/privacy-inventory.md.\n- Health-sourced fields must not appear in any AI or third-party payload.");
