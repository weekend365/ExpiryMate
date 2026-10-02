import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, radius } from "../shared/theme";

const OUTSET = 18;
const INSET = 1.5;

/** A stable speech shape with restrained pigment on its outline. */
export const CrayonSpeechBubbleArt = memo(function CrayonSpeechBubbleArt({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  if (width < 48 || height < 40) return null;

  const right = width - INSET;
  const bottom = height - INSET;
  const corner = Math.min(radius.xxl - INSET, width / 4, height / 3);
  const tailHalfHeight = Math.min(10, Math.max(3, (height - corner * 2) / 3));
  const tailCenter = Math.max(
    corner + tailHalfHeight,
    Math.min(height - 40, height - corner - tailHalfHeight),
  );
  const outline = [
    `M ${INSET + corner} ${INSET}`,
    `H ${right - corner}`,
    `Q ${right} ${INSET} ${right} ${INSET + corner}`,
    `V ${bottom - corner}`,
    `Q ${right} ${bottom} ${right - corner} ${bottom}`,
    `H ${INSET + corner}`,
    `Q ${INSET} ${bottom} ${INSET} ${bottom - corner}`,
    `V ${tailCenter + tailHalfHeight}`,
    `L ${-OUTSET + 2} ${tailCenter}`,
    `L ${INSET} ${tailCenter - tailHalfHeight}`,
    `V ${INSET + corner}`,
    `Q ${INSET} ${INSET} ${INSET + corner} ${INSET}`,
    "Z",
  ].join(" ");

  return (
    <View
      pointerEvents="none"
      style={[styles.frame, { width: width + OUTSET, height }]}
    >
      <Svg
        width={width + OUTSET}
        height={height}
        viewBox={`${-OUTSET} 0 ${width + OUTSET} ${height}`}
      >
        <Path
          d={outline}
          fill={colors.surfaceWarm}
          stroke={colors.brandSketchLine}
          strokeWidth={1.45}
          strokeLinejoin="round"
          strokeOpacity={0.62}
        />
        <Path
          d={outline}
          fill="none"
          stroke={colors.brandSketchLine}
          strokeWidth={1.85}
          strokeLinecap="round"
          strokeDasharray="8 3 13 1 6 2 17 4 5 1"
          strokeOpacity={0.18}
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    position: "absolute",
    top: 0,
    left: -OUTSET,
  },
});
