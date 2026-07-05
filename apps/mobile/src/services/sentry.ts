import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";

export function initMobileSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? "development";

  if (!dsn || appEnv === "development") {
    return;
  }

  Sentry.init({
    dsn,
    environment: appEnv,
    release: `${Constants.expoConfig?.version ?? "1.0.0"}-${appEnv}`,
    tracesSampleRate: 0.2,
  });
}
