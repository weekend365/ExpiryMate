import { describe, expect, it } from "vitest";
import { canUseIapRuntime } from "./iap-runtime-policy";

describe("IAP runtime policy", () => {
  it("blocks Expo Go even when a module lookup reports a value", () => {
    expect(
      canUseIapRuntime({ executionEnvironment: "storeClient" }, true),
    ).toBe(false);
    expect(canUseIapRuntime({ appOwnership: "expo" }, true)).toBe(false);
  });

  it("blocks stale development builds without the native module", () => {
    expect(canUseIapRuntime({ executionEnvironment: "bare" }, false)).toBe(
      false,
    );
  });

  it("allows a native build that contains the IAP module", () => {
    expect(canUseIapRuntime({ executionEnvironment: "bare" }, true)).toBe(
      true,
    );
  });
});

