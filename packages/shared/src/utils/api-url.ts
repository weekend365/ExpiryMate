/** Existing deployment hostname policy shared by API and client validation. */
export function isUnsafeProductionHostname(hostname: string) {
  const normalized = hostname.toLowerCase();

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".example") ||
    normalized.endsWith(".invalid") ||
    normalized.endsWith(".test") ||
    normalized.includes("your-domain")
  );
}

/** Apps decide when production validation applies; this function reads no env. */
export function resolveApiBaseUrl({
  value,
  production,
  variableName,
}: {
  value: string | undefined;
  production: boolean;
  variableName: string;
}) {
  if (production) {
    if (!value) {
      throw new Error(`${variableName} is required in production.`);
    }

    let url: URL | null;
    try {
      url = new URL(value);
    } catch {
      url = null;
    }
    if (!url || url.protocol !== "https:" || isUnsafeProductionHostname(url.hostname)) {
      throw new Error(`${variableName} must be a public https:// URL in production.`);
    }
  }

  // Preserve the existing single-slash removal and nullish development fallback.
  return (value ?? "http://localhost:4000").replace(/\/$/, "");
}
