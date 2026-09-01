import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "../shared/theme";

export type ExpiryTrafficTone =
  | "unknown"
  | "danger"
  | "warning"
  | "success";

interface ExpiryTrafficIconProps {
  size: number;
  tone: ExpiryTrafficTone;
  active: boolean;
  selected?: boolean;
}

const VIEWBOX_SIZE = 64;
const INACTIVE_OPACITY = 0.42;

const trafficLamps: Record<
  ExpiryTrafficTone,
  { fill: string; soft: string; foreground: string }
> = {
  unknown: {
    fill: colors.expiryUnknownAccent,
    soft: colors.expiryUnknownSoft,
    foreground: colors.expiryUnknownForeground,
  },
  danger: {
    fill: colors.expiryExpiredAccent,
    soft: colors.expiryExpiredSoft,
    foreground: colors.expiryExpiredForeground,
  },
  warning: {
    fill: colors.expiryExpiringAccent,
    soft: colors.expiryExpiringSoft,
    foreground: colors.expiryExpiringForeground,
  },
  success: {
    fill: colors.expirySafeAccent,
    soft: colors.expirySafeSoft,
    foreground: colors.expirySafeForeground,
  },
};

/**
 * Flat citrus status lamp used by the home summary and inventory filters.
 *
 * An unselected lamp keeps a soft version of its status hue; selection adds
 * the full-color outer ring. The state glyph keeps the UI understandable
 * without color alone.
 */
export function ExpiryTrafficIcon({
  size,
  tone,
  active,
  selected = false,
}: ExpiryTrafficIconProps) {
  const lamp = trafficLamps[tone];
  const glyphColor = active
    ? colors.expiryAccentForeground
    : lamp.foreground;

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <Circle
        cx="32"
        cy="32"
        r="30"
        fill={selected ? lamp.fill : lamp.soft}
      />
      <Circle cx="32" cy="32" r="24" fill={colors.surfaceWarm} />
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
  if (tone === "unknown") {
    return (
      <>
        <Path
          d="M26.5 27c.9-3.4 3.3-5.2 6.7-5.2 4.1 0 6.9 2.5 6.9 5.9 0 2.9-1.7 4.4-4.2 5.8-2.2 1.3-3 2.4-3 4.5"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.25"
        />
        <Circle cx="33.2" cy="43" r="1.8" fill={color} />
      </>
    );
  }

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
