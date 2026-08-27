import { ChevronRight } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { AppText } from "../../components/AppText";
import { colors, spacing } from "../../shared/theme";
import { useResponsiveLayout } from "../../shared/responsive-layout";
import { homeScreenStyles as styles } from "./home-screen-styles";

export function HomeSectionHeader({
  title,
  metaLabel,
  actionLabel,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  metaLabel?: string;
  actionLabel?: string;
  accessibilityLabel?: string;
  onPress?: () => void;
}) {
  const { shouldStack } = useResponsiveLayout();
  return (
    <View
      style={[styles.sectionHeader, shouldStack && styles.sectionHeaderStacked]}
    >
      <AppText variant="bodySmall" tone="subtext" accessibilityRole="header">
        {title}
      </AppText>
      {metaLabel ? (
        <AppText variant="caption" tone="muted">
          {metaLabel}
        </AppText>
      ) : actionLabel && accessibilityLabel && onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          hitSlop={spacing.xs}
          style={({ pressed }) => [
            styles.sectionHeaderAction,
            pressed && styles.sectionHeaderActionPressed,
          ]}
        >
          <AppText variant="bodySmall" tone="primary">
            {actionLabel}
          </AppText>
          <ChevronRight
            color={colors.primary}
            size={spacing.sm}
            strokeWidth={2.4}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Pressable>
      ) : null}
    </View>
  );
}
