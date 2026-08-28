import { describe, expect, it } from "vitest";
import { validateProductionEnvironment } from "./production-env";

describe("validateProductionEnvironment", () => {
  it("skips validation outside production", () => {
    expect(() =>
      validateProductionEnvironment({
        NODE_ENV: "development",
      }),
    ).not.toThrow();
  });

  it("reports missing and unsafe production values together", () => {
    expect(() =>
      validateProductionEnvironment({
        NODE_ENV: "production",
        AUTH_TOKEN_SECRET: "replace-with-a-long-random-secret",
        AUTH_ALLOW_DEV_FALLBACK: "true",
        PRIVACY_POLICY_URL: "http://localhost:3000/privacy",
      }),
    ).toThrow(/AUTH_ALLOW_DEV_FALLBACK.*PRIVACY_POLICY_URL/s);
  });

  it("accepts a complete production configuration", () => {
    expect(() =>
      validateProductionEnvironment(validProductionEnv()),
    ).not.toThrow();
  });

  it("allows production without Naver OAuth credentials", () => {
    const env = validProductionEnv();
    delete env.NAVER_OAUTH_CLIENT_ID;
    delete env.NAVER_OAUTH_CLIENT_SECRET;

    expect(() => validateProductionEnvironment(env)).not.toThrow();
  });

  it("requires AUTH_LINK_BASE_URL as a public HTTPS URL", () => {
    const env = validProductionEnv();
    delete env.AUTH_LINK_BASE_URL;

    expect(() => validateProductionEnvironment(env)).toThrow(
      /AUTH_LINK_BASE_URL/,
    );

    env.AUTH_LINK_BASE_URL = "http://localhost:4000";
    expect(() => validateProductionEnvironment(env)).toThrow(
      /AUTH_LINK_BASE_URL/,
    );
  });

  it("requires OPENAI_API_KEY when recipe AI is enabled", () => {
    const env = validProductionEnv();
    delete env.OPENAI_API_KEY;

    expect(() => validateProductionEnvironment(env)).toThrow(/OPENAI_API_KEY/);
  });

  it("allows missing OPENAI_API_KEY when both AI features are disabled", () => {
    const env = validProductionEnv();
    delete env.OPENAI_API_KEY;
    env.RECIPE_AI_ENABLED = "false";
    env.INVENTORY_PHOTO_PARSE_ENABLED = "false";

    expect(() => validateProductionEnvironment(env)).not.toThrow();
  });

  it("treats photo parsing as enabled unless explicitly disabled", () => {
    const env = validProductionEnv();
    env.RECIPE_AI_ENABLED = "false";
    env.INVENTORY_PHOTO_PARSE_MODEL = "unknown-photo-model";
    delete env.INVENTORY_PHOTO_PARSE_ENABLED;

    expect(() => validateProductionEnvironment(env)).toThrow(
      /INVENTORY_PHOTO_PARSE_MODEL/,
    );

    env.INVENTORY_PHOTO_PARSE_ENABLED = "false";
    expect(() => validateProductionEnvironment(env)).not.toThrow();
  });

  it("requires OPENAI_API_KEY when photo parse is enabled", () => {
    const env = validProductionEnv();
    delete env.OPENAI_API_KEY;
    env.RECIPE_AI_ENABLED = "false";
    env.INVENTORY_PHOTO_PARSE_ENABLED = "true";

    expect(() => validateProductionEnvironment(env)).toThrow(/OPENAI_API_KEY/);
  });

  it("validates the recipe model canary configuration", () => {
    const env = validProductionEnv();
    env.RECIPE_AI_CANDIDATE_PERCENT = "5.5";
    expect(() => validateProductionEnvironment(env)).toThrow(
      /RECIPE_AI_CANDIDATE_PERCENT/,
    );

    env.RECIPE_AI_CANDIDATE_PERCENT = "5";
    delete env.RECIPE_AI_CANDIDATE_MODEL;
    expect(() => validateProductionEnvironment(env)).toThrow(
      /RECIPE_AI_CANDIDATE_MODEL/,
    );

    env.RECIPE_AI_CANDIDATE_MODEL = "gpt-5.6-terra";
    expect(() => validateProductionEnvironment(env)).not.toThrow();
  });

  it("rejects OpenAI models without registered pricing", () => {
    const env = validProductionEnv();
    env.RECIPE_AI_MODEL = "unknown-recipe-model";
    expect(() => validateProductionEnvironment(env)).toThrow(/RECIPE_AI_MODEL/);

    env.RECIPE_AI_MODEL = "gpt-5.4-mini";
    env.INVENTORY_PHOTO_PARSE_ENABLED = "true";
    env.INVENTORY_PHOTO_PARSE_MODEL = "unknown-photo-model";
    expect(() => validateProductionEnvironment(env)).toThrow(
      /INVENTORY_PHOTO_PARSE_MODEL/,
    );
  });

  it("requires reward secrets when barcode rewards are enabled", () => {
    const env = validProductionEnv();
    env.BARCODE_REWARDS_ENABLED = "true";
    env.BARCODE_REWARD_ROLLOUT_PERCENT = "10";

    expect(() => validateProductionEnvironment(env)).toThrow(
      /BARCODE_REWARD_TOKEN_SECRET.*MONETIZATION_EXPERIMENT_SALT/s,
    );

    env.BARCODE_REWARD_TOKEN_SECRET =
      "1234567890abcdef1234567890abcdef";
    env.MONETIZATION_EXPERIMENT_SALT =
      "abcdef1234567890abcdef1234567890";
    expect(() => validateProductionEnvironment(env)).not.toThrow();
  });

  it("requires a valid catalog when paid recommendation credits are enabled", () => {
    const env = validProductionEnv();
    env.PAID_RECOMMENDATION_CREDITS_ENABLED = "true";
    delete env.RECOMMENDATION_CREDIT_PRODUCTS;
    expect(() => validateProductionEnvironment(env)).toThrow(
      /RECOMMENDATION_CREDIT_PRODUCTS/,
    );

    env.RECOMMENDATION_CREDIT_PRODUCTS = "credits_5:5,credits_15:15";
    expect(() => validateProductionEnvironment(env)).not.toThrow();
  });

  it("requires complete revenue data before enabling automatic economics guardrails", () => {
    const env = validProductionEnv();
    env.MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED = "true";

    expect(() => validateProductionEnvironment(env)).toThrow(
      /MONETIZATION_REVENUE_LEDGER_ENABLED.*MONETIZATION_ESTIMATES_JSON/s,
    );

    env.MONETIZATION_REVENUE_LEDGER_ENABLED = "true";
    env.MONETIZATION_REVENUE_LEDGER_ROLLOUT_PERCENT = "100";
    env.MONETIZATION_EXPERIMENT_SALT =
      "abcdef1234567890abcdef1234567890";
    env.MONETIZATION_ESTIMATES_JSON = JSON.stringify({
      usdKrw: 1300,
      rewardedAdEcpmKrw: 5000,
      productNetProceedsKrw: { expirymate_premium_monthly: 3000 },
    });
    expect(() => validateProductionEnvironment(env)).not.toThrow();
  });

  it("applies safe monetization defaults when production omits those keys", () => {
    const env = validProductionEnv();
    delete env.RECIPE_FREE_DAILY_LIMIT;
    delete env.RECIPE_REWARDED_DAILY_LIMIT;
    delete env.RECIPE_SUBSCRIBER_DAILY_LIMIT;
    delete env.RECIPE_ABSOLUTE_DAILY_LIMIT;
    delete env.MONETIZATION_OFFER_MODE;
    delete env.MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED;
    delete env.BARCODE_REWARDS_ENABLED;
    delete env.BARCODE_REWARD_ROLLOUT_PERCENT;
    delete env.BARCODE_REWARD_DAILY_LIMIT;
    delete env.BARCODE_REWARD_BALANCE_LIMIT;
    delete env.PAID_RECOMMENDATION_CREDITS_ENABLED;
    delete env.REWARDED_ADS_ENABLED;
    delete env.SUBSCRIPTIONS_ENABLED;
    delete env.AFFILIATE_OFFERS_ENABLED;

    expect(() => validateProductionEnvironment(env)).not.toThrow();
    expect(env.MONETIZATION_OFFER_MODE).toBe("core");
    expect(env.REWARDED_ADS_ENABLED).toBe("false");
    expect(env.SUBSCRIPTIONS_ENABLED).toBe("false");
    expect(env.AFFILIATE_OFFERS_ENABLED).toBe("false");
    expect(env.RECIPE_FREE_DAILY_LIMIT).toBe("1");
  });

  it("still rejects invalid monetization values when they are set", () => {
    const env = validProductionEnv();
    env.MONETIZATION_OFFER_MODE = "legacy";
    env.RECIPE_FREE_DAILY_LIMIT = "-1";

    expect(() => validateProductionEnvironment(env)).toThrow(
      /MONETIZATION_OFFER_MODE.*RECIPE_FREE_DAILY_LIMIT/s,
    );
  });

  it("requires Coupang Partners credentials as a complete pair", () => {
    const env = validProductionEnv();
    env.COUPANG_PARTNERS_ACCESS_KEY = "access-key";

    expect(() => validateProductionEnvironment(env)).toThrow(
      /COUPANG_PARTNERS_ACCESS_KEY.*COUPANG_PARTNERS_SECRET_KEY/s,
    );
  });

  it("requires credentials when Coupang report sync is enabled", () => {
    const env = validProductionEnv();
    env.COUPANG_REPORT_SYNC_ENABLED = "true";

    expect(() => validateProductionEnvironment(env)).toThrow(
      /credentials are required when COUPANG_REPORT_SYNC_ENABLED/i,
    );

    env.COUPANG_PARTNERS_ACCESS_KEY = "access-key";
    env.COUPANG_PARTNERS_SECRET_KEY = "secret-key";
    expect(() => validateProductionEnvironment(env)).not.toThrow();
  });

  it("requires an API key pair or tracking fallback when affiliate offers are enabled", () => {
    const env = validProductionEnv();
    env.AFFILIATE_OFFERS_ENABLED = "true";

    expect(() => validateProductionEnvironment(env)).toThrow(
      /COUPANG_PARTNERS_TRACKING_LINK/,
    );

    env.COUPANG_PARTNERS_TRACKING_LINK = "https://link.coupang.com/a/example";
    expect(() => validateProductionEnvironment(env)).not.toThrow();
  });

  it("limits Coupang products per ingredient to one through three", () => {
    const env = validProductionEnv();
    env.AFFILIATE_MAX_PRODUCTS_PER_INGREDIENT = "0";
    expect(() => validateProductionEnvironment(env)).toThrow(
      /AFFILIATE_MAX_PRODUCTS_PER_INGREDIENT/,
    );

    env.AFFILIATE_MAX_PRODUCTS_PER_INGREDIENT = "3";
    expect(() => validateProductionEnvironment(env)).not.toThrow();
  });
});

function validProductionEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    CORS_ORIGIN_ADMIN: "https://admin.expirymate.app",
    CORS_ORIGIN_MOBILE: "https://app.expirymate.app",
    AUTH_TOKEN_SECRET: "1234567890abcdef1234567890abcdef",
    AUTH_ALLOW_DEV_FALLBACK: "false",
    AUTH_LINK_BASE_URL: "https://api.expirymate.app",
    APP_BASE_URL: "expirymate://",
    ADMIN_BASE_URL: "https://admin.expirymate.app",
    SMTP_HOST: "smtp.expirymate.app",
    SMTP_PORT: "587",
    SMTP_USER: "smtp-user",
    SMTP_PASS: "smtp-pass",
    SMTP_FROM: "Jango <no-reply@expirymate.app>",
    APPLE_OAUTH_CLIENT_ID: "com.expirymate.mobile",
    GOOGLE_OAUTH_CLIENT_ID: "google-client-id.apps.googleusercontent.com",
    KAKAO_OAUTH_CLIENT_ID: "kakao-client-id",
    PRIVACY_POLICY_URL: "https://admin.expirymate.app/privacy",
    PRIVACY_CHOICES_URL: "https://admin.expirymate.app/privacy/choices",
    PRIVACY_CONTACT_EMAIL: "privacy@expirymate.app",
    OPENAI_API_KEY: "sk-live-test-key-not-a-placeholder",
    RECIPE_FREE_DAILY_LIMIT: "1",
    RECIPE_REWARDED_DAILY_LIMIT: "10",
    RECIPE_SUBSCRIBER_DAILY_LIMIT: "30",
    RECIPE_ABSOLUTE_DAILY_LIMIT: "30",
    MONETIZATION_OFFER_MODE: "core",
    MONETIZATION_UNIT_ECONOMICS_GUARDRAILS_ENABLED: "false",
    BARCODE_REWARDS_ENABLED: "false",
    BARCODE_REWARD_ROLLOUT_PERCENT: "0",
    BARCODE_REWARD_DAILY_LIMIT: "3",
    BARCODE_REWARD_BALANCE_LIMIT: "10",
    PAID_RECOMMENDATION_CREDITS_ENABLED: "false",
    RECOMMENDATION_CREDIT_PRODUCTS:
      "expirymate_recipe_credits_5:5,expirymate_recipe_credits_15:15",
    REWARDED_ADS_ENABLED: "false",
    SUBSCRIPTIONS_ENABLED: "false",
    IAP_ALLOWED_PRODUCT_IDS:
      "expirymate_premium_monthly,expirymate_premium_yearly",
    APPLE_BUNDLE_ID: "com.expirymate.mobile",
    APPLE_APP_STORE_ENVIRONMENT: "production",
    APPLE_APP_STORE_ISSUER_ID: "apple-issuer-id",
    APPLE_APP_STORE_KEY_ID: "apple-key-id",
    APPLE_APP_STORE_PRIVATE_KEY:
      "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----",
    GOOGLE_PLAY_PACKAGE_NAME: "com.expirymate.mobile",
    GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL:
      "iap-verifier@expirymate-prod.iam.gserviceaccount.com",
    GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY:
      "-----BEGIN PRIVATE KEY-----\\nkey\\n-----END PRIVATE KEY-----",
  };
}
