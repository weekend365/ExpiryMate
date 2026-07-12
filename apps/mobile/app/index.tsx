import { appBrand } from "@expirymate/shared";
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Mascot } from "../src/components/Mascot";
import { colors, spacing, typography } from "../src/shared/theme";
import { useAppStore } from "../src/store/app-store";

export default function IndexScreen() {
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useAppStore(
    (state) => state.hasCompletedOnboarding,
  );

  if (!hasHydrated) {
    return (
      <View style={styles.root}>
        <Mascot size="medium" mood="idle" />
        <Text style={styles.brand}>{appBrand.appNameKo}</Text>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.caption}>장고가 준비하고 있어요</Text>
      </View>
    );
  }

  return (
    <Redirect href={hasCompletedOnboarding ? "/(tabs)/home" : "/onboarding"} />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  brand: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: typography.heading.fontWeight,
    color: colors.text,
  },
  caption: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    color: colors.subtext,
  },
});
