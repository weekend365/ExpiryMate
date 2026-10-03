import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { getCrayonSpeechBubbleGeometry } from "../shared/crayon-speech-bubble";
import { colors, crayonSpeechBubble } from "../shared/theme";

/** A stable speech shape with restrained pigment on its outline. */
export const CrayonSpeechBubbleArt = memo(function CrayonSpeechBubbleArt({
  width,
  height,
  density = "default",
}: {
  width: number;
  height: number;
  density?: "default" | "compact";
}) {
  const geometry = getCrayonSpeechBubbleGeometry({ width, height, density });
  if (!geometry) return null;
  const { outline, outset } = geometry;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { left: -outset, width: width + outset, height }]}
    >
      <Svg
        accessible={false}
        width={width + outset}
        height={height}
        viewBox={`${-outset} 0 ${width + outset} ${height}`}
      >
        <Path
          d={outline}
          fill={colors.surfaceWarm}
          stroke={colors.brandSketchLine}
          strokeWidth={crayonSpeechBubble.strokeWidth}
          strokeLinejoin="round"
          strokeOpacity={crayonSpeechBubble.strokeOpacity}
        />
        <Path
          d={outline}
          fill="none"
          stroke={colors.brandSketchLine}
          strokeWidth={crayonSpeechBubble.grainStrokeWidth}
          strokeLinecap="round"
          strokeDasharray={crayonSpeechBubble.grainDashArray}
          strokeOpacity={crayonSpeechBubble.grainStrokeOpacity}
        />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  frame: {
    position: "absolute",
    top: 0,
  },
});
