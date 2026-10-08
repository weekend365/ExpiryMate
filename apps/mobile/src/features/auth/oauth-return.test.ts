import { describe, expect, it } from "vitest";
import { parseOAuthReturnUrl, resolveOAuthReturnScheme } from "./oauth-return";

describe("OAuth callback app selection", () => {
  it("returns to QA instead of the installed production app", () => {
    expect(resolveOAuthReturnScheme("jango-crayonqa")).toBe("jango-crayonqa");
    expect(resolveOAuthReturnScheme(["jango-crayonqa"])).toBe("jango-crayonqa");
    expect(resolveOAuthReturnScheme("expirymate")).toBe("expirymate");
    expect(resolveOAuthReturnScheme()).toBe("expirymate");
    expect(resolveOAuthReturnScheme([])).toBe("expirymate");
    expect(parseOAuthReturnUrl("jango-crayonqa://oauth?code=qa-code&state=qa-state")).toMatchObject({ code: "qa-code", state: "qa-state" });
  });
});

describe("parseOAuthReturnUrl", () => {
  it("reads query and fragment params", () => {
    expect(
      parseOAuthReturnUrl(
        "expirymate://oauth?code=abc&state=one#token=xyz",
      ),
    ).toMatchObject({
      code: "abc",
      state: "one",
      token: "xyz",
    });
  });
});
