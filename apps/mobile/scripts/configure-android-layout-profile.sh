#!/usr/bin/env bash
set -euo pipefail

profile="${1:-small-three-button}"

case "$profile" in
  small-three-button)
    size="720x1280"
    density="320"
    font_scale="1.0"
    navigation_overlay="com.android.internal.systemui.navbar.threebutton"
    rotation="0"
    ;;
  modern-gesture)
    size="824x1830"
    density="320"
    font_scale="1.0"
    navigation_overlay="com.android.internal.systemui.navbar.gestural"
    rotation="0"
    ;;
  small-large-text)
    size="720x1280"
    density="320"
    font_scale="2.0"
    navigation_overlay="com.android.internal.systemui.navbar.threebutton"
    rotation="0"
    ;;
  large-display-large-text)
    size="824x1830"
    density="420"
    font_scale="2.0"
    navigation_overlay="com.android.internal.systemui.navbar.gestural"
    rotation="0"
    ;;
  tablet-landscape)
    # wm size is expressed in the emulator's natural (portrait) orientation;
    # rotation=1 makes the captured frame 1600x1200 landscape.
    size="1200x1600"
    density="240"
    font_scale="1.0"
    navigation_overlay="com.android.internal.systemui.navbar.gestural"
    rotation="1"
    ;;
  foldable-portrait)
    size="1600x2560"
    density="240"
    font_scale="1.0"
    navigation_overlay="com.android.internal.systemui.navbar.gestural"
    rotation="0"
    ;;
  reset)
    adb shell wm size reset
    adb shell wm density reset
    adb shell settings delete system font_scale
    adb shell settings delete system accelerometer_rotation
    adb shell settings delete system user_rotation
    exit 0
    ;;
  *)
    echo "Unknown layout profile: $profile" >&2
    exit 2
    ;;
esac

adb wait-for-device
adb shell wm size "$size"
adb shell wm density "$density"
adb shell settings put system font_scale "$font_scale"
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation "$rotation"
adb shell cmd overlay enable-exclusive --category --user 0 "$navigation_overlay"
adb shell settings put global window_animation_scale 0
adb shell settings put global transition_animation_scale 0
adb shell settings put global animator_duration_scale 0

# Freeze status-bar values so screenshot diffs are deterministic. Keep the
# bottom system navigation area visible because it is part of this regression.
adb shell settings put global sysui_demo_allowed 1
adb shell am broadcast \
  -a com.android.systemui.demo \
  -e command clock \
  -e hhmm 1000 >/dev/null
adb shell am broadcast \
  -a com.android.systemui.demo \
  -e command battery \
  -e level 100 \
  -e plugged false >/dev/null

adb shell am force-stop com.expirymate.mobile >/dev/null 2>&1 || true
echo "Configured $profile ($size @ ${density}dpi, font scale $font_scale)"
