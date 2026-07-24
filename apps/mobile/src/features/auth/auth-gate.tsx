import { Redirect, useRouter, useSegments } from "expo-router";
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { appBrand } from "@expirymate/shared";
import { Mascot } from "../../components/Mascot";
import { colors, spacing, typography } from "../../shared/theme";
import { useAppStore } from "../../store/app-store";
import { useAuth } from "./use-auth";

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

  useEffect(() => {
    if (!hasHydrated || query.isLoading || query.isFetching) {
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
      <Text style={styles.brand}>{appBrand.appNameKo}</Text>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.caption}>장고가 준비하고 있어요</Text>
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

  if (!isRegistered) {
    return <Redirect href="/auth/login" />;
  }

  if (needsEmailVerification) {
    return (
      <Redirect
        href={
          query.data?.email
            ? {
                pathname: "/auth/verify-pending",
                params: { email: query.data.email },
              }
            : "/auth/verify-pending"
        }
      />
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
