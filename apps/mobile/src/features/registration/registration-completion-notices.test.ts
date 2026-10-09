import { describe, expect, it, vi } from "vitest";
import { ExpirySource } from "@expirymate/shared";
import { getRegistrationCompletionNotices } from "./registration-completion-notices";

describe("registration completion decorations", () => {
  it("keeps absent saved data undecorated", () => {
    const notices = getRegistrationCompletionNotices({ latestItem: null, sessionCount: 0, onRecommendations: vi.fn() });
    expect(notices).toHaveLength(1);
    expect(notices[0]?.mascotDecoration).toBeUndefined();
  });

  it("keeps recommendation/reward order and decorates the saved-item notice only", () => {
    const onRecommendations = vi.fn();
    const notices = getRegistrationCompletionNotices({
      latestItem: { displayName: "토마토", expiryDate: null, expirySource: ExpirySource.UNKNOWN },
      sessionCount: 2,
      rewardNotice: { granted: true, reason: "granted", creditsGranted: 1, balance: 2, balanceLimit: 3 },
      onRecommendations,
    });
    expect(notices.map(notice => notice.id)).toEqual(["recipe-recommend", "barcode-reward", "put-away"]);
    expect(notices.filter(notice => notice.mascotDecoration).map(notice => notice.id)).toEqual(["put-away"]);
    expect(notices[2]?.supportingMessage).toBe("기한은 모름으로 두었어요. 상태를 살펴보며 사용해 주세요.");
    expect(onRecommendations).not.toHaveBeenCalled();
    notices[0]?.onPress?.();
    expect(onRecommendations).toHaveBeenCalledOnce();
  });
});
