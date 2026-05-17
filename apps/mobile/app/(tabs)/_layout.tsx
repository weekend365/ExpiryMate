import { Tabs } from "expo-router";
import { Archive, Bell, ChefHat, House } from "lucide-react-native";
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
            <Bell color={color} size={size} strokeWidth={2.4} />
          ),
        }}
      />
    </Tabs>
  );
}
