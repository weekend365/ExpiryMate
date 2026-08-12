import { describe, expect, it } from "vitest";
import { resolveMonetizationOffer } from "./monetization-offer";

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
});
