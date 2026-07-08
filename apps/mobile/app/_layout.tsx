import "react-native-gesture-handler";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
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
              <Stack.Screen name="register" options={{ title: "등록하기" }} />
              <Stack.Screen name="inventory/[id]" options={{ title: "재고 상세" }} />
              <Stack.Screen name="auth/login" options={{ title: "로그인" }} />
              <Stack.Screen name="auth/register" options={{ title: "회원가입" }} />
              <Stack.Screen
                name="auth/forgot-password"
                options={{ title: "비밀번호 찾기" }}
              />
              <Stack.Screen
                name="auth/reset-password"
                options={{ title: "비밀번호 재설정" }}
              />
              <Stack.Screen name="auth/verify-email" options={{ title: "이메일 인증" }} />
              <Stack.Screen name="privacy/index" options={{ title: "개인정보" }} />
              <Stack.Screen
                name="privacy/ai-data-notice"
                options={{ title: "AI 데이터 고지" }}
              />
              <Stack.Screen
                name="privacy/account-delete"
                options={{ title: "계정 및 데이터 삭제" }}
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
