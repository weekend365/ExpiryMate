import {
  ExpirySource,
  ItemStatus,
  ProductCategory,
  StorageLocation,
  UnitCode,
  type InventoryItem,
} from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  filterRecommendationIngredientItems,
  getExpiringRecommendationIngredientIds,
} from "./recommendation-ingredient-selection";

const items = [
  createItem("egg", "계란", "2026-09-02", StorageLocation.FRIDGE),
  createItem("milk", "우유", "2026-09-20", StorageLocation.FRIDGE),
  createItem("dumpling", "냉동만두", null, StorageLocation.FREEZER),
];

describe("recommendation ingredient selection", () => {
  it("combines search and storage filters", () => {
    expect(
      filterRecommendationIngredientItems(items, {
        filter: "fridge",
        query: "우유",
        now: "2026-08-31",
      }).map((item) => item.id),
    ).toEqual(["milk"]);
  });

  it("finds ingredients expiring within seven days", () => {
    expect(
      getExpiringRecommendationIngredientIds(items, "2026-08-31"),
    ).toEqual(["egg"]);
    expect(
      filterRecommendationIngredientItems(items, {
        filter: "expiring",
        query: "",
        now: "2026-08-31",
      }).map((item) => item.id),
    ).toEqual(["egg"]);
  });
});

function createItem(
  id: string,
  displayName: string,
  expiryDate: string | null,
  storageLocation: StorageLocation,
): InventoryItem {
  return {
    id,
    displayName,
    category: ProductCategory.PRODUCE,
    quantity: 1,
    quantityBase: 1,
    unit: "개",
    unitCode: UnitCode.EA,
    storageLocation,
    expiryDate,
    expirySource: expiryDate ? ExpirySource.MANUAL : ExpirySource.UNKNOWN,
    status: ItemStatus.ACTIVE,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
}
