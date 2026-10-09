/* global window, URLSearchParams */
// Review-only web bridge. Browser text scaling is a projection, not native QA.
import React from "react";
import * as NativeWeb from "review-native-web";
export * from "review-native-web";

const fontScale = Number(new URLSearchParams(window.location.search).get("scale") || 1);
export function useWindowDimensions() {
  return { ...NativeWeb.useWindowDimensions(), fontScale };
}

export const View = React.forwardRef(function ReviewView({ accessibilityElementsHidden, importantForAccessibility, ...props }, ref) {
  const hidden = accessibilityElementsHidden || importantForAccessibility === "no-hide-descendants";
  return <NativeWeb.View {...props} ref={ref} aria-hidden={hidden || props["aria-hidden"]} />;
});

export const Text = React.forwardRef(function ReviewText({ style, allowFontScaling, maxFontSizeMultiplier, ...props }, ref) {
  const flat = NativeWeb.StyleSheet.flatten(style) || {};
  const scale = allowFontScaling === false ? 1 : Math.min(fontScale, maxFontSizeMultiplier || 2);
  return <NativeWeb.Text {...props} ref={ref} style={[style, {
    ...(flat.fontSize ? { fontSize: flat.fontSize * scale } : {}),
    ...(flat.lineHeight ? { lineHeight: flat.lineHeight * scale } : {}),
  }]} />;
});
