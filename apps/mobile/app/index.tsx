import { Redirect } from "expo-router";
import {
  AuthLoadingScreen,
  AuthSessionErrorScreen,
} from "../src/features/auth/auth-gate";
import { useAuth } from "../src/features/auth/use-auth";
import { useAppStore } from "../src/store/app-store";

export default function IndexScreen() {
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  const hasCompletedOnboarding = useAppStore(
    (state) => state.hasCompletedOnboarding,
  );
  const { query } = useAuth();
  const isRegistered = query.data?.accountType === "registered";

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

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (!isRegistered) {
    return <Redirect href="/auth/login" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
