---
status: active
owner: mobile-design
last_reviewed: 2026-08-25
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

The `mobile-layout` CI matrix captures eight critical states for each profile.
Pull requests compare them with the latest successful `main` artifacts and
upload current, baseline, diff, JUnit, and JSON comparison evidence.

## Google Scanner manifest note

`expo-camera` currently packages Google Code Scanner's delegate activity. The
delegate's portrait declaration is vendor-owned, so this project intentionally
does not override it with a manifest merge rule. Revisit it after an upstream
`expo-camera` or Google Code Scanner update, while keeping the large-screen
profiles above as the compatibility check.
