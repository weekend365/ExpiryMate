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
  // OAuth provider keys are optional at boot — validated when that login is used.
  "PRIVACY_POLICY_URL",
  "PRIVACY_CHOICES_URL",
  "PRIVACY_CONTACT_EMAIL",
] as const;

/**
 * Safe launch defaults when Railway/ops omit monetization keys.
 * Features stay off until explicitly enabled; limits match .env.production.example.
 */
export const PRODUCTION_MONETIZATION_DEFAULTS = {
  RECIPE_FREE_DAILY_LIMIT: "1",
  RECIPE_REWARDED_DAILY_LIMIT: "3",
  RECIPE_SUBSCRIBER_DAILY_LIMIT: "30",
  RECIPE_ABSOLUTE_DAILY_LIMIT: "30",
  MONETIZATION_OFFER_MODE: "core",
  MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED: "false",
  BARCODE_REWARDS_ENABLED: "false",
  BARCODE_REWARD_ROLLOUT_PERCENT: "0",
  BARCODE_REWARD_DAILY_LIMIT: "3",
  BARCODE_REWARD_BALANCE_LIMIT: "10",
  PAID_RECOMMENDATION_CREDITS_ENABLED: "false",
  REWARDED_ADS_ENABLED: "false",
  // Sales switch only — existing entitlements stay active when false.
  SUBSCRIPTIONS_ENABLED: "false",
} as const;

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

  const appliedDefaults = applyProductionMonetizationDefaults(env);
  const errors: string[] = [];

  for (const key of REQUIRED_PRODUCTION_VALUES) {
    requireNonPlaceholder(env, key, errors);
  }

  validateSecret(env, errors);
  validateDevFallback(env, errors);
  validateHttpsUrls(env, errors);
  validateAppBaseUrl(env, errors);
  validateAuthLinkBaseUrl(env, errors);
  validateOpenAi(env, errors);
  validateEmail(env, "SMTP_FROM", errors);
  validateEmail(env, "PRIVACY_CONTACT_EMAIL", errors);
  validateSmtpPort(env, errors);
  validateAppleStoreEnvironment(env, errors);
  validateMonetization(env, errors);

  if (errors.length > 0) {
    throw new Error(
      [
        "Invalid production environment configuration.",
        ...errors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }

  if (appliedDefaults.length > 0) {
    console.warn(
      `[production-env] Applied monetization defaults for missing keys: ${appliedDefaults.join(", ")}`,
    );
  }
}

function applyProductionMonetizationDefaults(env: EnvMap) {
  const applied: string[] = [];

  for (const [key, value] of Object.entries(PRODUCTION_MONETIZATION_DEFAULTS)) {
    if (env[key]?.trim()) {
      continue;
    }

    env[key] = value;
    applied.push(key);
  }

  return applied;
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
      errors.push(
        `${key} must not point to localhost or a private development host.`,
      );
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
    errors.push(
      "APP_BASE_URL must not point to localhost or a private development host.",
    );
  }
}

/**
 * Email verify/reset links must hit a public HTTPS API bridge in production.
 * Deep-link-only fallbacks break most mail clients.
 */
function validateAuthLinkBaseUrl(env: EnvMap, errors: string[]) {
  const value = env.AUTH_LINK_BASE_URL?.trim();

  if (!value) {
    errors.push("AUTH_LINK_BASE_URL is required in production.");
    return;
  }

  if (looksLikePlaceholder(value)) {
    errors.push("AUTH_LINK_BASE_URL must not use a placeholder value.");
    return;
  }

  const url = parseUrl(value);

  if (!url) {
    errors.push("AUTH_LINK_BASE_URL must be a valid HTTPS URL.");
    return;
  }

  if (url.protocol !== "https:") {
    errors.push("AUTH_LINK_BASE_URL must use https:// in production.");
  }

  if (isUnsafeProductionHostname(url.hostname)) {
    errors.push(
      "AUTH_LINK_BASE_URL must not point to localhost or a private development host.",
    );
  }
}

/**
 * Recipe AI is on unless explicitly disabled — require a real OpenAI key then.
 */
