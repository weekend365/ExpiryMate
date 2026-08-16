import { Platform, StyleSheet, View } from "react-native";
import { useResponsiveLayout } from "../shared/responsive-layout";
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
  /** Reduces traffic lamp and spacing for dense dashboard summaries. */
  compact?: boolean;
  /** Inventory-filter scale: 32px lamp, tighter padding than `compact`. */
  mini?: boolean;
  /** Controls the active lamp glow independently from its on/off fill. */
  showGlow?: boolean;
  /**
   * Traffic selection state. When set, overrides the default value>0 on/off look
   * so the lamp can act as a filter control.
   */
  selected?: boolean;
}

const LAMP_SIZE = spacing.xxl + spacing.sm;
const LAMP_SIZE_COMPACT = spacing.xxl;
const LAMP_SIZE_MINI = spacing.lg;
/** Dimmed fill when off — keeps hue so the bulb role is still readable. */
const OFF_FILL_OPACITY = 0.28;

export function StatCard({
  label,
  value,
  tone = "default",
  variant = "card",
  showLabel = true,
  compact = false,
  mini = false,
  showGlow = true,
  selected,
}: StatCardProps) {
  const { isLargeText } = useResponsiveLayout();

  if (variant === "traffic") {
    const isOn = selected ?? value > 0;
    const lampTone = tone === "default" ? "success" : tone;
    const lampStyle = trafficLamps[lampTone];
    const lampMin = mini
      ? LAMP_SIZE_MINI
      : compact
        ? LAMP_SIZE_COMPACT
        : LAMP_SIZE;

    return (
      <View
        style={[
          styles.traffic,
          compact && styles.trafficCompact,
          mini && styles.trafficMini,
        ]}
        accessible={selected == null}
        accessibilityRole="text"
        accessibilityLabel={`${label} ${value}개`}
      >
        <View
          style={[
            styles.lamp,
            mini && styles.lampMini,
            {
              minWidth: lampMin,
              minHeight: lampMin,
            },
            mini && {
              width: lampMin,
              height: lampMin,
            },
            isOn &&
              showGlow && {
                shadowColor: lampStyle.glow,
                ...(mini ? styles.lampGlowMini : styles.lampGlow),
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
            variant={
              mini
                ? "caption"
                : isLargeText
                  ? "bodySmall"
                  : compact
                    ? "subheading"
                    : "heading"
            }
            scaleRole="chrome"
            densityAware={false}
            numberOfLines={1}
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
            scaleRole="chrome"
            numberOfLines={1}
            style={styles.trafficLabel}
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
  trafficCompact: {
    gap: spacing.xxs,
  },
  trafficMini: {
    gap: spacing.xxs, // 4px between mini lamp and label
  },
  lamp: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  lampMini: {
    paddingHorizontal: spacing.xxs, // 4px so 32px circle still fits the count
    paddingVertical: 0,
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
  lampGlowMini: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: spacing.xs,
    ...Platform.select({
      android: { elevation: 2 },
      default: {},
    }),
  },
  trafficLabel: {
    color: colors.subtext,
    textAlign: "center",
    flexShrink: 1,
  },
});
