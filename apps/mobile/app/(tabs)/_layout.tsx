import { Tabs, useNavigation } from "expo-router";
import {
  Archive,
  ChefHat,
  House,
  Settings,
  ShoppingBasket,
} from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RequireRegisteredAuth } from "../../src/features/auth/auth-gate";
import { resolveTabHeaderBackTitle } from "../../src/features/navigation/header-back-title";
import { getMaxFontSizeMultiplier } from "../../src/shared/font-scale";
import {
  getTabBarMetrics,
  useResponsiveLayout,
} from "../../src/shared/responsive-layout";
import {
  colors,
  fontFamily,
  typography,
} from "../../src/shared/theme";
import { trackAffiliateEntryTap } from "../../src/features/affiliate/affiliate-entry-tracking";

export default function TabsLayout() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isLargeText } = useResponsiveLayout();
  // Include system navigation-bar / home-indicator inset so tab chrome never
  // sits under Android's 3-button / gesture bar (edge-to-edge).
  const tabBar = getTabBarMetrics(isLargeText, insets.bottom);

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
          tabBarShowLabel: true,
          tabBarLabel: ({ color, children }) => (
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={getMaxFontSizeMultiplier("chrome")}
              style={{
                color,
                fontFamily: fontFamily.medium,
                fontSize: typography.caption.fontSize,
                lineHeight: typography.caption.lineHeight,
              }}
            >
              {children}
            </Text>
          ),
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            // Override React Navigation's default height (49 + inset) so the
            // content row cannot overflow into the system nav padding.
            height: tabBar.height,
            paddingTop: tabBar.paddingTop,
            paddingBottom: tabBar.paddingBottom,
          },
          tabBarItemStyle: {
            height: tabBar.contentMinHeight,
          },
          tabBarHideOnKeyboard: true,
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
            tabBarButtonTestID: "tab-home",
            tabBarIcon: ({ color, size }) => (
              <House color={color} size={size} strokeWidth={2.4} />
            ),
          }}
        />
        <Tabs.Screen
          name="recommendations"
          options={{
            title: "추천",
            tabBarButtonTestID: "tab-recommendations",
            tabBarIcon: ({ color, size }) => (
              <ChefHat color={color} size={size} strokeWidth={2.4} />
            ),
          }}
        />
        <Tabs.Screen
          name="inventory"
          options={{
            title: "보관함",
            tabBarButtonTestID: "tab-inventory",
            tabBarIcon: ({ color, size }) => (
              <Archive color={color} size={size} strokeWidth={2.4} />
            ),
          }}
        />
        <Tabs.Screen
          name="shop"
          listeners={{
            tabPress: () => trackAffiliateEntryTap("shopping_tab"),
          }}
          options={{
            title: "장보기",
            tabBarButtonTestID: "tab-shopping",
            tabBarIcon: ({ color, size }) => (
              <ShoppingBasket color={color} size={size} strokeWidth={2.4} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "설정",
            tabBarButtonTestID: "tab-settings",
            tabBarIcon: ({ color, size }) => (
              <Settings color={color} size={size} strokeWidth={2.4} />
            ),
          }}
        />
      </Tabs>
    </RequireRegisteredAuth>
  );
}
