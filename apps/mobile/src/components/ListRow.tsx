import { ChevronRight, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, controlSize } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { AppText } from "./AppText";
import { useSettingsDensity } from "./settings-density";

interface ListRowProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
  /**
   * `compact`: preference-list density. Keeps the 48px touch target.
   */
  density?: "default" | "compact";
}

export function ListRow({
  title,
  description,
  icon: Icon,
  trailing,
  onPress,
  destructive = false,
  last = false,
  density,
}: ListRowProps) {
  const { shouldStack } = useResponsiveLayout();
  const inheritedDensity = useSettingsDensity();
  const compact = (density ?? inheritedDensity) === "compact";
  const endAdornment =
    trailing ??
    (onPress ? (
      <ChevronRight
        color={colors.mutedText}
        size={spacing.sm + spacing.xxs}
      />
    ) : null);
  const content = (
    <>
      <View style={[styles.listMain, shouldStack && styles.listMainStacked]}>
        {Icon ? (
          <View
            style={[
              styles.listIcon,
              compact && styles.listIconCompact,
              destructive && styles.listIconDanger,
            ]}
          >
            <Icon
              color={destructive ? colors.danger : colors.primary}
              size={spacing.sm + spacing.xxs}
              strokeWidth={2.4}
            />
          </View>
        ) : null}
        <View style={styles.listCopy}>
          <AppText
            variant="bodyStrong"
            tone={destructive ? "danger" : "default"}
            style={styles.listTitle}
          >
            {title}
          </AppText>
          {description ? (
            <AppText variant="label" tone="subtext" style={styles.listDescription}>
              {description}
            </AppText>
          ) : null}
        </View>
      </View>
      {endAdornment ? (
        <View style={[styles.trailing, shouldStack && styles.trailingStacked]}>
          {endAdornment}
        </View>
      ) : null}
    </>
  );
  const rowStyles = [
    styles.listRow,
    compact && styles.listRowCompact,
    shouldStack && styles.listRowStacked,
    last && styles.listRowLast,
  ];

  if (!onPress) {
    return (
      <View style={rowStyles}>{content}</View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        ...rowStyles,
        pressed && styles.listRowPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listRow: {
    minHeight: controlSize.minimum,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listRowCompact: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  listRowStacked: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: spacing.xs,
  },
  listMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  listMainStacked: {
    width: "100%",
    alignItems: "flex-start",
  },
  listRowLast: {
    borderBottomWidth: 0,
  },
  listRowPressed: {
    backgroundColor: colors.surfacePressed,
  },
  listIcon: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  listIconCompact: {
    width: spacing.lg,
    height: spacing.lg,
    borderRadius: radius.md,
  },
  listIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  listCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
  },
  trailing: {
    flexShrink: 0,
  },
  trailingStacked: {
    alignSelf: "flex-end",
  },
  listTitle: {
    flexShrink: 1,
  },
  listDescription: {
    flexShrink: 1,
  },
});
