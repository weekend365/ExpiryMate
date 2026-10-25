import type { InventoryItem } from "@expirymate/shared";
import type { JangoHeroNoticeItem } from "../../components/JangoHeroNoticeCarousel";
import type { RegistrationRewardNotice } from "../../store/registration-store";
import { formatPutAwayMessage, formatPutAwaySupportingMessage } from "../inventory/inventory-form-copy";

/** Saved results lead the completion guide; call only after the save succeeds. */
export function getRegistrationCompletionNotices({
  latestItem,
  sessionCount,
  rewardNotice,
  onRecommendations,
}: {
  latestItem: Pick<InventoryItem, "displayName" | "expiryDate" | "expirySource"> | null | undefined;
  sessionCount: number;
  rewardNotice?: RegistrationRewardNotice | null;
  onRecommendations: () => void;
}): JangoHeroNoticeItem[] {
  return [
    {
      id: "put-away",
      mood: latestItem ? "praise" : "acknowledge",
      message: latestItem ? formatPutAwayMessage(latestItem.displayName) : "등록한 재료는 보관함에서 확인해 주세요.",
      supportingMessage: latestItem ? formatPutAwaySupportingMessage({
        expiryDate: latestItem?.expiryDate,
        expirySource: latestItem?.expirySource,
        sessionCount,
      }) : undefined,
    },
    ...(sessionCount >= 2
      ? [{
          id: "recipe-recommend",
          mood: "cooking" as const,
          message: "요리 추천 받아볼까요?",
          supportingMessage: "방금 넣은 재료로 메뉴를 찾아볼게요.",
          onPress: onRecommendations,
          actionLabel: "이 재료로 요리 추천받기",
          accessibilityHint: "추천 받을게요",
        }]
      : []),
    ...(rewardNotice?.granted
      ? [{
          id: "barcode-reward",
          mood: "happy" as const,
          message: "바코드 추천권 1회를 받았어요",
          supportingMessage: `현재 ${rewardNotice.balance}/${rewardNotice.balanceLimit}회 보유하고 있어요.`,
        }]
      : []),
  ];
}
