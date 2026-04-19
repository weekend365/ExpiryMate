import { Tabs } from "expo-router";
import { colors } from "../../src/shared/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtext,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "홈",
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: "재고 목록",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "설정",
        }}
      />
    </Tabs>
  );
}
