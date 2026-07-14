import { describe, expect, it } from "vitest";
import {
  buildOAuthDeepLink,
  canRedirectServerSide,
  resolveOAuthReturnUri,
} from "./oauth-callback";

describe("oauth-callback helpers", () => {
  it("resolves plain custom-scheme state", () => {
    expect(resolveOAuthReturnUri("expirymate://oauth")).toBe("expirymate://oauth");
    expect(resolveOAuthReturnUri("exp://127.0.0.1:8081/--/oauth")).toBe(
      "exp://127.0.0.1:8081/--/oauth",
    );
  });

  it("resolves em1 base64url state", () => {
    const returnUri = "exp://127.0.0.1:8081/--/oauth";
    const encoded = Buffer.from(returnUri, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    expect(resolveOAuthReturnUri(`em1.${encoded}`)).toBe(returnUri);
  });

  it("falls back when state is missing or unsafe", () => {
    expect(resolveOAuthReturnUri(undefined)).toBe("expirymate://oauth");
    expect(resolveOAuthReturnUri("https://evil.example/phish")).toBe(
      "expirymate://oauth",
    );
  });

  it("builds a clean deep link without re-embedding state", () => {
    expect(
      buildOAuthDeepLink("expirymate://oauth", {
        code: "abc",
        state: "should-not-appear",
      }),
    ).toBe("expirymate://oauth?code=abc");
  });

  it("redirects server-side when query carries auth params", () => {
    expect(canRedirectServerSide({ code: "abc" })).toBe(true);
    expect(canRedirectServerSide({ error: "access_denied" })).toBe(true);
    expect(canRedirectServerSide({ state: "expirymate://oauth" })).toBe(false);
  });
});
