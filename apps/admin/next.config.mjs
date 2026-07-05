/** @type {import('next').NextConfig} */
import { withSentryConfig } from "@sentry/nextjs";

validateAdminProductionEnvironment();

const nextConfig = {
  output: "standalone",
  transpilePackages: ["@expirymate/shared"],
};

const hasSentry =
  Boolean(process.env.SENTRY_DSN?.trim()) ||
  Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN?.trim());

export default hasSentry
  ? withSentryConfig(nextConfig, { silent: true })
  : nextConfig;

function validateAdminProductionEnvironment() {
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
  const isProductionDeploy =
    appEnv === "production" || process.env.VERCEL_ENV === "production";

  if (!isProductionDeploy) {
    return;
  }

  const errors = [];

  validatePublicApiBaseUrl(errors);
  validatePrivacyContactEmail(errors);

  if (errors.length > 0) {
    throw new Error(
      [
        "Invalid production Admin environment configuration.",
        ...errors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }
}

function validatePublicApiBaseUrl(errors) {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (!value) {
    errors.push("NEXT_PUBLIC_API_BASE_URL is required in production.");
    return;
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    errors.push("NEXT_PUBLIC_API_BASE_URL must be a valid HTTPS URL.");
    return;
  }

  if (url.protocol !== "https:") {
    errors.push("NEXT_PUBLIC_API_BASE_URL must use https:// in production.");
  }

  if (isUnsafeProductionHostname(url.hostname)) {
    errors.push("NEXT_PUBLIC_API_BASE_URL must not point to localhost.");
  }
}

function validatePrivacyContactEmail(errors) {
  const value = process.env.PRIVACY_CONTACT_EMAIL?.trim();

  if (!value) {
    errors.push("PRIVACY_CONTACT_EMAIL is required in production.");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.endsWith(".local")) {
    errors.push("PRIVACY_CONTACT_EMAIL must be a real public email address.");
  }
}

function isUnsafeProductionHostname(hostname) {
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
