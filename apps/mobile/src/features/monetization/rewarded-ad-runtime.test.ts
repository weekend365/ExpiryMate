import { describe, expect, it } from "vitest";
import {
  isExpoGoClient,
  resolveMobileAdsFactory,
} from "./rewarded-ad-runtime";

describe("rewarded ad runtime", () => {
  it("treats Expo Go as unable to show native ads", () => {
    expect(isExpoGoClient({ executionEnvironment: "storeClient" })).toBe(true);
    expect(isExpoGoClient({ appOwnership: "expo" })).toBe(true);
    expect(isExpoGoClient({ executionEnvironment: "bare" })).toBe(false);
  });

  it("prefers the named MobileAds export over a missing default", () => {
    const mobileAds = () => ({ initialize: async () => null });
    expect(resolveMobileAdsFactory({ MobileAds: mobileAds })).toBe(mobileAds);
    expect(resolveMobileAdsFactory({ default: undefined })).toBeNull();
  });
});
