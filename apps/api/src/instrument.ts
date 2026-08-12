import * as Sentry from "@sentry/nestjs";

const dsn = process.env.SENTRY_DSN?.trim();

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.GIT_SHA,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (isOperationalProbeEvent(event)) {
        return null;
      }

      return event;
    },
  });
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
