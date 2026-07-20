import { afterEach, describe, expect, it } from "vitest";
import { buildAppDeepLink, buildAuthHttpsLink } from "./app-links";

describe("app-links", () => {
  afterEach(() => {
    delete process.env.APP_BASE_URL;
    delete process.env.AUTH_LINK_BASE_URL;
  });

  it("builds expirymate:// deep links without a triple slash", () => {
    process.env.APP_BASE_URL = "expirymate://";

    expect(buildAppDeepLink("auth/verify-email", { token: "abc" })).toBe(
      "expirymate://auth/verify-email?token=abc",
    );
  });

  it("prefers HTTPS mail links when AUTH_LINK_BASE_URL is set", () => {
    process.env.APP_BASE_URL = "expirymate://";
    process.env.AUTH_LINK_BASE_URL =
      "https://api-production-1504.up.railway.app";

    expect(buildAuthHttpsLink("auth/verify-email", { token: "abc" })).toBe(
      "https://api-production-1504.up.railway.app/auth/verify-email?token=abc",
    );
  });

  it("falls back to the app deep link without AUTH_LINK_BASE_URL", () => {
    process.env.APP_BASE_URL = "expirymate://";

    expect(buildAuthHttpsLink("auth/reset-password", { token: "xyz" })).toBe(
      "expirymate://auth/reset-password?token=xyz",
    );
  });
});
