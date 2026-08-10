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

  it("allows missing OPENAI_API_KEY when recipe AI is disabled", () => {
    const env = validProductionEnv();
    delete env.OPENAI_API_KEY;
    env.RECIPE_AI_ENABLED = "false";

    expect(() => validateProductionEnvironment(env)).not.toThrow();
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
    RECIPE_REWARDED_DAILY_LIMIT: "3",
    RECIPE_SUBSCRIBER_DAILY_LIMIT: "30",
    RECIPE_ABSOLUTE_DAILY_LIMIT: "30",
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
