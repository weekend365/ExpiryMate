import { ChevronLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";

interface HeaderBackButtonProps {
  onPress: () => void;
}

/**
 * Keeps the complete back control inside one generous touch target.
 * Using an explicit control also avoids relying on a previous route title as
 * the tappable native-stack label.
 */
export function HeaderBackButton({ onPress }: HeaderBackButtonProps) {
  const { isLargeText } = useResponsiveLayout();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="뒤로가기"
      hitSlop={spacing.xs}
      onPress={onPress}
      style={styles.button}
    >
      <ChevronLeft
        color={colors.primary}
        size={spacing.sm + spacing.xxs}
        strokeWidth={2.4}
      />
      {!isLargeText ? <Text style={styles.label}>뒤로가기</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: touchTarget.icon,
    marginLeft: -spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  label: {
    color: colors.primary,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: spacing.sm + spacing.xxs,
    fontFamily: typography.bodyStrong.fontFamily,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});
