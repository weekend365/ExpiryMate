import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthRedirectGate } from "../src/features/auth/auth-gate";
import { NotificationNavigationBridge } from "../src/features/notifications/notification-navigation";
import { RecipeGenerationProvider } from "../src/features/recipes/recipe-generation-provider";
import { syncPushTokenIfPermissionGranted } from "../src/services/notifications";
import { queryClient } from "../src/services/query-client";
import { initMobileSentry } from "../src/services/sentry";
import { colors } from "../src/shared/theme";

initMobileSentry();

export default function RootLayout() {
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
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="scanner" options={{ headerShown: false }} />
              <Stack.Screen name="register" options={{ title: "재료 넣기" }} />
              <Stack.Screen name="inventory/[id]" options={{ title: "재료 살펴보기" }} />
              <Stack.Screen name="auth/login" options={{ title: "어서 오세요" }} />
              <Stack.Screen name="auth/register" options={{ title: "함께 시작하기" }} />
              <Stack.Screen
                name="auth/forgot-password"
                options={{ title: "비밀번호를 잊었어요" }}
              />
              <Stack.Screen
                name="auth/reset-password"
                options={{ title: "비밀번호 다시 정하기" }}
              />
              <Stack.Screen
                name="auth/verify-pending"
                options={{ title: "메일함 확인", headerBackVisible: false }}
              />
              <Stack.Screen name="auth/verify-email" options={{ title: "메일 확인" }} />
              <Stack.Screen name="privacy/index" options={{ title: "개인정보와 AI 데이터" }} />
              <Stack.Screen
                name="privacy/ai-data-notice"
                options={{ title: "AI 추천 안내" }}
              />
              <Stack.Screen
                name="privacy/account-delete"
                options={{ title: "계정과 데이터 정리" }}
              />
            </Stack>
          </RecipeGenerationProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function PushTokenSync() {
  useEffect(() => {
    syncPushTokenIfPermissionGranted().catch(() => null);
  }, []);

  return null;
}
