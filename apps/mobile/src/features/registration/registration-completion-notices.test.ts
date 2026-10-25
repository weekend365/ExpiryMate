import { describe, expect, it, vi } from "vitest";
import { ExpirySource } from "@expirymate/shared";
import { getRegistrationCompletionNotices } from "./registration-completion-notices";

describe("registration completion notices", () => {
  it("avoids celebrating a save without saved item data", () => {
    const notices = getRegistrationCompletionNotices({ latestItem: null, sessionCount: 0, onRecommendations: vi.fn() });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ id: "put-away", mood: "acknowledge", message: "등록한 재료는 보관함에서 확인해 주세요." });
  });

  it("keeps a single saved-item notice without recommendation or reward prompts", () => {
    const notices = getRegistrationCompletionNotices({
      latestItem: { displayName: "토마토", expiryDate: null, expirySource: ExpirySource.UNKNOWN },
      sessionCount: 1,
      onRecommendations: vi.fn(),
    });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ id: "put-away", mood: "praise", message: "토마토를 넣었어요" });
  });

  it("leads with the saved result and keeps recommendation and reward actions", () => {
    const onRecommendations = vi.fn();
    const notices = getRegistrationCompletionNotices({
      latestItem: { displayName: "토마토", expiryDate: null, expirySource: ExpirySource.UNKNOWN },
      sessionCount: 2,
      rewardNotice: { granted: true, reason: "granted", creditsGranted: 1, balance: 2, balanceLimit: 3 },
      onRecommendations,
    });
    expect(notices.map(notice => notice.id)).toEqual(["put-away", "recipe-recommend", "barcode-reward"]);
    expect(notices[0]?.message).toBe("토마토를 넣었어요");
    expect(notices[0]?.supportingMessage).toBe("기한은 모름으로 두었어요. 상태를 살펴보며 사용해 주세요.");
    expect(onRecommendations).not.toHaveBeenCalled();
    notices[1]?.onPress?.();
    expect(onRecommendations).toHaveBeenCalledOnce();
  });
});
