import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string) {
  return readFileSync(join(MOBILE_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

describe("recommendation screen flow contract", () => {
  const screen = read("app/(tabs)/recommendations.tsx");
  const detailSheet = read("src/features/recipes/recipe-detail-sheet.tsx");
  const bottomSheet = read("src/components/BottomSheet.tsx");

  it("keeps the pre-generation hero to one compact setup entry", () => {
    expect(screen).toContain('title="이번 추천 설정"');
    expect(screen).toContain("chips={recommendationSetupChips}");
    expect(screen).toContain('mealType === "any" ? "끼니 무관" : mealTypeLabel');
    expect(screen).toContain("scope={recommendationSetupScope}");
    expect(screen).toContain("sectionHeader");
    expect(screen).not.toContain("SlidersHorizontal");
    expect(screen).toContain('badgeLabel={');
    expect(screen).toContain('testID="recommendation-options-ingredient-link"');
    expect(screen).not.toContain('testID="recommendation-preference-summary-button"');
  });

  it("separates the setup surface from the Jango hero and gives summary chips semantic tones", () => {
    expect(screen).toMatch(
      /<View style=\{styles\.heroCard\}>[\s\S]*?<JangoHeroNoticeCarousel[\s\S]*?<\/View>\s*<View style=\{styles\.optionsSummaryGroup\}>/,
    );
    expect(screen).toContain(
      'tone: selectedInventoryItemIds ? "primary" : "neutral"',
    );
    expect(screen).toContain('tone: "warning" as const');
    expect(screen).toContain("icon: Timer");
    expect(screen).toContain("styles.optionsSummarySectionHeader");
    expect(screen).toContain("size={typography.bodySmall.fontSize}");
    expect(screen).toContain('tone="latest"');
    expect(screen).toContain('tone="previous"');
    expect(screen).toContain("styles.recipeSectionHeaderLatest");
    expect(screen).toContain("styles.recipeSectionHeaderPrevious");
  });

  it("groups the serving and cooking-time filters into a responsive quick grid", () => {
    expect(screen).toContain("styles.quickOptionGrid");
    expect(screen).toContain("shouldStackDense && styles.quickOptionGridStacked");
    expect(screen.match(/styles\.quickOptionColumn,/g)).toHaveLength(2);
    expect(screen.match(/style=\{styles\.compactPillRow\}/g)).toHaveLength(2);
  });

  it("supports scalable ingredient finding and bulk selection", () => {
    expect(screen).toContain('placeholder="재료 이름 검색"');
    expect(screen).toContain("ingredientFilterOptions.map");
    expect(screen).toContain("handleSelectExpiringIngredients");
    expect(screen).toContain("handleToggleAllIngredients");
    expect(screen).toContain("전체 선택");
    expect(screen).toContain("전체 해제");
    expect(screen).toContain("선택 {ingredientSelectionDraft.length}/");
  });

  it("keeps ingredient controls visible and compacts long sheets on short windows", () => {
    expect(screen).toContain("stickyBodyHeader={");
    expect(screen.match(/compactHeaderOnShort/g)).toHaveLength(2);
    expect(screen).toContain("fullHeightOnShort");
    expect(screen).toContain("styles.ingredientSheetFooterRegular");
    expect(bottomSheet).toContain("stickyBodyHeader?: ReactNode");
    expect(bottomSheet).toContain("compactHeaderOnShort?: boolean");
    expect(bottomSheet).toContain("fullHeightOnShort?: boolean");
    expect(bottomSheet).toContain("isShort || isPhoneLandscape");
  });

  it("opens details directly from every recipe row before cooking", () => {
    expect(screen).toContain("onPress={onOpenDetails}");
    expect(screen).toContain("onOpenDetails={() =>\n                          handleOpenDetails({");
    expect(screen.match(/handleOpenDetails\(\{/g)).toHaveLength(2);
    expect(screen).toContain("setTimeout(\n                    () => setRecipeDetail(detail)");
    expect(screen.match(/action: "view"/g)).toHaveLength(2);
    expect(screen).not.toContain("setSelectedRecipe");
    expect(screen).not.toContain("handleStartSelectedRecipe");
    expect(screen).not.toContain("<Eye");
    expect(detailSheet).toContain("이 요리 시작");
    expect(detailSheet).toContain("onPress={onStartCooking}");
    expect(screen).toContain(
      "const { recommendationId, dishIndex } = recipeDetail;",
    );
    expect(screen).toContain('pathname: "/cooking/[recommendationId]"');
    expect(screen).toContain("dishIndex: String(dishIndex)");
  });

  it("keeps recipe rows compact while adding useful comparison context", () => {
    expect(screen).toContain('const decisionReason = decisionSignals');
    expect(screen).toContain('{dish.summary}');
    expect(screen).toContain('variant="bodyStrong"');
    expect(screen).toContain('numberOfLines={2}');
    expect(screen).toContain('style={styles.recipeMetaRow}');
    expect(screen).toContain('style={styles.recipeReason}');
    expect(screen).not.toContain('styles.recipeCardAccent');
    expect(screen).not.toContain('styles.recipeStrategyBadge');
    expect(screen).not.toContain('styles.recipeSignalChip');
  });

  it("hides the sticky footer for results and keeps regeneration secondary", () => {
    expect(screen).toContain(") : hasRecommendationResult ? null : (");
    expect(screen).toContain("{regenerateCtaLabel}");
    expect(screen).toContain('variant="surface"');
  });

  it("previews the result layout without adding a second action", () => {
    expect(screen).not.toContain("아직 냉장고가 비어 있어요");
    expect(screen).not.toContain("아직 추천이 없어요");
    expect(screen).toContain('title="이번에 골라볼 요리"');
    expect(screen).toContain('title="추천 요리가 여기에 보여요"');
    expect(screen).toContain("{primaryCtaLabel}");
  });

  it("places a value-moment offer after the latest recommendation result", () => {
    expect(screen.indexOf("latestRecommendation.recommendations.map")).toBeLessThan(
      screen.indexOf("showValueMomentOffer ?"),
    );
    expect(
      read("src/features/recipes/recommendation-quota-panel.tsx"),
    ).toContain('<Button\n        variant="surface"');
  });
});
