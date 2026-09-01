/**
 * Keep storage/bootstrap modules independent from the React Native Sentry
 * runtime. Loading diagnostics lazily also lets pure Node tests import the API
 * and stores without parsing React Native's Flow entrypoint.
 */
export function captureStartupBootstrapIssue(
  stage: string,
  error: unknown,
  data?: Record<string, string | number | boolean | undefined>,
) {
  void import("./sentry")
    .then((sentry) => {
      sentry.captureStartupBootstrapIssue(stage, error, data);
    })
    .catch(() => undefined);
}
