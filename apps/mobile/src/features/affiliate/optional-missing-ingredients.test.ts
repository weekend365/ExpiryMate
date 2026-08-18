import { describe, expect, it } from "vitest";
import { ingredientsWithoutProductGroups } from "./optional-missing-visibility";

describe("ingredientsWithoutProductGroups", () => {
  it("hides ingredients that already have a product group heading", () => {
    expect(
      ingredientsWithoutProductGroups(
        [
          { name: "대파", reason: "향이 살아나요" },
          { name: "참기름", reason: "고소해져요" },
        ],
        [{ ingredientName: "대파" }],
      ).map((item) => item.name),
    ).toEqual(["참기름"]);
  });

  it("drops duplicate ingredient names from the recipe list", () => {
    expect(
      ingredientsWithoutProductGroups(
        [
          { name: "대파", reason: "향이 살아나요" },
          { name: "대파", reason: "향이 살아나요" },
        ],
        [],
      ).map((item) => item.name),
    ).toEqual(["대파"]);
  });
});
