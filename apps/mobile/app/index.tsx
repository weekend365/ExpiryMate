import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAppStore } from "../src/store/app-store";
import { colors } from "../src/shared/theme";

export default function IndexScreen() {
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useAppStore(
    (state) => state.hasCompletedOnboarding,
  );

  if (!hasHydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={hasCompletedOnboarding ? "/(tabs)/home" : "/onboarding"} />;
}
