import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { AppText } from "./AppText";
import { useSettingsDensity } from "./settings-density";

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  surface?: boolean;
  /**
   * `compact`: group label for preference screens (13px, tight gap).
   * Ignored when `surface` is set — surface already uses a dense label.
   */
  density?: "default" | "compact";
  accentColor?: string;
}

export function SectionHeader({
  title,
  description,
  action,
  surface = false,
  density,
  accentColor,
}: SectionHeaderProps) {
  const { shouldStack } = useResponsiveLayout();
  const inheritedDensity = useSettingsDensity();
  const compact = (density ?? inheritedDensity) === "compact" && !surface;
  return (
    <View
      style={[
        styles.root,
        shouldStack && styles.rootStacked,
        compact && styles.rootCompact,
        surface && styles.surface,
      ]}
    >
      {surface && accentColor ? (
        <View
          style={styles.accentSlot}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <View
            style={[styles.accentBar, { backgroundColor: accentColor }]}
          />
        </View>
      ) : null}
      <View
        style={[
          styles.copy,
          (surface || compact) && styles.denseCopy,
        ]}
      >
        <AppText
          variant={
            compact ? "label" : surface ? "bodySmall" : "subheading"
          }
          tone={surface || compact ? "subtext" : "default"}
          style={(surface || compact) && styles.denseTitle}
        >
          {title}
        </AppText>
        {description ? (
          <AppText variant={compact ? "caption" : "bodySmall"} tone="subtext">
            {description}
          </AppText>
        ) : null}
      </View>
      {action ? (
        <View style={[styles.action, shouldStack && styles.actionStacked]}>
          {action}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  rootStacked: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: spacing.xs,
  },
  surface: {
    paddingLeft: spacing.md,
    paddingRight: spacing.xs + spacing.xxs,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTranslucent,
    overflow: "hidden",
  },
  accentSlot: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: spacing.xs,
    width: spacing.xxs,
    justifyContent: "center",
  },
  accentBar: {
    width: spacing.xxs,
    height: spacing.md,
    borderRadius: radius.pill,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  denseCopy: {
    gap: spacing.xxs,
  },
  denseTitle: {
    fontWeight: "700",
  },
  rootCompact: {
    gap: spacing.sm,
  },
  action: {
    flexShrink: 1,
    paddingTop: spacing.xxs,
  },
  actionStacked: {
    alignSelf: "flex-start",
    paddingTop: spacing.none,
  },
});
