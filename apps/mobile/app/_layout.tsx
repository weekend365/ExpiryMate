import "react-native-gesture-handler";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useIsRestoring } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import { useEffect, useState, type ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { HeaderBackButton, HeaderTitle } from "../src/components/HeaderBackButton";
import {
  AuthLoadingScreen,
  AuthRedirectGate,
} from "../src/features/auth/auth-gate";
import { useAuth } from "../src/features/auth/use-auth";
import { NotificationNavigationBridge } from "../src/features/notifications/notification-navigation";
import { MonetizationProvider } from "../src/features/monetization/monetization-provider";
import { IapPurchaseProvider } from "../src/features/monetization/iap-purchase-provider";
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
import { captureStartupBootstrapIssue } from "../src/services/bootstrap-diagnostics";
import { pretendardFonts } from "../src/shared/fonts";
import { colors, fontFamily, typography } from "../src/shared/theme";

const isSentryEnabled = initMobileSentry();
export const FONT_LOAD_TIMEOUT_MS = 8_000;

SplashScreen.preventAutoHideAsync().catch(() => null);

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(pretendardFonts);
  const [fontLoadTimedOut, setFontLoadTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => {
      const error = new Error("Bundled fonts did not settle before timeout.");
      captureStartupBootstrapIssue("fonts.load-timeout", error, {
        timeout_ms: FONT_LOAD_TIMEOUT_MS,
      });
      setFontLoadTimedOut(true);
    }, FONT_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontError, fontsLoaded]);

  useEffect(() => {
    if (fontsLoaded || fontError || fontLoadTimedOut) {
      SplashScreen.hideAsync().catch(() => null);
    }
  }, [fontLoadTimedOut, fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && !fontLoadTimedOut) {
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
              <MonetizationProvider>
                <IapPurchaseProvider>
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
                headerTitleAlign: "center",
                headerLeftContainerStyle: {
                  justifyContent: "center",
                  alignItems: "center",
                },
                headerTitleContainerStyle: {
                  justifyContent: "center",
                  alignItems: "center",
                },
                headerRightContainerStyle: {
                  justifyContent: "center",
                  alignItems: "center",
                },
                headerTitleStyle: {
                  fontFamily: fontFamily.bold,
                  fontSize: typography.heading.fontSize,
                },
                headerTitle: ({ children }) => (
                  <HeaderTitle>{children}</HeaderTitle>
                ),
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
              <Stack.Screen
                name="register-photo"
                options={{ title: "사진으로 넣기", headerShown: false }}
              />
              <Stack.Screen name="inventory/[id]" options={{ title: "내용 바꾸기" }} />
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
                options={{ title: "요리 추천과 사진 안내" }}
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
                options={{ title: "함께 쓰는 냉장고" }}
              />
              <Stack.Screen name="settings/account" options={{ title: "계정" }} />
              <Stack.Screen
                name="settings/subscription"
                options={{ title: "장고 플러스" }}
              />
              <Stack.Screen
                name="insights"
                options={{ title: "폐기 예방 리포트" }}
              />
              <Stack.Screen
                name="settings/support"
                options={{ title: "장고에게 물어보기" }}
              />
              <Stack.Screen
                name="settings/recipe-preferences"
                options={{ title: "요리 추천 맞춤 설정" }}
              />
              <Stack.Screen
                name="settings/recommendation-credits"
                options={{ title: "AI 추천권" }}
              />
                    </Stack>
                  </RecipeGenerationProvider>
                </IapPurchaseProvider>
              </MonetizationProvider>
            </SpaceProvider>
          </QueryCacheRestoreBoundary>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default isSentryEnabled ? Sentry.wrap(RootLayout) : RootLayout;

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
