/**
 * Public marketing / legal pages (privacy, terms, choices).
 * Prefer EXPO_PUBLIC_WEB_BASE_URL; fall back to stripping /api from the API host.
 */
const DEFAULT_PUBLIC_WEB_BASE_URL = "https://jango.devnamu.com";

export function getPublicWebBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim().replace(
    /\/+$/,
    "",
  );
  if (configured) {
    return configured;
  }

  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(
    /\/api\/?$/,
    "",
  );
  return apiBase || DEFAULT_PUBLIC_WEB_BASE_URL;
}

export function publicWebUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getPublicWebBaseUrl()}${normalized}`;
}
