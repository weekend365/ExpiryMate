import { describe, expect, it } from "vitest";
import {
  inventoryRemovalQueryKeys,
  isPendingForDifferentSpace,
} from "./deferred-inventory-removal";

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
});
