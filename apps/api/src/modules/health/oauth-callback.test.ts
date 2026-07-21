import { describe, expect, it } from "vitest";
import {
  buildOAuthDeepLink,
  canRedirectServerSide,
  getOAuthAppReturnAllowlist,
  isAllowedOAuthReturnUri,
} from "./oauth-callback";

describe("oauth-callback helpers", () => {
  it("allowlists only exact configured return URIs", () => {
    const allowlist = getOAuthAppReturnAllowlist(
      "expirymate://oauth,exp://127.0.0.1:8081/--/oauth",
    );

    expect(isAllowedOAuthReturnUri("expirymate://oauth", allowlist)).toBe(true);
    expect(
      isAllowedOAuthReturnUri("exp://127.0.0.1:8081/--/oauth", allowlist),
    ).toBe(true);
    expect(
      isAllowedOAuthReturnUri("https://auth.expo.io/@attacker/app", allowlist),
    ).toBe(false);
    expect(isAllowedOAuthReturnUri("https://evil.example/phish", allowlist)).toBe(
      false,
    );
  });

  it("defaults to the production app scheme when env is empty", () => {
    expect(getOAuthAppReturnAllowlist("")).toEqual(["expirymate://oauth"]);
    expect(getOAuthAppReturnAllowlist(undefined)).toEqual(["expirymate://oauth"]);
  });

  it("builds a deep link only for allowlisted return URIs", () => {
    expect(
      buildOAuthDeepLink(
        "expirymate://oauth",
        { code: "abc", state: "server-state" },
        ["expirymate://oauth"],
      ),
    ).toBe("expirymate://oauth?code=abc&state=server-state");

    expect(
      buildOAuthDeepLink(
        "https://auth.expo.io/@attacker/app",
        { code: "stolen" },
        ["expirymate://oauth"],
      ),
    ).toBe("expirymate://oauth?code=stolen");
  });

  it("redirects server-side when query carries auth params", () => {
    expect(canRedirectServerSide({ code: "abc" })).toBe(true);
    expect(canRedirectServerSide({ error: "access_denied" })).toBe(true);
    expect(canRedirectServerSide({ state: "opaque-state" })).toBe(false);
  });
});
