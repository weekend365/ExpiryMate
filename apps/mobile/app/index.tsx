import { Redirect } from "expo-router";
import {
  AuthLoadingScreen,
  AuthSessionErrorScreen,
} from "../src/features/auth/auth-gate";
import { resolveRegisteredLandingHref } from "../src/features/auth/auth-routing";
import { useAuth } from "../src/features/auth/use-auth";
import { useAppStore } from "../src/store/app-store";
import { clearAuthSession } from "../src/services/api";

export default function IndexScreen() {
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useAppStore(
    (state) => state.hasCompletedOnboarding,
  );
  const { query } = useAuth();

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
        onResetSession={async () => {
          await clearAuthSession();
          await query.refetch();
        }}
      />
    );
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href={resolveRegisteredLandingHref(query.data ?? {})} />;
}
