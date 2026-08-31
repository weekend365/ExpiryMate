import {
  ExpirySource,
  ItemStatus,
  UnitCode,
  type InventoryItem,
} from "@expirymate/shared";
import { describe, expect, it } from "vitest";
import {
  buildInventoryUndoLabel,
  getCommittedFullConsumeTarget,
  inventoryRemovalQueryKeys,
  isPendingForDifferentSpace,
  type InventoryRemovalEntry,
} from "./deferred-inventory-removal";

const inventoryItem = {
  id: "item-a",
  displayName: "우유",
  quantity: 2,
  unit: "개",
  quantityBase: 2,
  unitCode: UnitCode.EA,
  storageLocation: "fridge",
  expiryDate: null,
  expirySource: ExpirySource.UNKNOWN,
  status: ItemStatus.ACTIVE,
  createdAt: "2026-08-31T00:00:00.000Z",
  updatedAt: "2026-08-31T00:00:00.000Z",
} satisfies InventoryItem;

function removalEntry(
  overrides: Partial<InventoryRemovalEntry> = {},
): InventoryRemovalEntry {
  return {
    action: "consume",
    item: inventoryItem,
    amountBase: inventoryItem.quantityBase,
    ...overrides,
  };
}

describe("isPendingForDifferentSpace", () => {
  it("is false when nothing is pending", () => {
    expect(isPendingForDifferentSpace(undefined, "space-a")).toBe(false);
  });

  it("is false while the same fridge is still active", () => {
    expect(isPendingForDifferentSpace("space-a", "space-a")).toBe(false);
  });

  it("is true after switching to another fridge", () => {
    expect(isPendingForDifferentSpace("space-a", "space-b")).toBe(true);
  });

  it("is true when the session loses its active fridge", () => {
    expect(isPendingForDifferentSpace("space-a", undefined)).toBe(true);
  });

  it("invalidates inventory-derived shopping data for the same user and fridge", () => {
    expect(inventoryRemovalQueryKeys("user-a", "space-a")).toEqual({
      inventory: ["inventory-list", "user-a", "space-a"],
      dashboard: ["dashboard-summary", "user-a", "space-a"],
      shopping: ["affiliate-shopping", "user-a", "space-a"],
      reorderPreview: ["affiliate-reorder-preview", "user-a", "space-a"],
    });
  });

  it("offers shopping only after one item was fully consumed", () => {
    expect(
      getCommittedFullConsumeTarget({
        entries: [removalEntry()],
        spaceId: "space-a",
      }),
    ).toBe(inventoryItem);
    expect(
      getCommittedFullConsumeTarget({
        entries: [removalEntry({ amountBase: 1 })],
        spaceId: "space-a",
      }),
    ).toBeNull();
    expect(
      getCommittedFullConsumeTarget({
        entries: [removalEntry({ action: "discard" })],
        spaceId: "space-a",
      }),
    ).toBeNull();
    expect(
      getCommittedFullConsumeTarget({
        entries: [removalEntry(), removalEntry()],
        spaceId: "space-a",
      }),
    ).toBeNull();
  });

  it("describes partial use and batch discard for the undo action", () => {
    expect(
      buildInventoryUndoLabel([removalEntry({ amountBase: 1 })]),
    ).toContain("빼 뒀어요");
    expect(
      buildInventoryUndoLabel([
        removalEntry({ action: "discard" }),
        removalEntry({
          action: "discard",
          item: { ...inventoryItem, id: "item-b", displayName: "달걀" },
        }),
      ]),
    ).toBe("2개 재료를 폐기했어요");
  });
});
