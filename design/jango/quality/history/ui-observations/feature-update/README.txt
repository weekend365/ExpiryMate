# 2026-09-29 feature verification

Current implementation: notification controls/status/digests/delivery time, shared shopping list, opened-item management, inventory activity; core monetization remains the default.

- Android API 33 ARM64 debug APK: built successfully using a temporary installed-NDK override.
- Profiles: small-three-button, small-large-text (2x), tablet-landscape.
- Current: 9 feature captures per profile (27 total).
- Baseline: commit b730753, 4 existing surfaces per profile (12 total).
- Before/after PNGs and raw pixel diff images: ../../screenshots/{current,baseline,diff}/feature-update/.
- Comparison metadata: comparison.json. Differences are intentional layout evidence, not a zero-diff CI approval.
- Keyboard clipping and collapsed compact guide width were fixed and visually rechecked. The original failing keyboard capture remains in current-small/2026-09-29_105232/.
- Full tests: 1170 passed; opt-in PostgreSQL integration: 4 passed; post-layout related tests: 50 passed.
- Lint/design checks, typecheck, docs check: passed.
- HTTP checks used the seeded local test account and an isolated API/DB. No deployment was performed.

The capture flows are stored beside this file. For Maestro 2.10, pass a relative SCREENSHOT_DIR with -e and use --test-output-dir; named screenshots are under each run's takeScreenshot folder. Wait for the app to finish starting before opening deep links. Temporary source copies had no env files, separate Metro cache versions, and a known Expo-IAP development overlay filter. UI app/source/shared files were hash-checked against the final workspace: 372 files, zero mismatches.

iOS simulator checks were blocked by the unaccepted Xcode license. Real push delivery, Play Store purchase/restore, optimized release builds, and the full repository route matrix are outside this focused local pass.
