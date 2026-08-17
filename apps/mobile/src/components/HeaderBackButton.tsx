import { ChevronLeft } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
      <View style={styles.iconSlot} pointerEvents="none">
        <ChevronLeft
          color={colors.primary}
          size={spacing.sm + spacing.xxs}
          strokeWidth={2.4}
        />
      </View>
      {!isLargeText ? <Text style={styles.label}>뒤로가기</Text> : null}
    </Pressable>
  );
}

/** Native-stack title with the same Pretendard metrics as the back control. */
export function HeaderTitle({ children }: { children: string }) {
  return (
    <Text numberOfLines={1} style={styles.title}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "center",
    minHeight: touchTarget.icon,
    marginLeft: -spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
  },
  iconSlot: {
    width: spacing.sm + spacing.xxs,
    height: spacing.sm + spacing.xxs,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: colors.primary,
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.fontSize,
    fontFamily: typography.bodyStrong.fontFamily,
    includeFontPadding: false,
    textAlignVertical: "center",
    paddingTop: spacing.none,
    paddingBottom: spacing.none,
  },
  title: {
    color: colors.text,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.fontSize,
    fontFamily: typography.heading.fontFamily,
    includeFontPadding: false,
    textAlignVertical: "center",
    paddingTop: spacing.none,
    paddingBottom: spacing.none,
  },
});
