import { Tabs, useNavigation } from "expo-router";
import { Archive, ChefHat, House, Settings } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { RequireRegisteredAuth } from "../../src/features/auth/auth-gate";
import { resolveTabHeaderBackTitle } from "../../src/features/navigation/header-back-title";
import { colors, fontFamily, spacing, typography } from "../../src/shared/theme";

export default function TabsLayout() {
  const navigation = useNavigation();

  const syncParentBackTitle = useCallback(
    (tabName?: string) => {
      const backTitle = resolveTabHeaderBackTitle(tabName);
      // Native stack reads the previous scene's title for the iOS back label.
      navigation.getParent()?.setOptions({
        title: backTitle,
        headerBackTitle: backTitle,
      });
    },
    [navigation],
  );

  useEffect(() => {
    const state = navigation.getState();
    const tabName = state?.routes?.[state.index ?? 0]?.name;
    syncParentBackTitle(tabName);
  }, [navigation, syncParentBackTitle]);

  return (
    <RequireRegisteredAuth>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.subtext,
          tabBarLabelStyle: {
            fontFamily: fontFamily.medium,
            fontSize: typography.caption.fontSize,
          },
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: spacing.xxxl + spacing.sm,
            paddingBottom: spacing.xs,
            paddingTop: spacing.xs,
          },
        }}
        screenListeners={{
          state: (event) => {
            const state = event.data.state;
            const tabName = state.routes[state.index]?.name;
            syncParentBackTitle(tabName);
          },
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "홈",
            tabBarIcon: ({ color, size }) => (
              <House color={color} size={size} strokeWidth={2.4} />
            ),
          }}
        />
        <Tabs.Screen
          name="recommendations"
          options={{
            title: "추천",
            tabBarIcon: ({ color, size }) => (
              <ChefHat color={color} size={size} strokeWidth={2.4} />
            ),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "보관함",
            tabBarIcon: ({ color, size }) => (
              <Archive color={color} size={size} strokeWidth={2.4} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "설정",
            tabBarIcon: ({ color, size }) => (
              <Settings color={color} size={size} strokeWidth={2.4} />
            ),
          }}
        />
      </Tabs>
    </RequireRegisteredAuth>
  );
}
