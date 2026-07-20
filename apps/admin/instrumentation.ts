export async function register() {
  const dsn =
    process.env.SENTRY_DSN?.trim() ??
    process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

  if (!dsn) {
    return;
  }

  const Sentry = await import("@sentry/nextjs");

  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.GIT_SHA,
    tracesSampleRate: 0.1,
  });

  Sentry.captureMessage("sentry-smoke-admin");
}
