import { Platform, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../shared/theme";
import { AppText } from "./AppText";

interface StatCardProps {
  label: string;
  value: number;
  tone?: "default" | "warning" | "danger" | "success";
  /**
   * `inline` = open metric strip.
   * `card` = bordered tile.
   * `traffic` = circular lamp for signal-light strips (on when value > 0).
   */
  variant?: "card" | "inline" | "traffic";
  /** When false, traffic variant renders lamp only (labels live outside the housing). */
  showLabel?: boolean;
}

const LAMP_SIZE = spacing.xxl + spacing.sm;
/** Dimmed fill when off — keeps hue so the bulb role is still readable. */
const OFF_FILL_OPACITY = 0.28;

export function StatCard({
  label,
  value,
  tone = "default",
  variant = "card",
  showLabel = true,
}: StatCardProps) {
  if (variant === "traffic") {
    const isOn = value > 0;
    const lampTone = tone === "default" ? "success" : tone;
    const lampStyle = trafficLamps[lampTone];

    return (
      <View
        style={styles.traffic}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${label} ${value}개`}
      >
        <View
          style={[
            styles.lamp,
            isOn && {
              shadowColor: lampStyle.glow,
              ...styles.lampGlow,
            },
          ]}
        >
          {/* Color disc: full when on, same hue dimmed when off */}
          <View
            pointerEvents="none"
            style={[
              styles.lampFill,
              {
                backgroundColor: lampStyle.onBackground,
                opacity: isOn ? 1 : OFF_FILL_OPACITY,
              },
            ]}
          />
          <AppText
            variant="heading"
            style={{
              color: isOn ? lampStyle.onText : lampStyle.onBackground,
            }}
          >
            {value}
          </AppText>
        </View>
        {showLabel ? (
          <AppText
            variant="caption"
            style={styles.trafficLabel}
            numberOfLines={1}
          >
            {label}
          </AppText>
        ) : null}
      </View>
    );
  }

  const toneStyle = tones[tone];
  const isInline = variant === "inline";

  return (
    <View
      style={[
        isInline ? styles.inline : styles.card,
        !isInline && {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
      ]}
    >
      <AppText
        variant={isInline ? "heading" : "display"}
        style={{ color: toneStyle.valueColor }}
      >
        {value}
      </AppText>
      <AppText
        variant={isInline ? "caption" : "bodySmall"}
        tone="subtext"
        style={!isInline ? { color: toneStyle.labelColor } : undefined}
      >
        {label}
      </AppText>
    </View>
  );
}

const tones = {
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    valueColor: colors.text,
    labelColor: colors.subtext,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
    valueColor: colors.warning,
    labelColor: colors.subtext,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
    valueColor: colors.danger,
    labelColor: colors.subtext,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
    valueColor: colors.success,
    labelColor: colors.subtext,
  },
};

const trafficLamps = {
  danger: {
    onBackground: colors.danger,
    onText: colors.surface,
    glow: colors.danger,
  },
  warning: {
    onBackground: colors.warning,
    onText: colors.surface,
    glow: colors.warning,
  },
  success: {
    onBackground: colors.success,
    onText: colors.surface,
    glow: colors.success,
  },
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.xxl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: spacing.xxxl + spacing.xl,
  },
  inline: {
    flex: 1,
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    alignItems: "flex-start",
  },
  traffic: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
  },
  lamp: {
    width: LAMP_SIZE,
    height: LAMP_SIZE,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  lampFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
  },
  lampGlow: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: spacing.sm,
    ...Platform.select({
      android: { elevation: 6 },
      default: {},
    }),
  },
  trafficLabel: {
    color: colors.subtext,
    textAlign: "center",
  },
});
