import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";

export function initMobileSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

  if (!dsn || appEnv === "development") {
    return false;
  }

  const version = Constants.expoConfig?.version ?? "1.0.0";
  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    String(Constants.expoConfig?.android?.versionCode ?? "0");
  const gitSha =
    process.env.EXPO_PUBLIC_GIT_SHA?.trim() ||
    process.env.EAS_BUILD_GIT_COMMIT_HASH?.trim() ||
    "unknown";

  Sentry.init({
    dsn,
    environment: appEnv,
    release: `expirymate-mobile@${version}+${buildNumber}`,
    dist: gitSha,
    tracesSampleRate: 0.2,
  });

  return true;
}

/** Lightweight breadcrumbs for space bootstrap diagnosis (no PII). */
export function captureSpaceBootstrapBreadcrumb(
  step: string,
  data?: Record<string, string | number | boolean | undefined>,
) {
  try {
    Sentry.addBreadcrumb({
      category: "space.bootstrap",
      message: step,
      level: "info",
      data,
    });
  } catch {
    // Sentry may be uninitialized in development.
  }
}
