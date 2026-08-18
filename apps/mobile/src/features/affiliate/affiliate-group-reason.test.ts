import { describe, expect, it } from "vitest";
import { visibleIngredientReason } from "./affiliate-group-reason";

describe("visibleIngredientReason", () => {
  it("hides repeated shopping boilerplate", () => {
    expect(visibleIngredientReason("최근에 모두 사용한 재료예요.")).toBeNull();
    expect(visibleIngredientReason("직접 검색한 상품이에요.")).toBeNull();
    expect(visibleIngredientReason("  ")).toBeNull();
  });

  it("keeps ingredient-specific explanations", () => {
    expect(visibleIngredientReason("마무리 향이 살아나요.")).toBe(
      "마무리 향이 살아나요.",
    );
  });
});
