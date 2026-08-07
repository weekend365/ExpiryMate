import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn =
    process.env.SENTRY_DSN?.trim() ??
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.GIT_SHA,
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;
