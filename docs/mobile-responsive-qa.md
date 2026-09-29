---
status: active
owner: mobile-design
last_reviewed: 2026-09-29
source_of_truth: true
---

# Mobile responsive QA matrix (Android font / display size)

Use an Android emulator or device. Settings path: **설정 → 디스플레이 → 글자 크기 / 표시 크기** (wording varies by OEM).

## Scale presets

| Preset | How to set |
| --- | --- |
| Default | Font size default, display size default |
| Font 1.3 | Font size one step above default (≈ `fontScale` 1.3) |
| Font max | Largest system font (expect capped at body / heading 2×, chrome 1.3×) |
| Display large | Display size enlarged (effective width shrinks; stacking should kick in ≤ 400pt) |

Automated Android profiles pair these presets as follows:

| Profile | Window / density | Font scale | Navigation |
| --- | --- | --- | --- |
| `small-three-button` | 720×1280 / 320 dpi | 1.0 | Three button |
| `modern-gesture` | 824×1830 / 320 dpi | 1.0 | Gesture |
| `small-large-text` | 720×1280 / 320 dpi | 2.0 | Three button |
| `large-display-large-text` | 824×1830 / 420 dpi | 2.0 | Gesture |
| `tablet-landscape` | 1600×1200 / 240 dpi | 1.0 | Gesture, sw600dp landscape |
| `foldable-portrait` | 1600×2560 / 240 dpi | 1.0 | Gesture, unfolded sw600dp portrait |

## Checklist

Mark each cell pass/fail after a visual pass (no clip, no overlap, primary CTA reachable, keyboard does not cover sticky footer).

| Screen / surface | Default | Font 1.3 | Font max | Display large |
| --- | --- | --- | --- | --- |
| Tab bar (labels remain visible; `minHeight` expands) | | | | |
| Home traffic lamps (`StatCard` traffic) | | | | |
| Inventory filters / search / swipe delete | | | | |
| Register StepFlow + summary rows | | | | |
| Scanner overlays + date / name fields | | | | |
| Login `EmailDomainInput` + password | | | | |
| BottomSheet + keyboard (date picker, space switcher) | | | | |
| Shopping list / completed items / add form / related product tab | | | | |
| Notification permission state / grouped delivery / time inputs | | | | |
| Opened date / check date / clear actions in expiry step | | | | |
| Space and item activity history / pagination | | | | |

## Expected policy

- Body / inputs scale up to **2×**
- Headings scale up to **2×** and downshift one type-ramp step at large text
- Chrome (tabs, badges, stepper ±, D-day) up to **1.3×**
- `fontScale ≥ 1.15` stacks dense toolbars/summary rows (`shouldStackDense`)
- `fontScale ≥ 1.3` or width `< 400` stacks general rows (`shouldStack`) and downshifts title variants

## Design token policy

- Product colors use semantic `colors` tokens; provider branding uses `oauthBrand` tokens.
- Text hierarchy uses `AppText` `variant` / `tone` instead of local numeric metrics or weights.
- Layout spacing and corner radii use `spacing` / `radius` tokens.

## Automated coverage

```bash
pnpm --filter @expirymate/mobile exec vitest run \
  src/shared/responsive-layout.test.ts \
  src/shared/font-scale.test.ts \
  src/shared/dynamic-type-contract.test.ts \
  src/shared/design-token-contract.test.ts
```

The `mobile-layout` CI matrix captures one canonical state for every user-facing
route plus the additional flow states declared in
`apps/mobile/scripts/layout-screenshot-manifest.mjs`. Pull requests compare them
with the latest successful `main` artifacts and upload current, baseline, diff,
JUnit, and JSON comparison evidence.

## Google Scanner manifest note

`expo-camera` currently packages Google Code Scanner's delegate activity. The
delegate's portrait declaration is vendor-owned, so this project intentionally
does not override it with a manifest merge rule. Revisit it after an upstream
`expo-camera` or Google Code Scanner update, while keeping the large-screen
profiles above as the compatibility check.

