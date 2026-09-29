export type MonetizationOfferMode = "core" | "expanded";

export function getMonetizationOfferMode(): MonetizationOfferMode {
  // New products require an explicit rollout; an absent/invalid flag keeps the core offer.
  return process.env.MONETIZATION_OFFER_MODE?.trim().toLowerCase() ===
    "expanded"
    ? "expanded"
    : "core";
}

export function expandedMonetizationOffersEnabled() {
  return getMonetizationOfferMode() === "expanded";
}
