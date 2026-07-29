import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../shared/theme";
import { AppText } from "./AppText";

interface SectionHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  surface?: boolean;
  accentColor?: string;
}

export function SectionHeader({
  title,
  description,
  action,
  surface = false,
  accentColor,
}: SectionHeaderProps) {
  return (
    <View style={[styles.root, surface && styles.surface]}>
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
      <View style={[styles.copy, surface && styles.surfaceCopy]}>
        <AppText
          variant={surface ? "bodySmall" : "subheading"}
          tone={surface ? "subtext" : "default"}
          style={surface && styles.surfaceTitle}
        >
          {title}
        </AppText>
        {description ? (
          <AppText variant="bodySmall" tone="subtext">
            {description}
          </AppText>
        ) : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
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
    gap: spacing.xs,
  },
  surfaceCopy: {
    gap: spacing.xxs,
  },
  surfaceTitle: {
    fontWeight: "700",
  },
  action: {
    paddingTop: spacing.xxs,
  },
});
