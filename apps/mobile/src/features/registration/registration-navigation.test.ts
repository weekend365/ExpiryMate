import { beforeEach, describe, expect, it, vi } from "vitest";
import { router } from "expo-router";
import { cancelRegistration, returnFromRegistration } from "./registration-navigation";

vi.mock("expo-router", () => ({
  router: { dismissTo: vi.fn(), replace: vi.fn(), back: vi.fn() },
}));

describe("registration navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([returnFromRegistration, cancelRegistration])(
    "%s returns to the existing recommendation screen without a generation trigger",
    (leave) => {
      leave("recommendations");
      expect(router.dismissTo).toHaveBeenCalledExactlyOnceWith("/(tabs)/recommendations");
      expect(router.replace).not.toHaveBeenCalled();
      expect(router.back).not.toHaveBeenCalled();
    },
  );

  it.each(["home", "inventory"] as const)("keeps legacy completion and cancellation for %s", (destination) => {
    returnFromRegistration(destination);
    expect(router.replace).toHaveBeenCalledExactlyOnceWith(`/(tabs)/${destination}`);
    cancelRegistration(destination);
    expect(router.back).toHaveBeenCalledExactlyOnceWith();
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});
