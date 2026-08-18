import {
  ProductCategory,
  calculateDaysLeftUntilExpiry,
} from "@expirymate/shared";

export const QUICK_EXPIRY_OPTIONS = [
  { label: "오늘", days: 0 },
  { label: "내일", days: 1 },
  { label: "3일 뒤", days: 3 },
  { label: "일주일", days: 7 },
  { label: "2주", days: 14 },
  { label: "한달", days: 30 },
] as const;

export function koreanObjectParticle(word: string): "을" | "를" {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);

  if (code < 0xac00 || code > 0xd7a3) {
    return "를";
  }

  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}

export function formatPutAwayMessage(name: string) {
  const trimmed = name.trim();
  return `${trimmed}${koreanObjectParticle(trimmed)} 넣었어요`;
}

export function formatPutAwaySupportingMessage({
  expiryDate,
  sessionCount = 1,
  now,
}: {
  expiryDate?: string | null;
  sessionCount?: number;
  now?: Date;
} = {}) {
  const trimmed = expiryDate?.trim();
  if (!trimmed) {
    return "다음 재료도 이어서 넣을까요?";
  }

  const daysLeft = calculateDaysLeftUntilExpiry(trimmed, now);

  if (daysLeft < 0) {
    return "기한이 이미 지났어요. 바로 손보면 좋아요.";
  }
  if (daysLeft === 0) {
    return "오늘까지예요. 저녁에 쓰면 딱이에요.";
  }
  if (daysLeft === 1) {
    return "내일이 기한이에요. 곧 손보면 든든해요.";
  }
  if (daysLeft <= 3) {
    return `${daysLeft}일 남았어요. 여유 있을 때 써 볼까요?`;
  }
  if (daysLeft <= 7) {
    return "일주일 안에 챙기면 든든해요.";
  }
  if (sessionCount >= 2) {
    return "하나 더 챙겼어요. 냉장고가 든든해졌어요.";
  }

  return "냉장고에 잘 넣어뒀어요. 다음 재료도 이어서 넣을까요?";
}

export function formatUpdatedMessage(name: string) {
  const trimmed = name.trim();
  return `${trimmed}${koreanObjectParticle(trimmed)} 바꿔 뒀어요`;
}

export function extraDetailsRowLabel({
  brand,
  category,
  notes,
}: {
  brand?: string;
  category?: ProductCategory;
  notes?: string;
}) {
  return brand || category || notes
    ? "브랜드·메모 확인하기"
    : "브랜드·메모 더 적을게요";
}
