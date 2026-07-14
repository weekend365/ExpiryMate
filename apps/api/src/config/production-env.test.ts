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
    expect(() => validateProductionEnvironment(validProductionEnv())).not.toThrow();
  });
});

function validProductionEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    CORS_ORIGIN_ADMIN: "https://admin.expirymate.app",
    CORS_ORIGIN_MOBILE: "https://app.expirymate.app",
    AUTH_TOKEN_SECRET: "1234567890abcdef1234567890abcdef",
    AUTH_ALLOW_DEV_FALLBACK: "false",
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
    NAVER_OAUTH_CLIENT_ID: "naver-client-id",
    NAVER_OAUTH_CLIENT_SECRET: "naver-client-secret",
    PRIVACY_POLICY_URL: "https://admin.expirymate.app/privacy",
    PRIVACY_CHOICES_URL: "https://admin.expirymate.app/privacy/choices",
    PRIVACY_CONTACT_EMAIL: "privacy@expirymate.app",
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
