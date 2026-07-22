import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { validateExpoPublicEnv } = require("../../scripts/validate-public-env.cjs");

describe("validateExpoPublicEnv", () => {
  it("skips validation outside production", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "development",
      }),
    ).not.toThrow();
  });

  it("requires API, IAP, OAuth redirect, Google, and Kakao in production", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "https://api.expirymate.app",
      }),
    ).toThrow(/EXPO_PUBLIC_OAUTH_REDIRECT_URI|EXPO_PUBLIC_IAP_PRODUCT_IDS|EXPO_PUBLIC_GOOGLE|EXPO_PUBLIC_KAKAO/s);
  });

  it("rejects localhost API and mismatched OAuth redirect origins", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "http://localhost:4000",
        EXPO_PUBLIC_IAP_PRODUCT_IDS: "expirymate_premium_monthly",
        EXPO_PUBLIC_OAUTH_REDIRECT_URI: "https://api.expirymate.app/oauth/callback",
        EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: "google-client.apps.googleusercontent.com",
        EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID: "kakao-client-id",
      }),
    ).toThrow(/EXPO_PUBLIC_API_BASE_URL/);
  });

  it("accepts a complete production configuration", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "https://api.expirymate.app",
        EXPO_PUBLIC_IAP_PRODUCT_IDS:
          "expirymate_premium_monthly,expirymate_premium_yearly",
        EXPO_PUBLIC_OAUTH_REDIRECT_URI:
          "https://api.expirymate.app/oauth/callback",
        EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID:
          "google-client.apps.googleusercontent.com",
        EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID: "kakao-client-id",
        EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID: "naver-client-id",
      }),
    ).not.toThrow();
  });

  it("rejects placeholder Naver client ids when provided", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "https://api.expirymate.app",
        EXPO_PUBLIC_IAP_PRODUCT_IDS: "expirymate_premium_monthly",
        EXPO_PUBLIC_OAUTH_REDIRECT_URI:
          "https://api.expirymate.app/oauth/callback",
        EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID:
          "google-client.apps.googleusercontent.com",
        EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID: "kakao-client-id",
        EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID: "your-naver-client-id",
      }),
    ).toThrow(/EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID/);
  });
});