## Google Play release quality checks

- Android release builds enable R8 minification and resource shrinking through
  `expo-build-properties` in `apps/mobile/app.json`. The
  `with-android-release-optimization` config plugin selects
  `proguard-android-optimize.txt` during Prebuild; the SDK 54 template's legacy
  default disables code optimization. Do not edit generated Android files.
- After a release build, retain `app/build/outputs/mapping/release/mapping.txt`
  for crash deobfuscation and inspect `configuration.txt` for global
  `-dontoptimize`, `-dontshrink`, or `-dontobfuscate` rules. Exercise login,
  camera/OCR, notifications, ads, purchase and restore on the optimized build.
- Play Console's affected bundle details remain the acceptance check for DEX
  optimization, shrinking and obfuscation percentages. Enabling R8 alone does
  not prove that all three reach the 25% threshold.
- SDK 54 already enables edge-to-edge. The app does not request a navigation bar
  background color; test both gesture and three-button navigation with safe
  areas and keyboard visible. Deprecated calls can still exist in native
  dependencies (including `react-native-screens`); match the exact classes in
  Play Console to the dependency before choosing an upgrade.
- The main activity uses unrestricted orientation. Recheck the final merged
  manifest for library activities as well as the tablet/foldable profiles above.
  Do not force a vendor scanner activity into an unsupported orientation.

References: [Expo SDK 54 build properties](https://docs.expo.dev/versions/v54.0.0/sdk/build-properties/),
[Android R8 setup](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization),
[Google Play technical quality requirements](https://support.google.com/googleplay/android-developer/answer/17492799).

## 2026-09-29 feature verification

The shopping tab now starts on the persisted list; the smoke flow explicitly
opens the related products tab before searching. The manifest also includes
`inventory-activity.png` and `inventory-opened.png`. The seed supplies an opened
milk item with a stable ID and sample activity records.

Android native verification passed on an API 33 ARM64 debug emulator with
Maestro 2.10.0 for `small-three-button`, `small-large-text` (font scale 2.0), and
`tablet-landscape`. The feature pass covered the shopping list, add form and
keyboard, notification permission state and delivery-time field, expiry/opened
fields and clear actions, activity history, and the inventory history entry.
This is a focused feature pass, not a completed full-route matrix above.

The pass found and fixed two layout issues: modal sheets now shrink within the
keyboard's available height and respect the top safe area; stacked step headers
stretch their guide card so its copy remains visible on compact screens.
The login smoke flow now expands the email section and uses the current single
email field. Activity captures wait for the initial data load.

There are 27 current feature captures and 12 before/after comparison pairs
against `b730753`. Local artifacts are under
`apps/mobile/e2e/screenshots/{current,baseline,diff}/feature-update/`; flow logs,
capture flows, and `comparison.json` are under
`apps/mobile/e2e/results/feature-update/`. Differences for the new default list,
notification controls, activity entry, and corrected guide width were reviewed
as intentional. Raw pixel differences also include system chrome, image loading,
and refresh indicators; they are evidence, not a zero-diff CI pass. No canonical
baseline or visual-approval bypass was used. Preserve the intentional layout
change review requirement when preparing a PR.

The debug APK built with installed NDK 28.2 through a temporary local Gradle
override; repository native configuration was not changed. Current and baseline
JavaScript ran from separate temporary source copies without environment files,
against an isolated local API and PostgreSQL database. The emulator has no Play
Store billing connection; only the known Expo-IAP development overlay was hidden
in the temporary entry point. This pass does not verify purchases, actual push
delivery, or the optimized release build. iOS simulator verification remains
unavailable because the local Xcode license has not been accepted.

Validation also passed: 1,170 general tests, four opt-in PostgreSQL integration
tests, authenticated HTTP workflow checks, and 50 related tests after the layout
fixes. Lint/design-token checks and type checking passed after the final UI changes.
