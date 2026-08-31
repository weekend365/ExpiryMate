import { Redirect, useRouter, useSegments } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import splashAppIcon from "../../../assets/branding/splash-icon.png";
import { AppText } from "../../components/AppText";
import { Button } from "../../components/Button";
import { SkeletonBlock } from "../../components/ContentSkeleton";
import { colors, radius, spacing } from "../../shared/theme";
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
  const phase = useInitialLoadingPhase();

  if (phase === "brand") {
    return (
      <View style={styles.brandRoot} testID="initial-loading-brand">
        <Image
          source={splashAppIcon}
          style={styles.appIcon}
          accessibilityLabel="장고야 부탁해 앱 아이콘"
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.loadingSafeArea} edges={["top", "right", "left"]}>
      <ScrollView
        contentContainerStyle={styles.loadingScrollContent}
        showsVerticalScrollIndicator={false}
        accessibilityLabel={
          phase === "extended"
            ? "냉장고 정보를 불러오는 중"
            : "홈 화면을 준비하는 중"
        }
        testID="initial-loading-skeleton"
      >
        <View style={styles.loadingContent}>
          {phase === "extended" ? (
            <View
              style={styles.loadingStatus}
              accessibilityLiveRegion="polite"
              testID="initial-loading-status"
            >
              <ActivityIndicator color={colors.brandAccent} size="small" />
              <AppText variant="bodySmall" tone="subtext">
                냉장고 정보를 불러오는 중
              </AppText>
            </View>
          ) : null}

          <View style={styles.switcherSkeleton}>
            <View style={styles.skeletonCopy}>
              <SkeletonBlock height={spacing.sm} width="32%" />
              <SkeletonBlock height={spacing.md} width="58%" />
            </View>
            <SkeletonBlock
              height={spacing.lg}
              width={spacing.lg}
              radiusToken="pill"
            />
          </View>

          <View style={styles.heroSkeleton}>
            <SkeletonBlock
              height={spacing.xxl + spacing.xl}
              width={spacing.xxl + spacing.xl}
              radiusToken="xl"
            />
            <View style={styles.skeletonCopy}>
              <SkeletonBlock height={spacing.md} width="68%" />
              <SkeletonBlock height={spacing.sm} width="88%" />
              <SkeletonBlock height={spacing.sm} width="54%" />
            </View>
          </View>

          <SkeletonBlock height={spacing.xxxl + spacing.xs} radiusToken="xl" />

          <View style={styles.contentCardSkeleton}>
            <SkeletonBlock height={spacing.md} width="38%" />
            <View style={styles.contentCardRow}>
              <SkeletonBlock
                height={spacing.xl}
                width={spacing.xl}
                radiusToken="md"
              />
              <View style={styles.skeletonCopy}>
                <SkeletonBlock height={spacing.sm} width="72%" />
                <SkeletonBlock height={spacing.sm} width="48%" />
              </View>
            </View>
          </View>

          <View style={styles.contentCardSkeleton}>
            <SkeletonBlock height={spacing.md} width="34%" />
            <View style={styles.trafficSkeleton}>
              {[0, 1, 2, 3].map((item) => (
                <SkeletonBlock
                  key={item}
                  height={spacing.xxl}
                  width={spacing.xxl}
                  radiusToken="pill"
                />
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
      <View style={styles.errorIcon}>
        <CircleAlert color={colors.dangerForeground} size={spacing.lg} strokeWidth={2.2} />
      </View>
      <View style={styles.errorCopy}>
        <AppText variant="heading" style={styles.errorTitle}>
          로그인을 확인하지 못했어요
        </AppText>
        <AppText variant="bodySmall" tone="subtext" style={styles.errorMessage}>
          {message ?? "인터넷 연결을 확인하고 다시 시도해 주세요."}
        </AppText>
      </View>
      <Button onPress={onRetry}>다시 시도</Button>
    </View>
  );
}

type InitialLoadingPhase = "brand" | "skeleton" | "extended";

const SKELETON_DELAY_MS = 300;
const EXTENDED_LOADING_DELAY_MS = 2_000;

function useInitialLoadingPhase(): InitialLoadingPhase {
  const [phase, setPhase] = useState<InitialLoadingPhase>("brand");

  useEffect(() => {
    const skeletonTimer = setTimeout(() => {
      setPhase("skeleton");
    }, SKELETON_DELAY_MS);
    const extendedTimer = setTimeout(() => {
      setPhase("extended");
    }, EXTENDED_LOADING_DELAY_MS);

    return () => {
      clearTimeout(skeletonTimer);
      clearTimeout(extendedTimer);
    };
  }, []);

  return phase;
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
  brandRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  appIcon: {
    width: 88,
    height: 88,
  },
  loadingSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingScrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  loadingContent: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    gap: spacing.sm,
  },
  loadingStatus: {
    minHeight: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  switcherSkeleton: {
    minHeight: spacing.xxxl + spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroSkeleton: {
    minHeight: spacing.xxxl + spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xxl,
    backgroundColor: colors.primarySoft,
  },
  skeletonCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  contentCardSkeleton: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  contentCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.mutedSurface,
  },
  trafficSkeleton: {
    minHeight: spacing.xxxl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.insetSurface,
  },
  errorIcon: {
    width: spacing.xxl + spacing.sm,
    height: spacing.xxl + spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.dangerSoft,
  },
  errorCopy: {
    width: "100%",
    maxWidth: 440,
    alignItems: "center",
    gap: spacing.xs,
  },
  errorTitle: {
    textAlign: "center",
  },
  errorMessage: {
    textAlign: "center",
  },
});
