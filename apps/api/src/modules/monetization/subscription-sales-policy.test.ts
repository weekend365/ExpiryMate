import { afterEach, describe, expect, it } from "vitest";
import {
  householdSubscriptionSalesEnabled,
  subscriptionSalesEnabled,
} from "./subscription-sales-policy";

afterEach(() => {
  delete process.env.SUBSCRIPTIONS_ENABLED;
  delete process.env.HOUSEHOLD_SUBSCRIPTIONS_ENABLED;
  delete process.env.HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT;
  delete process.env.MONETIZATION_OFFER_MODE;
  delete process.env.MONETIZATION_EXPERIMENT_SALT;
});

describe("subscription sales policy", () => {
  it("treats SUBSCRIPTIONS_ENABLED as a sales switch only", () => {
    expect(subscriptionSalesEnabled()).toBe(false);

    process.env.SUBSCRIPTIONS_ENABLED = "true";
    expect(subscriptionSalesEnabled()).toBe(true);
  });

  it("requires personal sales, expanded mode, and household rollout for new household sales", () => {
    process.env.SUBSCRIPTIONS_ENABLED = "true";
    process.env.MONETIZATION_OFFER_MODE = "core";
    process.env.HOUSEHOLD_SUBSCRIPTIONS_ENABLED = "true";
    process.env.HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT = "100";
    process.env.MONETIZATION_EXPERIMENT_SALT = "sales-policy-test";

    expect(householdSubscriptionSalesEnabled("owner-a")).toBe(false);

    process.env.MONETIZATION_OFFER_MODE = "expanded";
    expect(householdSubscriptionSalesEnabled("owner-a")).toBe(true);

    process.env.SUBSCRIPTIONS_ENABLED = "false";
    expect(householdSubscriptionSalesEnabled("owner-a")).toBe(false);
  });
});
