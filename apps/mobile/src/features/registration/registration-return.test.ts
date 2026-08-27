import { describe, expect, it } from "vitest";
import {
  parseRegistrationReturnTo,
  photoParseRoute,
  registerRoute,
  registrationReturnHref,
  scannerRoute,
} from "./registration-return";

describe("registration return-to", () => {
  it("returns to inventory only when from=inventory", () => {
    expect(parseRegistrationReturnTo("inventory")).toBe("inventory");
    expect(parseRegistrationReturnTo(["inventory"])).toBe("inventory");
    expect(parseRegistrationReturnTo("home")).toBe("home");
    expect(parseRegistrationReturnTo(undefined)).toBe("home");
    expect(parseRegistrationReturnTo("recommendations")).toBe("home");
  });

  it("maps return-to onto the matching tab href", () => {
    expect(registrationReturnHref("inventory")).toBe("/(tabs)/inventory");
    expect(registrationReturnHref("home")).toBe("/(tabs)/home");
  });

  it("forwards from through register and scanner routes", () => {
    expect(registerRoute("inventory")).toEqual({
      pathname: "/register",
      params: { from: "inventory" },
    });
    expect(scannerRoute("home")).toEqual({
      pathname: "/scanner",
      params: { from: "home" },
    });
    expect(photoParseRoute("inventory")).toEqual({
      pathname: "/register-photo",
      params: { from: "inventory" },
    });
  });
});
