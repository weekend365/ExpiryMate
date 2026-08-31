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

  it("keeps the pre-generation hero to one compact setup entry", () => {
    expect(screen).toContain('title="이번 추천 설정"');
    expect(screen).toContain('badgeLabel={');
    expect(screen).toContain('testID="recommendation-options-ingredient-link"');
    expect(screen).not.toContain('testID="recommendation-preference-summary-button"');
  });

  it("supports scalable ingredient finding and bulk selection", () => {
    expect(screen).toContain('placeholder="재료 이름 검색"');
    expect(screen).toContain("ingredientFilterOptions.map");
    expect(screen).toContain("handleSelectExpiringIngredients");
    expect(screen).toContain("전체 선택");
    expect(screen).toContain("전체 해제");
    expect(screen).toContain("선택 {ingredientSelectionDraft.length}/");
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
    expect(detailSheet).toContain("이 요리로 해볼게요");
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
});
