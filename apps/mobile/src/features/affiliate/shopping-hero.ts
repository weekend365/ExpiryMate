import type { MascotMood } from "../../components/Mascot";

export function getShoppingHeroNotice(input: {
  isSearching: boolean;
  hasSearchError: boolean;
  hasSearchResults: boolean;
  searchWasEmpty: boolean;
  isShoppingLoading: boolean;
  isShoppingError: boolean;
  isShoppingEnabled: boolean;
  hasRecentGroups: boolean;
}): { message: string; mood: MascotMood } {
  if (input.isSearching) {
    return {
      mood: "think",
      message: "찾아보는 중이에요. 조금만 기다려 주세요.",
    };
  }

  if (input.hasSearchError) {
    return {
      mood: "worry",
      message: "앗, 지금은 상품을 못 가져왔어요. 조금 뒤에 다시 불러 볼까요?",
    };
  }

  if (input.searchWasEmpty) {
    return {
      mood: "worry",
      message: "이 이름으로는 상품이 안 보여요. 다른 재료로 찾아볼까요?",
    };
  }

  if (input.hasSearchResults) {
    return {
      mood: "happy",
      message: "이 재료로 찾아봤어요. 쿠팡에서 골라 보세요.",
    };
  }

  if (input.isShoppingLoading) {
    return {
      mood: "think",
      message: "목록을 살펴보고 있어요.",
    };
  }

  if (input.isShoppingError) {
    return {
      mood: "worry",
      message: "목록을 못 불러왔어요. 이름만 알려 주시면 찾아볼게요.",
    };
  }

  if (!input.isShoppingEnabled) {
    return {
      mood: "idle",
      message: "장보기를 준비하고 있어요. 조금만 기다려 주세요.",
    };
  }

  if (input.hasRecentGroups) {
    return {
      mood: "speak",
      message: "아래 목록에서 골라 보거나, 다른 재료 이름을 알려 주세요.",
    };
  }

  return {
    mood: "speak",
    message: "필요한 식재료, 쿠팡에서 바로 찾아드릴게요. 이름만 알려 주세요.",
  };
}

/** Recent items stay visible unless a search is in flight or already has products. */
export function isShoppingSearchActive(input: {
  isSearching: boolean;
  hasSearchResults: boolean;
}) {
  return input.isSearching || input.hasSearchResults;
}
