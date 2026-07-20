/**
 * Builds custom-scheme deep links without a triple slash.
 * `APP_BASE_URL=expirymate://` + `auth/verify-email` → `expirymate://auth/verify-email?...`
 */
export function buildAppDeepLink(
  path: string,
  query: Record<string, string> = {},
): string {
  const raw = (process.env.APP_BASE_URL ?? "expirymate://")
    .trim()
    // Collapse accidental `expirymate:///` into `expirymate://`
    .replace(/^([a-z][a-z0-9+.-]*:\/\/)\/+/i, "$1");

  const schemeMatch = raw.match(/^([a-z][a-z0-9+.-]*:\/\/)/i);
  const scheme = schemeMatch?.[1];
  const base =
    scheme && raw.length === scheme.length ? scheme : raw.replace(/\/+$/, "") || "expirymate://";

  const normalizedPath = path.replace(/^\/+/, "");
  const link = base.endsWith("://")
    ? `${base}${normalizedPath}`
    : `${base}/${normalizedPath}`;

  const qs = new URLSearchParams(query).toString();
  return qs ? `${link}?${qs}` : link;
}

/**
 * HTTPS URL for email clients. Falls back to the app deep link when
 * AUTH_LINK_BASE_URL is unset (local/dev without a public API host).
 */
export function buildAuthHttpsLink(
  path: string,
  query: Record<string, string> = {},
): string {
  const httpsBase = (process.env.AUTH_LINK_BASE_URL ?? "").replace(/\/+$/, "");

  if (
    httpsBase.startsWith("https://") ||
    httpsBase.startsWith("http://")
  ) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const qs = new URLSearchParams(query).toString();
    return qs
      ? `${httpsBase}${normalizedPath}?${qs}`
      : `${httpsBase}${normalizedPath}`;
  }

  return buildAppDeepLink(path, query);
}
