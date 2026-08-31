import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors, radius, spacing } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { AppText } from "./AppText";
import {
  ExpiryTrafficIcon,
  type ExpiryTrafficTone,
} from "./ExpiryTrafficIcon";

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  tone?: "default" | "unknown" | "warning" | "danger" | "success";
  /**
   * `inline` = open metric strip.
   * `card` = bordered tile.
   * `traffic` = citrus lamp for expiry strips (on when value > 0).
   */
  variant?: "card" | "inline" | "traffic";
  /** When false, traffic variant renders the lamp only. */
  showLabel?: boolean;
  /** Reduces traffic lamp and spacing for dense dashboard summaries. */
  compact?: boolean;
  /** Inventory-filter scale: 32px lamp, tighter padding than `compact`. */
  mini?: boolean;
  /** Controls the active lamp glow independently from its on/off fill. */
  showGlow?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Traffic selection state. When set, overrides the default value>0 on/off look
   * so the lamp can act as a filter control.
   */
  selected?: boolean;
}

const LAMP_SIZE = spacing.xxl + spacing.sm;
const LAMP_SIZE_COMPACT = spacing.xxl;
const LAMP_SIZE_MINI = spacing.lg;

export function StatCard({
  label,
  value,
  suffix,
  tone = "default",
  variant = "card",
  showLabel = true,
  compact = false,
  mini = false,
  showGlow = true,
  style,
  selected,
}: StatCardProps) {
  const { shouldStack } = useResponsiveLayout();

  if (variant === "traffic") {
    const isOn = selected ?? value > 0;
    const lampTone = tone === "default" ? "success" : tone;
    const lampStyle = trafficLamps[lampTone];
    const lampMin = mini
      ? LAMP_SIZE_MINI
      : compact
        ? LAMP_SIZE_COMPACT
        : LAMP_SIZE;
    const countLabel = `${label} ${value}건`;

    return (
      <View
        style={[
          styles.traffic,
          compact && styles.trafficCompact,
          mini && styles.trafficMini,
          !showLabel && styles.trafficWithoutLabel,
          style,
        ]}
        accessible={selected == null}
        accessibilityRole="text"
        accessibilityLabel={countLabel}
      >
        <View
          style={[
            styles.lamp,
            {
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
          <ExpiryTrafficIcon
            size={lampMin}
            tone={lampTone}
            active={isOn}
            selected={selected ?? false}
          />
        </View>
        {showLabel ? (
          <View
            style={[
              styles.trafficCopy,
              shouldStack && styles.trafficCopyStacked,
            ]}
          >
            <AppText
              variant="caption"
              scaleRole="chrome"
              densityAware={false}
              numberOfLines={shouldStack ? undefined : 1}
              style={styles.trafficLabel}
            >
              {label}
            </AppText>
            <AppText
              variant={compact ? "bodySmallStrong" : "heading"}
              numberOfLines={shouldStack ? undefined : 1}
              style={styles.trafficCount}
            >
              {value}건
            </AppText>
          </View>
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
        style,
      ]}
    >
      <AppText
        variant={isInline ? "heading" : "display"}
        style={{ color: toneStyle.valueColor }}
      >
        {value}
        {suffix}
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
  unknown: {
    backgroundColor: colors.mutedSurface,
    borderColor: colors.border,
    valueColor: colors.mutedText,
    labelColor: colors.subtext,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warningSoft,
    valueColor: colors.warningForeground,
    labelColor: colors.subtext,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft,
    valueColor: colors.dangerForeground,
    labelColor: colors.subtext,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
    valueColor: colors.successForeground,
    labelColor: colors.subtext,
  },
};

const trafficLamps: Record<ExpiryTrafficTone, { glow: string }> = {
  unknown: {
    glow: colors.mutedText,
  },
  danger: {
    glow: colors.expiryExpiredAccent,
  },
  warning: {
    glow: colors.expiryExpiringAccent,
  },
  success: {
    glow: colors.expirySafeAccent,
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
    alignSelf: "stretch",
    alignItems: "center",
    minWidth: 0,
    gap: spacing.xs,
  },
  trafficCopy: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: spacing.xxs,
    minWidth: 0,
  },
  trafficCopyStacked: {
    flexDirection: "column",
    alignItems: "center",
    gap: spacing.none,
  },
  trafficCount: {
    textAlign: "center",
  },
  trafficCompact: {
    gap: spacing.xxs,
  },
  trafficMini: {
    flex: 0,
    justifyContent: "center",
    gap: spacing.xxs,
  },
  trafficWithoutLabel: {
    gap: spacing.none,
  },
  lamp: {
    alignItems: "center",
    justifyContent: "center",
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
