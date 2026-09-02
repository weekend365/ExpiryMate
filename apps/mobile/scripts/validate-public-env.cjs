const REQUIRED_PRODUCTION_VALUES = [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_OAUTH_REDIRECT_URI",
  "EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID",
  "EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID",
  "EXPO_PUBLIC_ADMOB_IOS_APP_ID",
  "EXPO_PUBLIC_ADMOB_ANDROID_APP_ID",
  "EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID",
  "EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID",
  "EXPO_PUBLIC_SENTRY_DSN",
];

const REQUIRED_PRODUCTION_EAS_VALUES = ["SENTRY_AUTH_TOKEN"];

const OPTIONAL_PROVIDER_CLIENT_IDS = ["EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID"];

const GOOGLE_SAMPLE_ADMOB_IDS = new Set([
  "ca-app-pub-3940256099942544~1458002511",
  "ca-app-pub-3940256099942544~3347511713",
  "ca-app-pub-3940256099942544/1712485313",
  "ca-app-pub-3940256099942544/5224354917",
]);

function validateExpoPublicEnv(env = process.env) {
  if (env.EXPO_PUBLIC_APP_ENV !== "production") {
    return;
  }

  const errors = [];

  for (const key of REQUIRED_PRODUCTION_VALUES) {
    const value = env[key]?.trim();

    if (!value) {
      errors.push(`${key} is required for production Expo builds.`);
      continue;
    }

    if (looksLikePlaceholder(value)) {
      errors.push(`${key} must not use a placeholder value.`);
    }

    if (GOOGLE_SAMPLE_ADMOB_IDS.has(value)) {
      errors.push(`${key} must not use Google's sample AdMob ID in production.`);
    }
  }

  if (env.EAS_BUILD === "true") {
    for (const key of REQUIRED_PRODUCTION_EAS_VALUES) {
      if (!env[key]?.trim()) {
        errors.push(`${key} is required for production EAS builds.`);
      }
    }
  }

  validatePublicHttpsUrl(
    env.EXPO_PUBLIC_API_BASE_URL,
    "EXPO_PUBLIC_API_BASE_URL",
    errors,
  );
  validatePublicHttpsUrl(
    env.EXPO_PUBLIC_OAUTH_REDIRECT_URI,
    "EXPO_PUBLIC_OAUTH_REDIRECT_URI",
    errors,
  );
  validateOAuthRedirectMatchesApi(
    env.EXPO_PUBLIC_API_BASE_URL,
    env.EXPO_PUBLIC_OAUTH_REDIRECT_URI,
    errors,
  );
  for (const key of OPTIONAL_PROVIDER_CLIENT_IDS) {
    const value = env[key]?.trim();
    if (!value) {
      continue;
    }
    if (looksLikePlaceholder(value)) {
      errors.push(`${key} must not use a placeholder value when set.`);
    }
  }

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
  if (!value?.trim()) {
    return;
  }

  let url;

  try {
    url = new URL(value.trim());
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

function validateOAuthRedirectMatchesApi(apiBaseUrl, redirectUri, errors) {
  if (!apiBaseUrl?.trim() || !redirectUri?.trim()) {
    return;
  }

  let apiUrl;
  let oauthUrl;

  try {
    apiUrl = new URL(apiBaseUrl.trim());
    oauthUrl = new URL(redirectUri.trim());
  } catch {
    return;
  }

  if (apiUrl.origin !== oauthUrl.origin) {
    errors.push(
      "EXPO_PUBLIC_OAUTH_REDIRECT_URI must use the same https origin as EXPO_PUBLIC_API_BASE_URL.",
    );
  }

  if (!oauthUrl.pathname.replace(/\/+$/, "").endsWith("/oauth/callback")) {
    errors.push(
      "EXPO_PUBLIC_OAUTH_REDIRECT_URI must end with /oauth/callback.",
    );
  }
}

function looksLikePlaceholder(value) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized.includes("your-") ||
    normalized.includes("...") ||
    normalized === "changeme" ||
    normalized === "todo" ||
    normalized === "replace-me"
  );
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

if (require.main === module) {
  try {
    validateExpoPublicEnv();
    console.log("Expo public production env looks good.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  validateExpoPublicEnv,
};
