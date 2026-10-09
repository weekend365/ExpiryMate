import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Mask, Path, Pattern, Rect } from "react-native-svg";
import {
  crayonCardDecoration,
  crayonMascotDecoration as tokens,
  type CrayonMascotPoint,
} from "@expirymate/shared";
import { useResponsiveLayout } from "../shared/responsive-layout";

// Fixed corner paths stay clear of the v18 empty/happy character and its props.
const paths: Record<CrayonMascotPoint, string[]> = {
  welcome: [
    "M 54 5 Q 56 3.7 58 2.8 M 57 9 Q 59.3 8.8 61 8",
    "M 54 54 Q 55.7 55.2 57 57",
  ],
  celebrate: [
    "M 55 2 Q 55.4 4.5 58 5 Q 55.6 5.7 55 8 Q 54.4 5.6 52 5 Q 54.3 4.4 55 2 Z",
    "M 55 53 Q 55.4 55 58 56 Q 55.8 56.7 55 59 Q 54.4 57 52 56 Q 54.2 55.3 55 53 Z",
  ],
};

/** Static, opt-in symbols around the existing image; no animation or interaction. */
export function CrayonMascotDecoration({ point }: { point: CrayonMascotPoint }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const { isLargeText } = useResponsiveLayout();
  if (isLargeText) return null;
  const patternId = `mascot-crayon-grain-${id}`;
  const maskId = `mascot-crayon-mask-${id}`;
  const grain = crayonCardDecoration.grain;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${tokens.canvasSize} ${tokens.canvasSize}`}>
        <Defs>
          <Pattern id={patternId} width={grain.width} height={grain.height} patternUnits="userSpaceOnUse">
            <Rect width={grain.width} height={grain.height} fill={grain.base} />
            {grain.dots.map((dot, index) => (
              <Circle key={index} cx={dot.x} cy={dot.y} r={dot.radius} fill={dot.fill} />
            ))}
          </Pattern>
          <Mask id={maskId} x={0} y={0} width={tokens.canvasSize} height={tokens.canvasSize} maskUnits="userSpaceOnUse" maskType="luminance">
            <Rect width={tokens.canvasSize} height={tokens.canvasSize} fill={`url(#${patternId})`} />
          </Mask>
        </Defs>
        <G fill="none" stroke={tokens.color} strokeWidth={tokens.strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={tokens.opacity} mask={`url(#${maskId})`}>
          {paths[point].map((d, index) => <Path key={index} d={d} />)}
        </G>
      </Svg>
    </View>
  );
}
