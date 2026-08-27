import { describe, expect, it } from "vitest";
import {
  REWARDED_AD_CTA_LABEL,
  resolveMonetizationOffer,
} from "./monetization-offer";

describe("personalized monetization offer", () => {
  it.each([
    ["rewarded_ad", "rewarded_ad"],
    ["paid_credits", "paid_credits"],
    ["jango_plus", "subscription"],
    ["jango_household", "subscription"],
    ["none", "none"],
  ] as const)("maps %s to one primary action", (kind, action) => {
    expect(resolveMonetizationOffer(kind).action).toBe(action);
  });

  it("uses one CTA label for the rewarded-ad action", () => {
    expect(resolveMonetizationOffer("rewarded_ad").label).toBe(
      REWARDED_AD_CTA_LABEL,
    );
    expect(REWARDED_AD_CTA_LABEL).toBe("광고 보고 추천 받을게요");
  });
});
