import { describe, expect, it } from "vitest";
import { parseOAuthReturnUrl } from "./oauth-return";

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
