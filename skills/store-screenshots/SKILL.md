---
name: store-screenshots
description: Use when producing or updating App Store and Google Play screenshots and the Play feature graphic - planning a connected "panorama" story across frames, capturing real in-app screens with the app's own test/screenshot harness at each device's logical size and pixel ratio, covering the full device matrix (iPhone 6.9", the required medium Dynamic Island slot, iPhone Duo outer and inner displays, iPad 13" if the app runs on iPad, Play phone, 7" and 10" tablets, 1024x500 feature graphic), checking for alpha channels and wrong sizes, and uploading in order via the App Store Connect and Google Play APIs.
---

# Store screenshots

## Purpose

Screenshots that convert, are true to the app, and fit every slot the stores require, produced by a script so they can be regenerated in minutes when the UI changes.

## Prerequisites

- A build whose UI is final for this release.
- A capture harness in the app (Flutter golden/integration tests, XCUITest, Espresso/Compose screenshot tests, or Fastlane snapshot) that can render screens with deterministic demo data.
- Node.js 18+ and Chrome/Chromium for rendering (`npm i` in `scripts/`).
- API credentials (`accounts-and-tax`) for upload.

## Principles

1. **Real captures, not mockups.** Every phone screen inside a frame is a capture of the shipped app. Redrawn or "improved" UI misleads (guideline 2.3) and gets out of date.
2. **Numbers must match the app.** If a frame shows "1,850 kcal" or "12 min", the app must produce exactly that for the demo data. Generate the demo data in the harness and assert on it in the same test.
3. **If a screenshot shows something the app doesn't do, fix one of them.** Either build the feature or change the frame. Never ship the gap.
4. **No other platform in the frames.** No Android status/navigation bars on iOS, no Apple UI or "App Store" on Play (2.3.10).
5. **Order is the story.** The first two or three frames carry most of the conversion; keep the same order in every locale and on every device.

## Device matrix

Full table with logical sizes and API identifiers: [references/device-matrix.md](references/device-matrix.md). Summary (verify at [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications) and [Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151)):

