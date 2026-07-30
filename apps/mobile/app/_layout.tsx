import "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useIsRestoring } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { HeaderBackButton } from "../src/components/HeaderBackButton";
import {
  AuthLoadingScreen,
  AuthRedirectGate,
} from "../src/features/auth/auth-gate";
import { useAuth } from "../src/features/auth/use-auth";
import { NotificationNavigationBridge } from "../src/features/notifications/notification-navigation";
import { RecipeGenerationProvider } from "../src/features/recipes/recipe-generation-provider";
import { SpaceProvider } from "../src/features/spaces/space-provider";
import { PendingSpaceInvitationBridge } from "../src/features/spaces/pending-invitation";
import { syncPushTokenIfPermissionGranted } from "../src/services/notifications";
import {
  queryCachePersistOptions,
  queryClient,
  refreshRestoredQueries,
} from "../src/services/query-client";
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
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={queryCachePersistOptions}
          onSuccess={refreshRestoredQueries}
        >
          <QueryCacheRestoreBoundary>
            <SpaceProvider>
              <RecipeGenerationProvider>
                <PushTokenSync />
                <PendingSpaceInvitationBridge />
                <NotificationNavigationBridge />
                <AuthRedirectGate />
                <StatusBar style="dark" />
                <Stack
              screenOptions={({ navigation }) => ({
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
                headerBackTitle: "뒤로가기",
                headerLeft: () =>
                  navigation.canGoBack() ? (
                    <HeaderBackButton onPress={() => navigation.goBack()} />
                  ) : undefined,
              })}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                  // Native stack uses the previous scene's options for the iOS
                  // back label, so keep the hidden tabs scene label explicit.
                  title: "뒤로가기",
                  headerBackTitle: "뒤로가기",
                }}
              />
              <Stack.Screen name="scanner" options={{ headerShown: false }} />
              <Stack.Screen name="register" options={{ title: "재료 넣기" }} />
              <Stack.Screen name="inventory/[id]" options={{ title: "재료 살펴보기" }} />
              <Stack.Screen
                name="cooking/[recommendationId]"
                options={{ title: "요리하기" }}
              />
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
                name="spaces/invitations/accept"
                options={{ title: "냉장고 초대" }}
              />
              <Stack.Screen
                name="spaces/invitations/code"
                options={{ title: "초대 코드" }}
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
              <Stack.Screen
                name="settings/spaces"
                options={{ title: "함께 쓰는 냉장고" }}
              />
              <Stack.Screen
                name="settings/spaces/[spaceId]"
                options={{ title: "냉장고 구성원" }}
              />
              <Stack.Screen name="settings/account" options={{ title: "계정" }} />
              <Stack.Screen
                name="settings/support"
                options={{ title: "장고에게 물어보기" }}
              />
                </Stack>
              </RecipeGenerationProvider>
            </SpaceProvider>
          </QueryCacheRestoreBoundary>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function QueryCacheRestoreBoundary({ children }: { children: ReactNode }) {
  const isRestoring = useIsRestoring();

  if (isRestoring) {
    return <AuthLoadingScreen />;
  }

  return <>{children}</>;
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
