import { describe, expect, it } from "vitest";
import {
  parseRegistrationReturnTo,
  photoParseRoute,
  registerRoute,
  registrationReturnHref,
  registrationReturnLabel,
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

  it("accepts the explicit recommendation return context without reinterpreting legacy from", () => {
    expect(parseRegistrationReturnTo("home", "recommendations")).toBe("recommendations");
    expect(parseRegistrationReturnTo(undefined, ["recommendations"])).toBe("recommendations");
    expect(parseRegistrationReturnTo("recommendations")).toBe("home");
  });

  it.each([undefined, "", "unknown", "https://example.com", [], ["unknown", "recommendations"]])(
    "ignores an invalid return context: %j",
    (context) => {
      expect(parseRegistrationReturnTo("inventory", context)).toBe("inventory");
      expect(parseRegistrationReturnTo("unknown", context)).toBe("home");
    },
  );

  it.each([registerRoute, scannerRoute, photoParseRoute])(
    "preserves the recommendation destination when entering through %s and switching methods",
    (entryRoute) => {
      const entry = entryRoute("recommendations");
      const destination = parseRegistrationReturnTo(entry.params.from, entry.params.returnTo);
      expect(destination).toBe("recommendations");
      // A client that only knows the old `from` parameter still has a valid fallback.
      expect(parseRegistrationReturnTo(entry.params.from)).toBe("home");
      for (const switchMethod of [registerRoute, scannerRoute, photoParseRoute]) {
        const next = switchMethod(destination);
        const nextDestination = parseRegistrationReturnTo(next.params.from, next.params.returnTo);
        expect(registrationReturnHref(nextDestination)).toBe("/(tabs)/recommendations");
        expect(next.params).not.toHaveProperty("autoGenerateAt");
      }
    },
  );

  it.each([
    ["home", "/(tabs)/home", "홈으로 돌아가기"],
    ["inventory", "/(tabs)/inventory", "보관함으로 이동"],
    ["recommendations", "/(tabs)/recommendations", "추천으로 돌아가기"],
  ] as const)("names the actual destination for %s", (destination, href, label) => {
    expect(registrationReturnHref(destination)).toBe(href);
    expect(registrationReturnLabel(destination)).toBe(label);
  });
});
