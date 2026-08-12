export type MonetizationOfferMode = "core" | "expanded";

export function getMonetizationOfferMode(): MonetizationOfferMode {
  return process.env.MONETIZATION_OFFER_MODE?.trim().toLowerCase() === "core"
    ? "core"
    : "expanded";
}

export function expandedMonetizationOffersEnabled() {
  return getMonetizationOfferMode() === "expanded";
}
