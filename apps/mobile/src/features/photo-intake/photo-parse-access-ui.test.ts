import type { InventoryPhotoParseAccess } from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import { resolvePhotoParseAccessUi } from "./photo-parse-access-ui";

describe("photo parse access UI", () => {
  it("allows selection for the free use and verified ad credits", () => {
    expect(resolvePhotoParseAccessUi(access("none", true), "idle", false))
      .toMatchObject({ canSelectPhoto: true, showWatchAd: false });
  });

  it("requires the ad before opening camera or album", () => {
    expect(resolvePhotoParseAccessUi(access("watch_ad", false), "idle", false))
      .toMatchObject({ canSelectPhoto: false, showWatchAd: true });
  });

  it("keeps photo selection disabled while SSV is pending", () => {
    expect(
      resolvePhotoParseAccessUi(access("watch_ad", false), "verifying", false),
    ).toMatchObject({
      canSelectPhoto: false,
      showWatchAd: false,
      showVerifying: true,
    });
  });

  it("shows exhausted and unavailable states without enabling selection", () => {
    expect(
      resolvePhotoParseAccessUi(
        access("daily_limit_reached", false),
        "idle",
        false,
      ),
    ).toMatchObject({ canSelectPhoto: false, dailyLimitReached: true });
    expect(
      resolvePhotoParseAccessUi(
        access("service_unavailable", false),
        "idle",
        false,
      ),
    ).toMatchObject({ canSelectPhoto: false, serviceUnavailable: true });
  });
});

function access(
  requiredAction: InventoryPhotoParseAccess["requiredAction"],
  canParse: boolean,
): InventoryPhotoParseAccess {
  return {
    day: "2026-08-28",
    timezone: "Asia/Seoul",
    resetsAt: "2026-08-28T15:00:00.000Z",
    canParse,
    requiredAction,
    free: { limit: 1, used: canParse ? 0 : 1, remaining: canParse ? 1 : 0 },
    rewardedAds: {
      enabled: true,
      dailyLimit: 3,
      verified: 0,
      creditsAvailable: 0,
      remainingToWatch: requiredAction === "daily_limit_reached" ? 0 : 3,
      canWatch: requiredAction === "watch_ad",
    },
  };
}
