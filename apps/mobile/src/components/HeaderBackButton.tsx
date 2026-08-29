import { ChevronLeft } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing, touchTarget, typography } from "../shared/theme";
import { useResponsiveLayout } from "../shared/responsive-layout";
import { resolveCompactHeaderTitle } from "../features/navigation/header-back-title";
import { AppText } from "./AppText";

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
      <View style={styles.content} pointerEvents="none">
        <View style={styles.iconSlot}>
          <ChevronLeft
            color={colors.primary}
            size={spacing.sm + spacing.xxs}
            strokeWidth={2.4}
          />
        </View>
        {!isLargeText ? (
          <AppText
            variant="bodySmall"
            tone="primary"
            scaleRole="chrome"
            densityAware={false}
            style={styles.label}
          >
            뒤로가기
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Native-stack title with the same Pretendard metrics as the back control. */
export function HeaderTitle({ children }: { children: string }) {
  const { isLargeText, isNarrow } = useResponsiveLayout();
  const visibleTitle = resolveCompactHeaderTitle(
    children,
    isLargeText || isNarrow,
  );

  return (
    <View
      style={styles.titleWrap}
      pointerEvents="none"
      accessible
      accessibilityRole="header"
      accessibilityLabel={children}
    >
      <AppText
        numberOfLines={1}
        variant="bodyStrong"
        scaleRole="chrome"
        densityAware={false}
        style={styles.title}
      >
        {visibleTitle}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: touchTarget.icon,
    minHeight: touchTarget.icon,
    marginLeft: -spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    // Flex centers the font/SVG layout boxes, not their visible shapes.
    // Pretendard's baseline metrics leave this pair optically low in the header.
    transform: [{ translateY: -1 }],
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
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodyStrong.fontFamily,
    includeFontPadding: false,
    textAlignVertical: "center",
    paddingTop: spacing.none,
    paddingBottom: spacing.none,
  },
  titleWrap: {
    height: touchTarget.icon,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    includeFontPadding: false,
    textAlignVertical: "center",
    paddingTop: spacing.none,
    paddingBottom: spacing.none,
  },
});