function validateOpenAi(env: EnvMap, errors: string[]) {
  if (!isRecipeAiEnabled(env)) {
    return;
  }

  const value = env.OPENAI_API_KEY?.trim();

  if (!value) {
    errors.push(
      "OPENAI_API_KEY is required when RECIPE_AI_ENABLED is on (default).",
    );
    return;
  }

  if (looksLikePlaceholder(value) || value === "sk-...") {
    errors.push("OPENAI_API_KEY must not use a placeholder value.");
  }
}

function isRecipeAiEnabled(env: EnvMap) {
  const raw = env.RECIPE_AI_ENABLED?.trim().toLowerCase();
  return !(raw === "false" || raw === "0" || raw === "off");
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
  if (!isEnabled(env.SUBSCRIPTIONS_ENABLED)) {
    return;
  }

  if (env.APPLE_APP_STORE_ENVIRONMENT !== "production") {
    errors.push(
      "APPLE_APP_STORE_ENVIRONMENT must be production for production deploys.",
    );
  }
}

function validateMonetization(env: EnvMap, errors: string[]) {
  if (
    !["core", "expanded"].includes(
      env.MONETIZATION_OFFER_MODE?.trim().toLowerCase() ?? "",
    )
  ) {
    errors.push("MONETIZATION_OFFER_MODE must be core or expanded.");
  }
  validateBooleanFlag(
    env,
    "MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED",
    errors,
  );
  validateBooleanFlag(env, "REWARDED_ADS_ENABLED", errors);
  validateBooleanFlag(env, "SUBSCRIPTIONS_ENABLED", errors);
  validateBooleanFlag(env, "BARCODE_REWARDS_ENABLED", errors);
  validateBooleanFlag(env, "PAID_RECOMMENDATION_CREDITS_ENABLED", errors);

  for (const key of [
    "RECIPE_FREE_DAILY_LIMIT",
    "RECIPE_REWARDED_DAILY_LIMIT",
    "RECIPE_SUBSCRIBER_DAILY_LIMIT",
    "RECIPE_ABSOLUTE_DAILY_LIMIT",
  ]) {
    const value = Number(env[key]);
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${key} must be a non-negative integer.`);
    }
  }

  for (const key of [
    "MONETIZATION_VALUE_FIRST_ROLLOUT_PERCENT",
    "RECIPE_VALUE_FIRST_FREE_DAILY_LIMIT",
    "RECIPE_VALUE_FIRST_REWARDED_DAILY_LIMIT",
    "BARCODE_REWARD_ROLLOUT_PERCENT",
    "BARCODE_REWARD_DAILY_LIMIT",
    "BARCODE_REWARD_BALANCE_LIMIT",
  ]) {
    if (env[key] === undefined || env[key] === "") continue;
    const value = Number(env[key]);
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${key} must be a non-negative integer.`);
    }
  }

  const rolloutPercent = Number(
    env.MONETIZATION_VALUE_FIRST_ROLLOUT_PERCENT ?? 0,
  );
  if (Number.isFinite(rolloutPercent) && rolloutPercent > 100) {
    errors.push(
      "MONETIZATION_VALUE_FIRST_ROLLOUT_PERCENT must be between 0 and 100.",
    );
  }
  if (
    Number.isFinite(rolloutPercent) &&
    rolloutPercent > 0 &&
    !env.MONETIZATION_EXPERIMENT_SALT?.trim()
  ) {
    errors.push(
      "MONETIZATION_EXPERIMENT_SALT is required when the monetization experiment is enabled.",
    );
  }

  const barcodeRolloutPercent = Number(
    env.BARCODE_REWARD_ROLLOUT_PERCENT ?? 0,
  );
  if (
    Number.isFinite(barcodeRolloutPercent) &&
    barcodeRolloutPercent > 100
  ) {
    errors.push("BARCODE_REWARD_ROLLOUT_PERCENT must be between 0 and 100.");
  }
  if (isEnabled(env.BARCODE_REWARDS_ENABLED)) {
    requireFeatureValue(
      env,
      "BARCODE_REWARD_TOKEN_SECRET",
      "BARCODE_REWARDS_ENABLED",
      errors,
    );
    if (!env.MONETIZATION_EXPERIMENT_SALT?.trim()) {
      errors.push(
        "MONETIZATION_EXPERIMENT_SALT is required when barcode rewards are enabled.",
      );
    }
  }

  if (isEnabled(env.REWARDED_ADS_ENABLED)) {
    for (const key of [
      "ADMOB_IOS_REWARDED_AD_UNIT_ID",
      "ADMOB_ANDROID_REWARDED_AD_UNIT_ID",
      "ADMOB_SSV_USER_ID_SECRET",
    ]) {
      requireFeatureValue(env, key, "REWARDED_ADS_ENABLED", errors);
    }
  }

  if (isEnabled(env.SUBSCRIPTIONS_ENABLED)) {
    for (const key of [
      "IAP_ALLOWED_PRODUCT_IDS",
      "APPLE_BUNDLE_ID",
      "APPLE_APP_STORE_ENVIRONMENT",
      "APPLE_APP_STORE_ISSUER_ID",
      "APPLE_APP_STORE_KEY_ID",
      "APPLE_APP_STORE_PRIVATE_KEY",
      "APPLE_ROOT_CERTIFICATES_BASE64",
      "APPLE_APP_ID",
      "GOOGLE_PLAY_PACKAGE_NAME",
      "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
      "GOOGLE_RTDN_AUDIENCE",
    ]) {
      requireFeatureValue(env, key, "SUBSCRIPTIONS_ENABLED", errors);
    }
    validateCommaList(env, "IAP_ALLOWED_PRODUCT_IDS", errors);
  }

  for (const [enabledKey, rolloutKey] of [
    [
      "PERSONALIZED_MONETIZATION_OFFERS_ENABLED",
      "PERSONALIZED_MONETIZATION_OFFERS_ROLLOUT_PERCENT",
    ],
    [
      "MONETIZATION_REVENUE_LEDGER_ENABLED",
      "MONETIZATION_REVENUE_LEDGER_ROLLOUT_PERCENT",
    ],
    [
      "HOUSEHOLD_SUBSCRIPTIONS_ENABLED",
      "HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT",
    ],
  ] as const) {
    const rollout = Number(env[rolloutKey] ?? 0);
    if (!Number.isInteger(rollout) || rollout < 0 || rollout > 100) {
      errors.push(`${rolloutKey} must be between 0 and 100.`);
    }
    if (isEnabled(env[enabledKey]) && !env.MONETIZATION_EXPERIMENT_SALT?.trim()) {
      errors.push(
        `MONETIZATION_EXPERIMENT_SALT is required when ${enabledKey} is enabled.`,
      );
    }
  }
  if (
    isEnabled(env.HOUSEHOLD_SUBSCRIPTIONS_ENABLED) &&
    !isEnabled(env.SUBSCRIPTIONS_ENABLED)
  ) {
    errors.push(
      "SUBSCRIPTIONS_ENABLED must be enabled when HOUSEHOLD_SUBSCRIPTIONS_ENABLED is enabled.",
    );
  }

  let monetizationEstimatesValid = false;
  if (env.MONETIZATION_ESTIMATES_JSON?.trim()) {
    try {
      const estimates = JSON.parse(env.MONETIZATION_ESTIMATES_JSON) as {
        usdKrw?: unknown;
        rewardedAdEcpmKrw?: unknown;
        productNetProceedsKrw?: unknown;
      };
      if (
        typeof estimates.usdKrw !== "number" ||
        estimates.usdKrw <= 0 ||
        typeof estimates.rewardedAdEcpmKrw !== "number" ||
        estimates.rewardedAdEcpmKrw <= 0 ||
        !estimates.productNetProceedsKrw ||
        typeof estimates.productNetProceedsKrw !== "object" ||
        Array.isArray(estimates.productNetProceedsKrw) ||
        Object.keys(estimates.productNetProceedsKrw).length === 0 ||
        Object.values(estimates.productNetProceedsKrw).some(
          (value) =>
            typeof value !== "number" ||
            !Number.isFinite(value) ||
            value < 0,
        )
      ) {
        errors.push("MONETIZATION_ESTIMATES_JSON has an invalid shape.");
      } else {
        monetizationEstimatesValid = true;
      }
    } catch {
      errors.push("MONETIZATION_ESTIMATES_JSON must be valid JSON.");
    }
  }

  for (const key of [
    "MONETIZATION_GUARDRAIL_LOOKBACK_DAYS",
    "MONETIZATION_GUARDRAIL_MIN_SAMPLES",
    "MONETIZATION_GUARDRAIL_CACHE_SECONDS",
    "REWARDED_AD_COST_COVERAGE_TARGET",
    "PAID_CREDIT_COST_COVERAGE_TARGET",
    "MONETIZATION_SUBSCRIBER_DAILY_AI_BUDGET_KRW",
    "MONETIZATION_HOUSEHOLD_DAILY_AI_BUDGET_KRW",
  ]) {
    if (env[key] === undefined || env[key] === "") continue;
    const value = Number(env[key]);
    if (!Number.isFinite(value) || value <= 0) {
      errors.push(`${key} must be a positive number.`);
    }
  }
  if (isEnabled(env.MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED)) {
    if (!isEnabled(env.MONETIZATION_REVENUE_LEDGER_ENABLED)) {
      errors.push(
        "MONETIZATION_REVENUE_LEDGER_ENABLED must be enabled when unit-economics guardrails are enabled.",
      );
    }
    if (Number(env.MONETIZATION_REVENUE_LEDGER_ROLLOUT_PERCENT) !== 100) {
      errors.push(
        "MONETIZATION_REVENUE_LEDGER_ROLLOUT_PERCENT must be 100 when unit-economics guardrails are enabled.",
      );
    }
    if (!monetizationEstimatesValid) {
      errors.push(
        "MONETIZATION_ESTIMATES_JSON must be configured when unit-economics guardrails are enabled.",
      );
    }
    if (isEnabled(env.SUBSCRIPTIONS_ENABLED)) {
      for (const key of [
        "MONETIZATION_SUBSCRIBER_DAILY_AI_BUDGET_KRW",
        "MONETIZATION_HOUSEHOLD_DAILY_AI_BUDGET_KRW",
      ]) {
        if (!env[key]?.trim()) {
          errors.push(
            `${key} is required when subscriptions and unit-economics guardrails are enabled.`,
          );
        }
      }
    }
  }

  if (isEnabled(env.PAID_RECOMMENDATION_CREDITS_ENABLED)) {
    const products = env.RECOMMENDATION_CREDIT_PRODUCTS?.trim();
    if (!products) {
      errors.push(
        "RECOMMENDATION_CREDIT_PRODUCTS is required when paid recommendation credits are enabled.",
      );
    } else if (
      products.split(",").some((entry) => {
        const [productId, credits, ...extra] = entry.split(":");
        return (
          extra.length > 0 ||
          !productId?.trim() ||
          !Number.isInteger(Number(credits)) ||
          Number(credits) <= 0
        );
      })
    ) {
      errors.push(
        "RECOMMENDATION_CREDIT_PRODUCTS must use product_id:positive_credits entries.",
      );
    }
    for (const key of [
      "APPLE_BUNDLE_ID",
      "APPLE_APP_STORE_ENVIRONMENT",
      "APPLE_APP_STORE_ISSUER_ID",
      "APPLE_APP_STORE_KEY_ID",
      "APPLE_APP_STORE_PRIVATE_KEY",
      "GOOGLE_PLAY_PACKAGE_NAME",
      "GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY",
    ]) {
      requireFeatureValue(
        env,
        key,
        "PAID_RECOMMENDATION_CREDITS_ENABLED",
        errors,
      );
    }
  }
}

function validateBooleanFlag(
  env: EnvMap,
  key: string,
  errors: string[],
) {
  if (!["true", "false"].includes(env[key]?.trim().toLowerCase() ?? "")) {
    errors.push(`${key} must be true or false.`);
  }
}

function requireFeatureValue(
  env: EnvMap,
  key: string,
  featureFlag: string,
  errors: string[],
) {
  const value = env[key]?.trim();
  if (!value || looksLikePlaceholder(value)) {
    errors.push(`${key} is required when ${featureFlag}=true.`);
  }
}

function isEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
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
