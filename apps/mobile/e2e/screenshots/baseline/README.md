# Layout screenshot baselines

CI treats the captures from the latest successful `main` workflow as the
canonical visual baseline:

1. A `main` push runs every Android layout profile and uploads its current
   captures in the `mobile-layout-<profile>` artifact.
2. A pull request downloads those captures into this directory and compares
   its own screenshots strictly (maximum changed-pixel ratio: 0.5%).
3. Current, baseline, diff, JUnit, and `visual-comparison.json` files are
   uploaded together so reviewers can inspect any failure.

Baseline PNGs are generated artifacts and are intentionally gitignored. The
`large-display-large-text` profile may bootstrap once when an older `main` run
does not yet contain that new artifact; after the next `main` run it becomes
strict like the other profiles.

For an intentional visual change, add the
`approve-mobile-layout-change` pull-request label only after reviewing every
profile artifact. The label keeps producing diff evidence but allows the PR to
pass; the subsequent `main` run publishes the approved captures as the next
baseline.

## Local comparison

After starting the local API and installing the release app:

```bash
ALLOW_MISSING_SCREENSHOT_BASELINES=1 \
  pnpm --filter @expirymate/mobile e2e:layout -- small-three-button
pnpm --filter @expirymate/mobile screenshots:update -- small-three-button
pnpm --filter @expirymate/mobile e2e:layout -- small-three-button
```

Repeat for `modern-gesture`, `small-large-text`, and
`large-display-large-text`. Local baseline PNGs remain untracked.
