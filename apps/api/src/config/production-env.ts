type EnvMap = NodeJS.ProcessEnv;

const PLACEHOLDER_VALUES = new Set([
  "replace-with-a-long-random-secret",
  "changeme",
  "change-me",
  "todo",
  "undefined",
  "null",
]);

const REQUIRED_PRODUCTION_VALUES = [
  "CORS_ORIGIN_ADMIN",
  "CORS_ORIGIN_MOBILE",
  "AUTH_TOKEN_SECRET",
  "APP_BASE_URL",
  "ADMIN_BASE_URL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "APPLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_ID",
  "KAKAO_OAUTH_CLIENT_ID",
  "PRIVACY_POLICY_URL",
  "PRIVACY_CHOICES_URL",
  "PRIVACY_CONTACT_EMAIL",
  "IAP_ALLOWED_PRODUCT_IDS",
  "APPLE_BUNDLE_ID",
  "APPLE_APP_STORE_ENVIRONMENT",
  "APPLE_APP_STORE_ISSUER_ID",
  "APPLE_APP_STORE_KEY_ID",
  "APPLE_APP_STORE_PRIVATE_KEY",
  "GOOGLE_PLAY_PACKAGE_NAME",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
] as const;

const HTTPS_URL_VALUES = [
  "CORS_ORIGIN_ADMIN",
  "CORS_ORIGIN_MOBILE",
  "ADMIN_BASE_URL",
  "PRIVACY_POLICY_URL",
  "PRIVACY_CHOICES_URL",
] as const;

export function validateProductionEnvironment(env: EnvMap = process.env) {
  if (env.NODE_ENV !== "production") {
    return;
  }

  const errors: string[] = [];

  for (const key of REQUIRED_PRODUCTION_VALUES) {
    requireNonPlaceholder(env, key, errors);
  }

  validateSecret(env, errors);
  validateDevFallback(env, errors);
  validateHttpsUrls(env, errors);
  validateAppBaseUrl(env, errors);
  validateEmail(env, "SMTP_FROM", errors);
  validateEmail(env, "PRIVACY_CONTACT_EMAIL", errors);
  validateSmtpPort(env, errors);
  validateAppleStoreEnvironment(env, errors);
  validateCommaList(env, "IAP_ALLOWED_PRODUCT_IDS", errors);

  if (errors.length > 0) {
    throw new Error(
      [
        "Invalid production environment configuration.",
        ...errors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }
}

function requireNonPlaceholder(
  env: EnvMap,
  key: (typeof REQUIRED_PRODUCTION_VALUES)[number],
  errors: string[],
) {
  const value = env[key]?.trim();

  if (!value) {
    errors.push(`${key} is required in production.`);
    return;
  }

  if (looksLikePlaceholder(value)) {
    errors.push(`${key} must not use a placeholder value.`);
  }
}

function validateSecret(env: EnvMap, errors: string[]) {
  const secret = env.AUTH_TOKEN_SECRET?.trim();

  if (!secret) {
    return;
  }

  if (secret.length < 32) {
    errors.push("AUTH_TOKEN_SECRET must be at least 32 characters.");
  }
}

function validateDevFallback(env: EnvMap, errors: string[]) {
  if (env.AUTH_ALLOW_DEV_FALLBACK !== "false") {
    errors.push("AUTH_ALLOW_DEV_FALLBACK must be set to false in production.");
  }
}

function validateHttpsUrls(env: EnvMap, errors: string[]) {
  for (const key of HTTPS_URL_VALUES) {
    const value = env[key]?.trim();

    if (!value) {
      continue;
    }

    const url = parseUrl(value);

    if (!url) {
      errors.push(`${key} must be a valid HTTPS URL.`);
      continue;
    }

    if (url.protocol !== "https:") {
      errors.push(`${key} must use https:// in production.`);
    }

    if (isUnsafeProductionHostname(url.hostname)) {
      errors.push(`${key} must not point to localhost or a private development host.`);
    }
  }
}

function validateAppBaseUrl(env: EnvMap, errors: string[]) {
  const value = env.APP_BASE_URL?.trim();

  if (!value) {
    return;
  }

  const url = parseUrl(value);

  if (!url) {
    errors.push("APP_BASE_URL must be a valid URL.");
    return;
  }

  if (url.protocol === "http:") {
    errors.push("APP_BASE_URL must not use http:// in production.");
  }

  if (isUnsafeProductionHostname(url.hostname)) {
    errors.push("APP_BASE_URL must not point to localhost or a private development host.");
  }
}

function validateEmail(env: EnvMap, key: string, errors: string[]) {
  const value = env[key]?.trim();

  if (!value) {
    return;
  }

  const email = extractEmailAddress(value);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push(`${key} must be a valid email address.`);
    return;
  }

  if (email.endsWith(".local")) {
    errors.push(`${key} must not use a .local development address.`);
  }
}

function validateSmtpPort(env: EnvMap, errors: string[]) {
  const port = Number(env.SMTP_PORT);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    errors.push("SMTP_PORT must be a valid TCP port.");
  }
}

function validateAppleStoreEnvironment(env: EnvMap, errors: string[]) {
  if (env.APPLE_APP_STORE_ENVIRONMENT !== "production") {
    errors.push("APPLE_APP_STORE_ENVIRONMENT must be production for production deploys.");
  }
}

function validateCommaList(env: EnvMap, key: string, errors: string[]) {
  const values =
    env[key]
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ?? [];

  if (values.length === 0) {
    errors.push(`${key} must contain at least one value.`);
  }
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function extractEmailAddress(value: string) {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim().toLowerCase();
}

function looksLikePlaceholder(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    PLACEHOLDER_VALUES.has(normalized) ||
    normalized.includes("your-") ||
    normalized.includes("...")
  );
}

function isUnsafeProductionHostname(hostname: string) {
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
