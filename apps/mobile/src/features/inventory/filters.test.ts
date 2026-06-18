import {
  ExpirySource,
  ItemStatus,
  StorageLocation,
  type InventoryItem,
} from "@expirymate/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterInventoryItems } from "./filters";

describe("mobile inventory filters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns expiring items within seven days sorted by nearest expiry", () => {
    const result = filterInventoryItems(
      [
        createItem("later", "두부", "2026-06-15T00:00:00.000Z"),
        createItem("soon", "계란", "2026-06-10T00:00:00.000Z"),
        createItem("expired", "우유", "2026-06-06T00:00:00.000Z"),
        createItem("today", "요거트", "2026-06-07T00:00:00.000Z"),
      ],
      "expiring",
      "all",
    );

    expect(result.map((item) => item.id)).toEqual(["today", "soon"]);
  });

  it("combines expired and location filters", () => {
    const result = filterInventoryItems(
      [
        createItem("fridge-expired", "우유", "2026-06-06T00:00:00.000Z"),
        createItem(
          "room-expired",
          "컵라면",
          "2026-06-05T00:00:00.000Z",
          StorageLocation.ROOM,
        ),
        createItem("fridge-active", "계란", "2026-06-10T00:00:00.000Z"),
      ],
      "expired",
      StorageLocation.FRIDGE,
    );

    expect(result.map((item) => item.id)).toEqual(["fridge-expired"]);
  });
});

function createItem(
  id: string,
  displayName: string,
  expiryDate: string,
  storageLocation: StorageLocation = StorageLocation.FRIDGE,
): InventoryItem {
  return {
    id,
    displayName,
    productId: null,
    ownerKey: "owner-a",
    brand: null,
    category: null,
    quantity: 1,
    unit: "개",
    storageLocation,
    expiryDate,
    expirySource: ExpirySource.MANUAL,
    status: ItemStatus.ACTIVE,
    notes: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}
