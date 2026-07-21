import { ChevronRight, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";

interface ListRowProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
}

export function ListRow({
  title,
  description,
  icon: Icon,
  trailing,
  onPress,
  destructive = false,
  last = false,
}: ListRowProps) {
  const content = (
    <>
      {Icon ? (
        <View style={[styles.listIcon, destructive && styles.listIconDanger]}>
          <Icon
            color={destructive ? colors.danger : colors.primary}
            size={spacing.sm + spacing.xxs}
            strokeWidth={2.4}
          />
        </View>
      ) : null}
      <View style={styles.listCopy}>
        <Text style={[styles.listTitle, destructive && styles.listTitleDanger]}>
          {title}
        </Text>
        {description ? (
          <Text style={styles.listDescription}>{description}</Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? (
          <ChevronRight
            color={colors.mutedText}
            size={spacing.sm + spacing.xxs}
          />
        ) : null)}
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.listRow, last && styles.listRowLast]}>{content}</View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        last && styles.listRowLast,
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
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  },
  listIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  listCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  listTitle: {
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    color: colors.text,
  },
  listTitleDanger: {
    color: colors.danger,
  },
  listDescription: {
    fontSize: typography.label.fontSize,
    lineHeight: typography.label.lineHeight,
    fontFamily: typography.label.fontFamily,
    color: colors.subtext,
  },
});
