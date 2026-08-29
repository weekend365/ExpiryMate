import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "../shared/theme";

export type ExpiryTrafficTone = "danger" | "warning" | "success";

interface ExpiryTrafficIconProps {
  size: number;
  tone: ExpiryTrafficTone;
  active: boolean;
}

const VIEWBOX_SIZE = 64;
const INACTIVE_OPACITY = 0.3;

const trafficLamps: Record<
  ExpiryTrafficTone,
  { fill: string; glyph: string }
> = {
  danger: {
    fill: colors.citrusGrapefruit,
    glyph: colors.surface,
  },
  warning: {
    fill: colors.citrusLemon,
    glyph: colors.text,
  },
  success: {
    fill: colors.citrusLime,
    glyph: colors.surface,
  },
};

/**
 * Flat citrus status lamp used by the home summary and inventory filters.
 *
 * The dark outer ring makes the signal metaphor readable at small sizes,
 * while the state glyph keeps the UI understandable without color alone.
 */
export function ExpiryTrafficIcon({
  size,
  tone,
  active,
}: ExpiryTrafficIconProps) {
  const lamp = trafficLamps[tone];
  const glyphColor = active ? lamp.glyph : colors.subtext;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Circle cx="32" cy="32" r="30" fill={colors.text} />
      <Circle cx="32" cy="32" r="24" fill={colors.insetSurface} />
      <Circle
        cx="32"
        cy="32"
        r="18"
        fill={lamp.fill}
        opacity={active ? 1 : INACTIVE_OPACITY}
      />
      <Path
        d="M22.5 23.5c2.8-4.2 7-6.5 11.7-6.5"
        fill="none"
        stroke={colors.surface}
        strokeLinecap="round"
        strokeWidth="3"
        opacity={active ? 0.58 : 0.18}
      />
      <StatusGlyph tone={tone} color={glyphColor} />
    </Svg>
  );
}

function StatusGlyph({
  tone,
  color,
}: {
  tone: ExpiryTrafficTone;
  color: string;
}) {
  if (tone === "danger") {
    return (
      <>
        <Path
          d="M32 21.5v17"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth="4"
        />
        <Circle cx="32" cy="43.5" r="2.25" fill={color} />
      </>
    );
  }

  if (tone === "warning") {
    return (
      <>
        <Circle
          cx="32"
          cy="32"
          r="10.5"
          fill="none"
          stroke={color}
          strokeWidth="3"
        />
        <Path
          d="M32 25.5v7l4.7 3"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </>
    );
  }

  return (
    <Path
      d="m22.5 32.5 6.2 6.2 12.8-14"
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="4"
    />
  );
}
