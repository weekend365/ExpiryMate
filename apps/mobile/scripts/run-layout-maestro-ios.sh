#!/usr/bin/env bash
set -euo pipefail

profile="${1:-ios-small}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mobile_dir="$(cd "$script_dir/.." && pwd)"
screenshot_dir="$mobile_dir/e2e/screenshots/current/$profile"
result_dir="$mobile_dir/e2e/results/$profile"

cleanup() {
  "$script_dir/configure-ios-layout-profile.sh" reset >/dev/null 2>&1 || true
}
trap cleanup EXIT

command -v xcrun >/dev/null || {
  echo "Xcode command-line tools are required for iOS layout E2E." >&2
  exit 1
}
command -v maestro >/dev/null || {
  echo "Maestro is required: https://maestro.mobile.dev/getting-started/installing-maestro" >&2
  exit 1
}

mkdir -p "$screenshot_dir" "$result_dir"
find "$screenshot_dir" -maxdepth 1 -type f -name '*.png' -delete

"$script_dir/configure-ios-layout-profile.sh" "$profile"

cd "$mobile_dir"

SCREENSHOT_DIR="e2e/screenshots/current/$profile" \
LAYOUT_PROFILE="$profile" \
maestro test \
  "$mobile_dir/.maestro/layout-smoke.yaml" \
  --format junit \
  --output "$result_dir/junit.xml" \
  --test-output-dir "$result_dir/artifacts"

node "$script_dir/compare-layout-screenshots.mjs" "$profile"
