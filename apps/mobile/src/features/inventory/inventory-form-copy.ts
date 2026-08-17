import { ProductCategory } from "@expirymate/shared";

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
