const REQUIRED_PRODUCTION_VALUES = [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_IAP_PRODUCT_IDS",
  "EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID",
  "EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID",
];

function validateExpoPublicEnv(env = process.env) {
  if (env.EXPO_PUBLIC_APP_ENV !== "production") {
    return;
  }

  const errors = [];

  for (const key of REQUIRED_PRODUCTION_VALUES) {
    const value = env[key]?.trim();

    if (!value) {
      errors.push(`${key} is required for production Expo builds.`);
    }
  }

  validatePublicHttpsUrl(env.EXPO_PUBLIC_API_BASE_URL, "EXPO_PUBLIC_API_BASE_URL", errors);
  validateProductIds(env.EXPO_PUBLIC_IAP_PRODUCT_IDS, errors);

  if (errors.length > 0) {
    throw new Error(
      [
        "Invalid production Expo public environment configuration.",
        ...errors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }
}

function validatePublicHttpsUrl(value, key, errors) {
  if (!value) {
    return;
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    errors.push(`${key} must be a valid HTTPS URL.`);
    return;
  }

  if (url.protocol !== "https:") {
    errors.push(`${key} must use https:// in production.`);
  }

  if (isUnsafeProductionHostname(url.hostname)) {
    errors.push(`${key} must not point to localhost or a development host.`);
  }
}

function validateProductIds(value, errors) {
  const productIds =
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];

  if (productIds.length === 0) {
    errors.push("EXPO_PUBLIC_IAP_PRODUCT_IDS must contain at least one product id.");
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

module.exports = {
  validateExpoPublicEnv,
};
