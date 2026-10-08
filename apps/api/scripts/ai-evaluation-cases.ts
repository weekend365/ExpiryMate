import { ProductCategory, UnitCode, evaluationCaseSchema, type AiEvaluationCase } from "@expirymate/shared";

/** Deterministic synthetic inputs; no production inventory or personal data. */
export function syntheticRecipeCases(): AiEvaluationCase[] {
  const foods = ["달걀", "두부", "우유", "양파", "감자", "당근", "애호박", "쌀", "닭고기", "버섯", "토마토", "김치"];
  return Array.from({ length: 200 }, (_, index) => evaluationCaseSchema.parse({
    id: `synthetic-recipe-${String(index + 1).padStart(3, "0")}`, dataPolicy: "synthetic", feature: "recipe",
    request: { servings: 1 + index % 6, maxCookingMinutes: [10, 15, 30, 45, 60][Math.floor(index / 6) % 5], useExpiringFirst: index % 2 === 0 },
    inventory: Array.from({ length: 3 + index % 10 }, (_, offset) => ({
      inventoryItemId: `synthetic-${offset}`, name: foods[(index + offset) % foods.length], category: ProductCategory.PRODUCE,
      quantity: 500, quantityBase: 500, unitCode: UnitCode.G, storageLocation: "fridge",
      expiryDate: offset % 3 === 0 ? "2026-10-10" : null, daysUntilExpiry: offset % 3 === 0 ? 2 : null,
    })),
    preference: { allergens: index % 5 === 0 ? ["egg"] : [], excludedIngredients: index % 7 === 0 ? ["우유"] : [],
      dietaryStyle: index % 11 === 0 ? "vegan" : "any", maxSpiceLevel: index % 13 === 0 ? "none" : "any",
      availableEquipment: index % 17 === 0 ? ["microwave"] : ["stovetop"], updatedAt: "2026-10-08T00:00:00.000Z" },
  }));
}
