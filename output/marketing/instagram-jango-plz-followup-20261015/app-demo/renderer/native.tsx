import React, { forwardRef } from 'react';
import * as Web from 'react-native-web';
export * from 'react-native-web';
const params = new URLSearchParams(location.search);
const scale = Number(params.get('font') || 1);
export function useWindowDimensions() {
  const actual = Web.useWindowDimensions();
  return { ...actual, width: Number(params.get('width') || actual.width), fontScale: scale };
}
export const Text = forwardRef(({ style, maxFontSizeMultiplier, allowFontScaling, ...props }: any, ref) => {
  const flat = Web.StyleSheet.flatten(style) || {};
  const factor = allowFontScaling === false ? 1 : Math.min(scale, maxFontSizeMultiplier || scale);
  return <Web.Text {...props} ref={ref} style={[style, {
    ...(flat.fontSize && { fontSize: flat.fontSize * factor }),
    ...(flat.lineHeight && { lineHeight: flat.lineHeight * factor }),
  }]} />;
});
