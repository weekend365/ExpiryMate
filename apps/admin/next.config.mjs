/** @type {import('next').NextConfig} */
validateAdminProductionEnvironment();

const nextConfig = {
  transpilePackages: ["@expirymate/shared"],
};

export default nextConfig;

function validateAdminProductionEnvironment() {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_APP_ENV !== "production" &&
    process.env.VERCEL_ENV !== "production"
  ) {
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
