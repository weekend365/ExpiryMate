#!/usr/bin/env bash
set -euo pipefail

profile="${1:-ios-small}"
device="${IOS_SIMULATOR_UDID:-booted}"

case "$profile" in
  ios-small)
    content_size="large"
    ;;
  ios-small-large-text)
    content_size="accessibility-extra-extra-extra-large"
    ;;
  reset)
    xcrun simctl ui "$device" content_size large >/dev/null 2>&1 || true
    xcrun simctl status_bar "$device" clear >/dev/null 2>&1 || true
    exit 0
    ;;
  *)
    echo "Unknown iOS layout profile: $profile" >&2
    exit 2
    ;;
esac

xcrun simctl bootstatus "$device" -b
xcrun simctl ui "$device" content_size "$content_size"
xcrun simctl status_bar "$device" override \
  --time "10:00" \
  --batteryState charged \
  --batteryLevel 100 \
  --wifiBars 3 \
  --cellularBars 4 >/dev/null
xcrun simctl terminate "$device" com.expirymate.mobile >/dev/null 2>&1 || true

echo "Configured $profile (Dynamic Type: $content_size)"
