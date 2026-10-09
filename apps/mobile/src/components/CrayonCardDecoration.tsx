import { useId, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, G, Mask, Path, Pattern, Rect } from "react-native-svg";
import {
  crayonCardDecoration as tokens,
  type SurfaceTone,
} from "@expirymate/shared";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { getCrayonCardGeometry } from "./crayon-card-geometry";

/** Absolute, static, noninteractive layer; never participates in the card's layout. */
export function CrayonCardDecoration({ tone }: { tone: SurfaceTone }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const patternId = `crayon-grain-${id}`;
  const maskId = `crayon-mask-${id}`;
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { isLargeText } = useResponsiveLayout();
  const geometry = getCrayonCardGeometry(size.width, size.height);
  const color = tokens.colors[tone];

  function onLayout({ nativeEvent: { layout } }: LayoutChangeEvent) {
    setSize((previous) =>
      previous.width === layout.width && previous.height === layout.height
        ? previous
        : { width: layout.width, height: layout.height },
    );
  }

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {geometry && (
        <Svg
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
        >
          <Defs>
            <Pattern
              id={patternId}
              width={tokens.grain.width}
              height={tokens.grain.height}
              patternUnits="userSpaceOnUse"
            >
              <Rect
                width={tokens.grain.width}
                height={tokens.grain.height}
                fill={tokens.grain.base}
              />
              {tokens.grain.dots.map((dot, index) => (
                <Circle key={index} cx={dot.x} cy={dot.y} r={dot.radius} fill={dot.fill} />
              ))}
            </Pattern>
            <Mask
              id={maskId}
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              maskUnits="userSpaceOnUse"
              maskType="luminance"
            >
              <Rect width={size.width} height={size.height} fill={`url(#${patternId})`} />
            </Mask>
          </Defs>
          <Path
            d={geometry.outline}
            fill="none"
            stroke={color.outline}
            strokeWidth={tokens.outline.width}
            strokeLinecap="round"
            opacity={tokens.outline.opacity}
            mask={`url(#${maskId})`}
          />
          {!isLargeText && color.accent && (
            <G stroke={color.accent} strokeLinecap="round" opacity={tokens.accent.opacity} fill="none">
              {geometry.accents.map((d, index) => (
                <Path key={index} d={d} strokeWidth={tokens.accent.widths[index]} />
              ))}
            </G>
          )}
        </Svg>
      )}
    </View>
  );
}
