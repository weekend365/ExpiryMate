import { afterEach, describe, expect, it } from "vitest";
import {
  householdSubscriptionSalesEnabled,
  personalSubscriptionSalesAllowed,
  subscriptionSalesEnabled,
} from "./subscription-sales-policy";

afterEach(() => {
  delete process.env.SUBSCRIPTIONS_ENABLED;
  delete process.env.SUBSCRIPTION_COST_GATE_MODE;
  delete process.env.HOUSEHOLD_SUBSCRIPTIONS_ENABLED;
  delete process.env.HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT;
  delete process.env.MONETIZATION_OFFER_MODE;
  delete process.env.MONETIZATION_EXPERIMENT_SALT;
});

describe("subscription sales policy", () => {
  it.each([undefined, "required", "true", "override", "OPERATOR_OVERRIDE"])(
    "requires passing economics unless the exact approved mode is set: %s",
    (mode) => {
      process.env.SUBSCRIPTIONS_ENABLED = "true";
      if (mode !== undefined) process.env.SUBSCRIPTION_COST_GATE_MODE = mode;
      const economics = { subscriptions: { allowed: false, status: "learning" as const,
        projectedMonthlyCostKrw: 2190, budgetKrw: 858, recipeSamples: 4, photoSamples: 1 } };
      expect(personalSubscriptionSalesAllowed(economics)).toBe(false);
      expect(personalSubscriptionSalesAllowed({ subscriptions: { ...economics.subscriptions, allowed: true } })).toBe(true);
    },
  );

  it.each(["learning", "blocked"] as const)("allows the approved personal exception without rewriting %s economics", (status) => {
    process.env.SUBSCRIPTIONS_ENABLED = "true";
    process.env.SUBSCRIPTION_COST_GATE_MODE = "operator_override";
    const economics = { subscriptions: { allowed: false, status,
      projectedMonthlyCostKrw: 2190, budgetKrw: 858, recipeSamples: 4, photoSamples: 1 } };
    expect(personalSubscriptionSalesAllowed(economics)).toBe(true);
    expect(economics.subscriptions).toMatchObject({ allowed: false, status, budgetKrw: 858 });
    process.env.SUBSCRIPTIONS_ENABLED = "false";
    expect(personalSubscriptionSalesAllowed(economics)).toBe(false);
    expect(householdSubscriptionSalesEnabled("owner-a")).toBe(false);
  });

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
