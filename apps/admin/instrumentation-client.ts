import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? "development",
    release: process.env.GIT_SHA,
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart =
  Sentry.captureRouterTransitionStart;
