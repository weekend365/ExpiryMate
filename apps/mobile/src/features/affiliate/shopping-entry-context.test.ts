import { describe, expect, it } from "vitest";
import { parseShoppingEntryContext } from "./shopping-entry-context";

describe("shopping entry context", () => {
  it("keeps up to three unique cooking-complete ingredients", () => {
    expect(
      parseShoppingEntryContext({
        items: JSON.stringify(["달걀", "우유", "달걀", "두부", "대파"]),
        source: "cooking_complete",
      }),
    ).toEqual({
      source: "cooking_complete",
      queries: ["달걀", "우유", "두부"],
      placement: "cooking_complete",
    });
  });

  it("uses a contextual placement for inventory consumption", () => {
    expect(
      parseShoppingEntryContext({
        q: "우유",
        source: "inventory_consumed",
      }).placement,
    ).toBe("inventory_consumed");
  });
});
