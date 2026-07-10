import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { Button } from "./Button";
import { Mascot, type MascotMood } from "./Mascot";
import { colors, radius, spacing, typography } from "../shared/theme";

interface EmptyStateProps {
  title: string;
  description?: string;
  /** Prefer `mood` for 장고 empty/success states. Icon is a fallback only. */
  mood?: MascotMood;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  accessory?: ReactNode;
}

export function EmptyState({
  title,
  description,
  mood,
  icon: Icon,
  actionLabel,
  onAction,
  accessory,
}: EmptyStateProps) {
  return (
    <View style={styles.root}>
      {mood ? (
        <View style={styles.mascotWrap}>
          <Mascot size="medium" mood={mood} />
        </View>
      ) : Icon ? (
        <View style={styles.iconWrap}>
          <Icon color={colors.primary} size={spacing.md} strokeWidth={2.4} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Button onPress={onAction} fullWidth>
          {actionLabel}
        </Button>
      ) : null}
      {accessory}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    alignItems: "stretch",
  },
  mascotWrap: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
  iconWrap: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    gap: spacing.xs,
    alignItems: "center",
  },
  title: {
    fontSize: typography.subheading.fontSize,
    lineHeight: typography.subheading.lineHeight,
    fontWeight: typography.subheading.fontWeight,
    color: colors.text,
    textAlign: "center",
  },
  description: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontWeight: typography.bodySmall.fontWeight,
    color: colors.subtext,
    textAlign: "center",
  },
});
