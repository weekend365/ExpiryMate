type NavigationRouteLike = {
  name?: string;
  state?: {
    index?: number;
    routes?: NavigationRouteLike[];
  } | null;
};

const BACK_TITLE = "뒤로가기";

const COMPACT_HEADER_TITLES: Record<string, string> = {
  "개인정보와 추천 안내": "개인정보 안내",
  "요리 추천과 사진 안내": "추천·사진 안내",
  "계정과 데이터 정리": "데이터 정리",
  "함께 쓰는 냉장고": "공유 냉장고",
  "요리 추천 맞춤 설정": "추천 맞춤",
  "장고에게 물어보기": "고객 지원",
  "폐기 예방 리포트": "폐기 예방",
};

/** Keeps native-stack titles readable when the header cannot grow vertically. */
export function resolveCompactHeaderTitle(
  title: string,
  compact: boolean,
): string {
  return compact ? (COMPACT_HEADER_TITLES[title] ?? title) : title;
}

/**
 * Consistent back label for a tab route name.
 * Used so iOS never shows the Expo group id `(tabs)`.
 */
export function resolveTabHeaderBackTitle(tabName?: string | null): string {
  void tabName;
  return BACK_TITLE;
}

/**
 * Builds a back label from the previous stack route.
 * Every stack origin uses the same wording.
 */
export function resolveHeaderBackTitle(
  previousRoute?: NavigationRouteLike | null,
): string {
  void previousRoute;
  return BACK_TITLE;
}
