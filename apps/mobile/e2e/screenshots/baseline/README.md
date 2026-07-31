# Layout screenshot baselines

Generate deterministic Android screenshots after starting the local API and
installing the release app:

```bash
ALLOW_MISSING_SCREENSHOT_BASELINES=1 \
  pnpm --filter @expirymate/mobile e2e:layout -- small-three-button
pnpm --filter @expirymate/mobile screenshots:update -- small-three-button
```

Repeat for `modern-gesture` and `small-large-text`. Commit the PNGs under each
profile directory. Current and diff images are CI artifacts and remain ignored.

The flow itself is cross-platform. With the iOS release candidate installed in
a booted simulator, run it from `apps/mobile` with:

```bash
SCREENSHOT_DIR=e2e/screenshots/current/ios-small \
  maestro test .maestro/layout-smoke.yaml
```
