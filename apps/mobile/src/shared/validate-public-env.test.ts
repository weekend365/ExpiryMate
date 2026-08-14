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

  it("requires API, OAuth redirect, Google, and Kakao in production", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "https://api.expirymate.app",
      }),
    ).toThrow(/EXPO_PUBLIC_OAUTH_REDIRECT_URI|EXPO_PUBLIC_GOOGLE|EXPO_PUBLIC_KAKAO/s);
  });

  it("rejects localhost API and mismatched OAuth redirect origins", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "http://localhost:4000",
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
        EXPO_PUBLIC_OAUTH_REDIRECT_URI:
          "https://api.expirymate.app/oauth/callback",
        EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID:
          "google-client.apps.googleusercontent.com",
        EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID: "kakao-client-id",
        EXPO_PUBLIC_NAVER_OAUTH_CLIENT_ID: "naver-client-id",
        EXPO_PUBLIC_ADMOB_IOS_APP_ID:
          "ca-app-pub-1234567890123456~1234567890",
        EXPO_PUBLIC_ADMOB_ANDROID_APP_ID:
          "ca-app-pub-1234567890123456~0987654321",
        EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID:
          "ca-app-pub-1234567890123456/1234567890",
        EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID:
          "ca-app-pub-1234567890123456/0987654321",
      }),
    ).not.toThrow();
  });

  it("rejects Google sample AdMob IDs in production", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "https://api.expirymate.app",
        EXPO_PUBLIC_OAUTH_REDIRECT_URI:
          "https://api.expirymate.app/oauth/callback",
        EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID:
          "google-client.apps.googleusercontent.com",
        EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID: "kakao-client-id",
        EXPO_PUBLIC_ADMOB_IOS_APP_ID:
          "ca-app-pub-3940256099942544~1458002511",
        EXPO_PUBLIC_ADMOB_ANDROID_APP_ID:
          "ca-app-pub-1234567890123456~0987654321",
        EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID:
          "ca-app-pub-1234567890123456/1234567890",
        EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID:
          "ca-app-pub-1234567890123456/0987654321",
      }),
    ).toThrow(/EXPO_PUBLIC_ADMOB_IOS_APP_ID/);
  });

  it("rejects placeholder Naver client ids when provided", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EXPO_PUBLIC_API_BASE_URL: "https://api.expirymate.app",
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
