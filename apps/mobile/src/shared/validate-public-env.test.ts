import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { validateExpoPublicEnv, getStoreQaAppVersion } = require("../../scripts/validate-public-env.cjs");

describe("store QA build isolation", () => {
  const qa = {
    EAS_BUILD_PROFILE: "store-qa",
    JANGO_STORE_QA_APP_VERSION: "1.4.4",
    EXPO_PUBLIC_APP_ENV: "preview",
    APP_VARIANT: "production",
    EXPO_IOS_PERSONAL_TEAM: "0",
    JANGO_STORE_QA_API_ORIGIN: "https://jango-qa.up.railway.app",
    EXPO_PUBLIC_API_BASE_URL: "https://jango-qa.up.railway.app",
    EXPO_PUBLIC_OAUTH_REDIRECT_URI: "https://jango-qa.up.railway.app/auth/oauth/callback",
  };
  it("accepts a store-signed app pointed only at the isolated HTTPS API", () => {
    expect(() => validateExpoPublicEnv(qa)).not.toThrow();
  });
  it("validates the checked-in store QA profile using the API client's real environment key", () => {
    const { build } = require("../../eas.json");
    expect(() => validateExpoPublicEnv({
      ...build.production.env,
      ...build["store-qa"].env,
      EAS_BUILD_PROFILE: "store-qa",
      EAS_BUILD: "true",
    })).not.toThrow();
    const { EXPO_PUBLIC_API_BASE_URL, ...missingApi } = qa;
    expect(() => validateExpoPublicEnv({ ...missingApi, EXPO_PUBLIC_API_URL: EXPO_PUBLIC_API_BASE_URL }))
      .toThrow("EXPO_PUBLIC_API_BASE_URL is required");
  });
  it.each([
    { JANGO_STORE_QA_API_ORIGIN: "" },
    { JANGO_STORE_QA_API_ORIGIN: "https://configure-jango-qa.invalid" },
    { EXPO_PUBLIC_API_BASE_URL: "https://api-production-1504.up.railway.app" },
    { EXPO_PUBLIC_OAUTH_REDIRECT_URI: "https://api.expirymate.app/auth/oauth/callback" },
    { EXPO_IOS_PERSONAL_TEAM: "1" },
    { APP_VARIANT: "development" },
    { EXPO_PUBLIC_APP_ENV: "production" },
    { JANGO_STORE_QA_APP_VERSION: "1.4.3" },
    { JANGO_STORE_QA_APP_VERSION: "" },
  ])("rejects incomplete or mixed QA configuration: %j", (changes) => {
    expect(() => validateExpoPublicEnv({ ...qa, ...changes })).toThrow("Invalid store QA");
  });
  it("overrides only QA marketing versions and rejects closed or malformed trains", () => {
    expect(getStoreQaAppVersion(qa)).toBe("1.4.4");
    expect(getStoreQaAppVersion({ JANGO_STORE_QA_APP_VERSION: "1.4.4" })).toBeUndefined();
    for (const version of ["1.4.2", "1.4.3", "1.4.4-beta", "bad"]) {
      expect(() => getStoreQaAppVersion({ ...qa, JANGO_STORE_QA_APP_VERSION: version })).toThrow("higher");
    }
  });
});

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
        EXPO_PUBLIC_SENTRY_DSN: "https://public@example.invalid/1",
      }),
    ).not.toThrow();
  });

  it("requires Sentry upload credentials on production EAS workers", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EAS_BUILD: "true",
        EXPO_PUBLIC_API_BASE_URL: "https://api.expirymate.app",
        EXPO_PUBLIC_OAUTH_REDIRECT_URI:
          "https://api.expirymate.app/oauth/callback",
        EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID:
          "google-client.apps.googleusercontent.com",
        EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID: "kakao-client-id",
        EXPO_PUBLIC_ADMOB_IOS_APP_ID:
          "ca-app-pub-1234567890123456~1234567890",
        EXPO_PUBLIC_ADMOB_ANDROID_APP_ID:
          "ca-app-pub-1234567890123456~0987654321",
        EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID:
          "ca-app-pub-1234567890123456/1234567890",
        EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID:
          "ca-app-pub-1234567890123456/0987654321",
        EXPO_PUBLIC_SENTRY_DSN: "https://public@example.invalid/1",
      }),
    ).toThrow(/SENTRY_AUTH_TOKEN/);
  });

  it("allows production EAS builds that explicitly disable Sentry uploads", () => {
    expect(() =>
      validateExpoPublicEnv({
        EXPO_PUBLIC_APP_ENV: "production",
        EAS_BUILD: "true",
        SENTRY_DISABLE_AUTO_UPLOAD: "true",
        EXPO_PUBLIC_API_BASE_URL: "https://api.expirymate.app",
        EXPO_PUBLIC_OAUTH_REDIRECT_URI:
          "https://api.expirymate.app/oauth/callback",
        EXPO_PUBLIC_GOOGLE_OAUTH_CLIENT_ID:
          "google-client.apps.googleusercontent.com",
        EXPO_PUBLIC_KAKAO_OAUTH_CLIENT_ID: "kakao-client-id",
        EXPO_PUBLIC_ADMOB_IOS_APP_ID:
          "ca-app-pub-1234567890123456~1234567890",
        EXPO_PUBLIC_ADMOB_ANDROID_APP_ID:
          "ca-app-pub-1234567890123456~0987654321",
        EXPO_PUBLIC_ADMOB_IOS_REWARDED_AD_UNIT_ID:
          "ca-app-pub-1234567890123456/1234567890",
        EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_AD_UNIT_ID:
          "ca-app-pub-1234567890123456/0987654321",
        EXPO_PUBLIC_SENTRY_DSN: "https://public@example.invalid/1",
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
