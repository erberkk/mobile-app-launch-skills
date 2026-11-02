# Device matrix

Checked against [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications) and [Google Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151) on 2026-11-02. Re-check before each release; new devices add new slots.

## Apple

| Slot | Portrait px | Logical size × scale (for the capture harness) | Notes |
|---|---|---|---|
| iPhone, large Dynamic Island ("6.9-inch") | 1320×2868 | 440×956 @3x | Also accepted: 1290×2796 (430×932 @3x), 1260×2736 (420×912 @3x) |
| iPhone, medium Dynamic Island | 1206×2622 | 402×874 @3x | **At least one iPhone screenshot here is required.** Also accepted: 1179×2556 (393×852 @3x) |
| iPhone Duo, outer display | 1398×2034 | Read the logical size and scale from the simulator | Required starting April 2027 for apps using the iOS 27.1 SDK or later; shows the "optimized for iPhone Duo" badge |
| iPhone Duo, inner display | 2007×2853 | Read from the simulator | Same requirement as outer |
| iPad 13-inch | 2064×2752 | 1032×1376 @2x | Required if the app runs on iPad. Also accepted: 2048×2732 (1024×1366 @2x) |

- Landscape variants are the same sizes rotated.
- 1–10 screenshots per slot, `.png`/`.jpg`/`.jpeg`, no alpha or transparency.
- Smaller iPhone and iPad slots are filled by scaling from the larger sets when not provided.
- API `screenshotDisplayType` values (for example `APP_IPHONE_67`, `APP_IPHONE_61`, `APP_IPAD_PRO_3GEN_129`) do not always match marketing names, and new devices add new values. List the enum in the current App Store Connect API reference (`ScreenshotDisplayType`) and map each slot before uploading.
- An iPhone-only app runs on iPad in compatibility mode but needs no iPad screenshots.

## Google Play

| Asset | Size | Notes |
|---|---|---|
| Phone screenshots | Each side 320–3840 px; long side ≤ 2× short side | 2–8; ≥ 4 at ≥ 1080 px (e.g. 1080×1920) recommended for promotion eligibility. 1080×2160 is exactly 2:1 and accepted; 1320×2868 is not |
| 7-inch tablet screenshots | 1080–7680 px, 9:16 or 16:9 | API image type `sevenInchScreenshots` |
| 10-inch tablet screenshots | 1080–7680 px, 9:16 or 16:9 | API image type `tenInchScreenshots` |
| Feature graphic | 1024×500 | JPEG or 24-bit PNG, no alpha. API `featureGraphic` |
| App icon | 512×512 | 32-bit PNG (alpha allowed), ≤ 1024 KB. API `icon` |

Screenshots: JPEG or 24-bit PNG, no alpha.

## Suggested output folders

```
out/<locale>/ios-69/01.png ...          1320x2868
out/<locale>/ios-61/01.png ...          1206x2622
out/<locale>/ios-duo-outer/01.png ...   1398x2034
out/<locale>/ios-duo-inner/01.png ...   2007x2853
out/<locale>/ipad-13/01.png ...         2064x2752   (only if the app runs on iPad)
out/<locale>/play-phone/01.png ...      1080x2160
out/<locale>/play-tablet-7/01.png ...   1080x1920
out/<locale>/play-tablet-10/01.png ...  1440x2560
out/<locale>/play-feature.png           1024x500
```

`scripts/check-images.mjs` reads these folder names to know the expected size.