| Slot | Pixels (portrait) | Required? |
|---|---|---|
| iPhone large Dynamic Island (6.9") | 1320×2868 (also 1290×2796, 1260×2736) | Recommended main set |
| iPhone medium Dynamic Island | 1206×2622 or 1179×2556 | **At least one screenshot required** |
| iPhone Duo outer display | 1398×2034 | Required from April 2027 for apps built with the iOS 27.1 SDK or later; adds the "optimized for iPhone Duo" badge |
| iPhone Duo inner display | 2007×2853 | Same as outer |
| iPad 13" | 2064×2752 (or 2048×2732) | Required only if the app runs on iPad (not for iPhone-only apps) |
| Play phone | e.g. 1080×1920 or 1080×2160 (sides 320–3840 px, long side ≤ 2× short side) | ≥ 2 screenshots to publish; ≥ 4 at ≥ 1080 px recommended |
| Play 7" and 10" tablet | 1080–7680 px, 9:16 or 16:9 | Recommended if the app supports tablets |
| Play feature graphic | 1024×500 | Required |
| Play icon | 512×512, 32-bit PNG | Required |

Apple: up to 10 per size; PNG or JPEG; **no alpha channel or transparency**. Play: up to 8 per device type; JPEG or 24-bit PNG (no alpha).

**App Store product-page creative assets (newer App Store Connect, "Header and Search Results" tab):**

- **Header**: one wide image at the top of the product page, 3840×1646 or 5244×2950. Optional (submission passes without it), but an empty slot wastes the most visible area of the page.
- **Search Results**: 5244×2950, 3840×2560 or 1920×1280; if empty, screenshots and previews are used.
- Upload through the version page or the **Asset Library** (Upload Creative Assets), then pick it with Browse Assets. Assets uploaded to the library stay there for later use.
- Design: keep the lower-left area calm (the store overlays the icon, name and Get button), keep text big enough to read at phone width, and reuse the site hero's look so the page and the site match.
- These slots are **locked while the version is Waiting for Review**. Add them before submitting.

## Procedure

### 1. Plan the story (APPROVAL of the storyboard)

Write a storyboard of 5–8 frames: one headline (≤ 6 words), one supporting line, one capture each. The "panorama" approach: frames are slices of one wide canvas, so shapes, color fields and cards continue across frame edges and invite the swipe. The first frame states the core promise; the last frame states the offer (free start, trial) truthfully.

### 2. Capture real screens

Capture each screen at the target device's **logical size × pixel ratio**, so text and layout are exactly what that device shows. Flutter example (widget/golden test):

```dart
// 6.9" iPhone: 440 x 956 logical points @3x = 1320 x 2868 px
tester.view.physicalSize = const Size(1320, 2868);
tester.view.devicePixelRatio = 3.0;
await tester.pumpWidget(App(demo: DemoData.storeShots(locale: 'en')));
await tester.pumpAndSettle();
expect(find.text('1,850 kcal'), findsOneWidget);       // the number in the headline is real
await expectLater(find.byType(App), matchesGoldenFile('captures/en/iphone69/01_today.png'));
```

- Load fonts in tests (otherwise the test font renders boxes).
- Fixed clock, fixed demo data, no network.
- Hide debug banners; set the status bar to a clean state (or crop it and draw none).
- Capture each locale separately; never place English UI inside a localized frame.

### 3. Compose frames

Template: [templates/panorama.html](templates/panorama.html), renderer: [scripts/render.mjs](scripts/render.mjs).

```bash
cd scripts && npm i
node render.mjs ../templates/frames.example.json out/
```

The renderer lays all frames on one canvas (width = frames × frame width), loads the captures, waits for fonts, and screenshots each frame slice at exact pixel size, for every device in the config. It also renders the 1024×500 feature graphic.

### 4. Check

```bash
node check-images.mjs out/
```

Fails on: wrong dimensions for the folder's device, alpha channel present (PNG color type 4/6 or tRNS chunk), more than 10 (Apple) / 8 (Play) files, gaps in numbering. Then look at every image at 100% zoom: cut-off text, other-platform UI, placeholder strings, outdated numbers.

### 5. Upload via APIs (APPROVAL before replacing live sets)

- **App Store Connect** — [scripts/upload-asc.mjs](scripts/upload-asc.mjs): find the editable `appStoreVersion` → its `appStoreVersionLocalizations` → `appScreenshotSets` per `screenshotDisplayType` → delete old screenshots → reserve (`POST /v1/appScreenshots` with `fileName`, `fileSize`) → upload the parts from `uploadOperations` → commit (`PATCH` with `uploaded: true` and the MD5 `sourceFileChecksum`) → set the order on the set's `appScreenshots` relationship. Docs: [Uploading assets](https://developer.apple.com/documentation/appstoreconnectapi/uploading-assets-to-app-store-connect).
- **Google Play** — [scripts/upload-play.mjs](scripts/upload-play.mjs): `edits.insert` → `edits.images.deleteall` per language and image type → `edits.images.upload` in order (`phoneScreenshots`, `sevenInchScreenshots`, `tenInchScreenshots`, `featureGraphic`) → `edits.commit`. Docs: [edits.images.upload](https://developers.google.com/android-publisher/api-ref/rest/v3/edits.images/upload).

Both scripts default to dry run; set `DRY_RUN=0` to write.

### 6. Read back

List the uploaded assets per locale and device (both APIs) and compare count and order with the local folder. Apple processes uploads asynchronously; wait until every asset reports `COMPLETE` delivery state.

## Decision points needing human approval

Storyboard and headlines, final visual direction, replacing a live screenshot set, committing the Play edit.

## Verification

- `check-images.mjs` passes; every required Apple slot has at least one image; Play has phone shots and the feature graphic.
- Read-back order matches; no failed asset states.
- Each number and feature in the frames was checked against the build.

## Common pitfalls

- Uploading only 6.9" and missing the required medium Dynamic Island slot.
- PNGs exported with an alpha channel (common from design tools and headless browsers with transparent backgrounds — always set an opaque body background).
- Using the 6.9" 1320×2868 image on Play: its aspect ratio exceeds Play's 2:1 limit; render a Play-specific size.
- iPad screenshots for an iPhone-only app (not needed) — or missing them when the app does run on iPad.
- A frame showing a settings row or result the app does not have.
- Headline translated but the capture still in English.
