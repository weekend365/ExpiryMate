import { Tabs } from "expo-router";
import { Archive, ChefHat, House, Settings } from "lucide-react-native";
import { RequireRegisteredAuth } from "../../src/features/auth/auth-gate";
import { colors, spacing } from "../../src/shared/theme";

export default function TabsLayout() {
  return (
    <RequireRegisteredAuth>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.subtext,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: spacing.xxxl + spacing.sm,
            paddingBottom: spacing.xs,
            paddingTop: spacing.xs,
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
