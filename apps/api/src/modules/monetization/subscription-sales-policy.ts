import { isStableMonetizationRolloutEnabled } from "./monetization-rollout";
import { expandedMonetizationOffersEnabled } from "./monetization-offer-mode";

/**
 * Controls whether *new* personal Plus checkouts are offered and accepted.
 * Existing entitlements stay in force regardless of this flag.
 *
 * `SUBSCRIPTIONS_ENABLED` is a sales switch, not an entitlement kill switch.
 */
export function subscriptionSalesEnabled() {
  return process.env.SUBSCRIPTIONS_ENABLED?.trim().toLowerCase() === "true";
}

/**
 * Controls whether *new* household Plus checkouts are offered and accepted.
 * Active household entitlements remain usable while sales are paused.
 */
export function householdSubscriptionSalesEnabled(ownerKey: string) {
  return (
    subscriptionSalesEnabled() &&
    expandedMonetizationOffersEnabled() &&
    isStableMonetizationRolloutEnabled({
      subjectKey: ownerKey,
      enabledFlag: "HOUSEHOLD_SUBSCRIPTIONS_ENABLED",
      rolloutFlag: "HOUSEHOLD_SUBSCRIPTIONS_ROLLOUT_PERCENT",
      experimentKey: "household-subscriptions",
    })
  );
}
