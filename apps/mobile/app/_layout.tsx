import "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthRedirectGate } from "../src/features/auth/auth-gate";
import { useAuth } from "../src/features/auth/use-auth";
import { NotificationNavigationBridge } from "../src/features/notifications/notification-navigation";
import { RecipeGenerationProvider } from "../src/features/recipes/recipe-generation-provider";
import { syncPushTokenIfPermissionGranted } from "../src/services/notifications";
import { queryClient } from "../src/services/query-client";
import { initMobileSentry } from "../src/services/sentry";
import { pretendardFonts } from "../src/shared/fonts";
import { colors, fontFamily, typography } from "../src/shared/theme";

initMobileSentry();

SplashScreen.preventAutoHideAsync().catch(() => null);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(pretendardFonts);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => null);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RecipeGenerationProvider>
            <PushTokenSync />
            <NotificationNavigationBridge />
            <AuthRedirectGate />
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                contentStyle: {
                  backgroundColor: colors.background,
                },
                headerTintColor: colors.text,
                headerTitleStyle: {
                  fontFamily: fontFamily.bold,
                  fontSize: typography.heading.fontSize,
                },
                headerBackTitleStyle: {
                  fontFamily: fontFamily.medium,
                },
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="scanner" options={{ headerShown: false }} />
              <Stack.Screen name="register" options={{ title: "재료 넣기" }} />
              <Stack.Screen name="inventory/[id]" options={{ title: "재료 살펴보기" }} />
              <Stack.Screen name="auth/login" options={{ headerShown: false }} />
              <Stack.Screen name="auth/register" options={{ headerShown: false }} />
              <Stack.Screen
                name="auth/forgot-password"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="auth/reset-password"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="auth/verify-pending"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="auth/verify-email"
                options={{ headerShown: false }}
              />
              <Stack.Screen
                name="privacy/index"
                options={{ title: "개인정보와 추천 안내" }}
              />
              <Stack.Screen
                name="privacy/ai-data-notice"
                options={{ title: "요리 추천 안내" }}
              />
              <Stack.Screen
                name="privacy/account-delete"
                options={{ title: "계정과 데이터 정리" }}
              />
              <Stack.Screen
                name="settings/notifications"
                options={{ title: "알림" }}
              />
              <Stack.Screen
                name="settings/storage-locations"
                options={{ title: "보관 위치" }}
              />
              <Stack.Screen name="settings/account" options={{ title: "계정" }} />
              <Stack.Screen
                name="settings/subscription"
                options={{ title: "구독" }}
              />
            </Stack>
          </RecipeGenerationProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function PushTokenSync() {
  const { isRegistered, sessionUserId } = useAuth();

  useEffect(() => {
    if (!isRegistered || !sessionUserId) {
      return;
    }

    // Re-bind Expo token to the active registered owner after login / user switch.
    syncPushTokenIfPermissionGranted().catch(() => null);
  }, [isRegistered, sessionUserId]);

  return null;
}
