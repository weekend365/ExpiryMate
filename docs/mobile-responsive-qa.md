# Mobile responsive QA matrix (Android font / display size)

Use an Android emulator or device. Settings path: **설정 → 디스플레이 → 글자 크기 / 표시 크기** (wording varies by OEM).

## Scale presets

| Preset | How to set |
| --- | --- |
| Default | Font size default, display size default |
| Font 1.3 | Font size one step above default (≈ `fontScale` 1.3) |
| Font max | Largest system font (expect capped at body / heading 2×, chrome 1.3×) |
| Display large | Display size enlarged (effective width shrinks; stacking should kick in ≤ 400pt) |

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
