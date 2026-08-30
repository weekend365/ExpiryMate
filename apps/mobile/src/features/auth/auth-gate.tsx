import { Redirect, useRouter, useSegments } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { appBrand } from "@expirymate/shared";
import { AppText } from "../../components/AppText";
import { Mascot } from "../../components/Mascot";
import { Button } from "../../components/Button";
import { colors, spacing, typography } from "../../shared/theme";
import { useAppStore } from "../../store/app-store";
import { subscribeToAuthSessionCleared } from "../../services/api";
import { handleAuthSessionCleared } from "./session-boundary";
import { useAuth } from "./use-auth";
import { resolveRegisteredLandingHref } from "./auth-routing";

const PUBLIC_ROOT_SEGMENTS = new Set([
  "index",
  "onboarding",
  "auth",
  "spaces",
]);

const EMAIL_VERIFY_AUTH_SCREENS = new Set([
  "verify-pending",
  "verify-email",
]);

/**
 * Keeps unauthenticated users on onboarding/login, and sends registered users
 * away from the login screen into the main app (after email verification when required).
 */
export function AuthRedirectGate() {
  const router = useRouter();
  const segments = useSegments();
  const queryClient = useQueryClient();
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useAppStore(
    (state) => state.hasCompletedOnboarding,
  );
  const { query } = useAuth();

  const isRegistered = query.data?.accountType === "registered";
  const needsEmailVerification = Boolean(query.data?.requiresEmailVerification);
  const rootSegment = segments[0];
  const isPublicRoute =
    !rootSegment || PUBLIC_ROOT_SEGMENTS.has(String(rootSegment));

  useEffect(
    () =>
      subscribeToAuthSessionCleared(() => {
        handleAuthSessionCleared(queryClient);
      }),
    [queryClient],
  );

  useEffect(() => {
    if (
      !hasHydrated ||
      query.isLoading ||
      query.isFetching ||
      query.isError
    ) {
      return;
    }

    if (!hasCompletedOnboarding) {
      if (rootSegment !== "onboarding") {
        router.replace("/onboarding");
      }
      return;
    }

    if (!isRegistered) {
      if (!isPublicRoute || rootSegment === "index") {
        router.replace("/auth/login");
      }
      return;
    }

    const routeSegments = segments as string[];
    const authScreen = routeSegments[1] ?? "";

    if (needsEmailVerification) {
      if (
        rootSegment !== "auth" ||
        !EMAIL_VERIFY_AUTH_SCREENS.has(authScreen)
      ) {
        router.replace({
          pathname: "/auth/verify-pending",
          params: query.data?.email
            ? { email: query.data.email }
            : undefined,
        });
      }
      return;
    }

    if (rootSegment === "auth") {
      if (
        authScreen === "login" ||
        authScreen === "register" ||
        authScreen === "verify-pending"
      ) {
        router.replace("/(tabs)/home");
      }
    }
  }, [
    hasCompletedOnboarding,
    hasHydrated,
    isPublicRoute,
    isRegistered,
    needsEmailVerification,
    query.data?.email,
    query.isFetching,
    query.isError,
    query.isLoading,
    rootSegment,
    router,
    segments,
  ]);

  return null;
}

export function AuthLoadingScreen() {
  return (
    <View style={styles.root}>
      <Mascot size="medium" mood="idle" />
      <AppText style={styles.brand}>{appBrand.appNameKo}</AppText>
      <ActivityIndicator color={colors.primary} />
      <AppText style={styles.caption}>장고가 준비하고 있어요</AppText>
    </View>
  );
}

export function AuthSessionErrorScreen({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.root}>
      <Mascot size="medium" mood="worry" />
      <AppText style={styles.brand}>로그인을 확인하지 못했어요</AppText>
      <AppText style={styles.caption}>
        {message ?? "인터넷 연결을 확인하고 다시 시도해 주세요."}
      </AppText>
      <Button onPress={onRetry}>다시 확인할게요</Button>
    </View>
  );
}

export function RequireRegisteredAuth({
  children,
}: {
  children: ReactNode;
}) {
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const { query } = useAuth();
  const isRegistered = query.data?.accountType === "registered";
  const needsEmailVerification = Boolean(query.data?.requiresEmailVerification);

  if (!hasHydrated || query.isLoading) {
    return <AuthLoadingScreen />;
  }

  if (query.isError) {
    return (
      <AuthSessionErrorScreen
        message={query.error instanceof Error ? query.error.message : undefined}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }

  if (!isRegistered) {
    return <Redirect href="/auth/login" />;
  }

  if (needsEmailVerification) {
    return (
      <Redirect href={resolveRegisteredLandingHref(query.data ?? {})} />
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  brand: {
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontFamily: typography.heading.fontFamily,
    color: colors.text,
  },
  caption: {
    fontSize: typography.bodySmall.fontSize,
    lineHeight: typography.bodySmall.lineHeight,
    fontFamily: typography.bodySmall.fontFamily,
    color: colors.subtext,
  },
});
