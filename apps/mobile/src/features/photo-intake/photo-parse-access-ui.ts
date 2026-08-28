import type { InventoryPhotoParseAccess } from "@expirymate/shared";
import type { PhotoParseAdState } from "./use-photo-parse-access";

export function resolvePhotoParseAccessUi(
  access: InventoryPhotoParseAccess | undefined,
  adState: PhotoParseAdState,
  isLoading: boolean,
) {
  return {
    canSelectPhoto:
      access?.canParse === true && adState === "idle" && !isLoading,
    showWatchAd:
      access?.requiredAction === "watch_ad" && adState !== "verifying",
    showVerifying: adState === "verifying",
    dailyLimitReached: access?.requiredAction === "daily_limit_reached",
    serviceUnavailable: access?.requiredAction === "service_unavailable",
  };
}
