import * as Sentry from "@sentry/nestjs";

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  const options = {
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.GIT_SHA,
    tracesSampleRate: 0.1,
    beforeSend(event: Sentry.ErrorEvent) {
      if (isOperationalProbeEvent(event)) {
        return null;
      }

      return event;
    },
  } as Parameters<typeof Sentry.init>[0] & { dsn: string };
  Sentry.init(options);
}

function isOperationalProbeEvent(event: Sentry.ErrorEvent) {
  const transaction = event.transaction ?? event.tags?.transaction;
  if (transaction === "GET /ready" || transaction === "GET /health") {
    return true;
  }

  const url = event.request?.url;
  if (!url) {
    return false;
  }

  try {
    const path = new URL(url, "http://localhost").pathname;
    return path === "/ready" || path === "/health";
  } catch {
    return url.endsWith("/ready") || url.endsWith("/health");
  }
}
