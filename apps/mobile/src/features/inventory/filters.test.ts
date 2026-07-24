import {
  ExpirySource,
  ItemStatus,
  StorageLocation,
  type InventoryItem,
  UnitCode,
} from "@expirymate/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInventoryUrgencySections,
  filterInventoryItems,
  getInventoryUrgencySection,
  parseInventoryViewFilter,
} from "./filters";

describe("mobile inventory filters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses known inventory view filters from route params", () => {
    expect(parseInventoryViewFilter("today")).toBe("today");
    expect(parseInventoryViewFilter("within7")).toBe("within7");
    expect(parseInventoryViewFilter("expiring")).toBe("within7");
    expect(parseInventoryViewFilter(["expired"])).toBe("expired");
    expect(parseInventoryViewFilter("all")).toBe("all");
    expect(parseInventoryViewFilter("unknown")).toBeNull();
    expect(parseInventoryViewFilter(undefined)).toBeNull();
  });

  it("returns today-only items when today filter is applied", () => {
    const result = filterInventoryItems(
      [
        createItem("later", "두부", "2026-06-15"),
        createItem("soon", "계란", "2026-06-10"),
        createItem("today", "요거트", "2026-06-07"),
      ],
      "today",
      "all",
    );

    expect(result.map((item) => item.id)).toEqual(["today"]);
  });

  it("returns items within seven days sorted by nearest expiry", () => {
    const result = filterInventoryItems(
      [
        createItem("later", "두부", "2026-06-15"),
        createItem("soon", "계란", "2026-06-10"),
        createItem("expired", "우유", "2026-06-06"),
        createItem("today", "요거트", "2026-06-07"),
      ],
      "within7",
      "all",
    );

    expect(result.map((item) => item.id)).toEqual(["today", "soon"]);
  });

  it("combines expired and location filters", () => {
    const result = filterInventoryItems(
      [
        createItem("fridge-expired", "우유", "2026-06-06"),
        createItem(
          "room-expired",
          "컵라면",
          "2026-06-05",
          StorageLocation.ROOM,
        ),
        createItem("fridge-active", "계란", "2026-06-10"),
      ],
      "expired",
      StorageLocation.FRIDGE,
    );

    expect(result.map((item) => item.id)).toEqual(["fridge-expired"]);
  });

  it("filters by display name or brand when search query is set", () => {
    const items = [
      createItem("tofu", "두부", "2026-06-15"),
      createItem("egg", "계란", "2026-06-10", StorageLocation.FRIDGE, "풀무원"),
      createItem("milk", "우유", "2026-06-07"),
    ];

    expect(
      filterInventoryItems(items, "all", "all", "계란").map((item) => item.id),
    ).toEqual(["egg"]);
    expect(
      filterInventoryItems(items, "all", "all", "풀무").map((item) => item.id),
    ).toEqual(["egg"]);
    expect(
      filterInventoryItems(items, "all", "all", "   ").map((item) => item.id),
    ).toEqual(["milk", "egg", "tofu"]);
  });

  it("applies search together with status and location filters", () => {
    const result = filterInventoryItems(
      [
        createItem("fridge-egg", "계란", "2026-06-10"),
        createItem("fridge-milk", "우유", "2026-06-10"),
        createItem(
          "room-egg",
          "계란",
          "2026-06-10",
          StorageLocation.ROOM,
        ),
      ],
      "within7",
      StorageLocation.FRIDGE,
      "계란",
    );

    expect(result.map((item) => item.id)).toEqual(["fridge-egg"]);
  });

  it("maps nearest expiry dates into urgency sections", () => {
    expect(getInventoryUrgencySection("2026-06-06")).toBe("today");
    expect(getInventoryUrgencySection("2026-06-07")).toBe("today");
    expect(getInventoryUrgencySection("2026-06-10")).toBe("within7");
    expect(getInventoryUrgencySection("2026-06-20")).toBe("safe");
  });

  it("builds urgency sections and hides empty buckets", () => {
    const sections = buildInventoryUrgencySections([
      {
        id: "today-group",
        displayName: "요거트",
        brand: null,
        items: [createItem("today", "요거트", "2026-06-07")],
        nearestExpiryDate: "2026-06-07",
        totalQuantity: 1,
        unit: "개",
        hasMixedUnits: false,
      },
      {
        id: "safe-group",
        displayName: "두부",
        brand: null,
        items: [createItem("later", "두부", "2026-06-20")],
        nearestExpiryDate: "2026-06-20",
        totalQuantity: 1,
        unit: "개",
        hasMixedUnits: false,
      },
    ]);

    expect(sections.map((section) => section.key)).toEqual(["today", "safe"]);
    expect(sections[0]?.title).toBe("오늘 만료");
    expect(sections[1]?.data.map((group) => group.id)).toEqual(["safe-group"]);
  });
});

function createItem(
  id: string,
  displayName: string,
  expiryDate: string,
  storageLocation: StorageLocation = StorageLocation.FRIDGE,
  brand: string | null = null,
): InventoryItem {
  return {
    id,
    displayName,
    productId: null,
    ownerKey: "owner-a",
    brand,
    category: null,
    quantity: 1,
    unit: "개",
    quantityBase: 1,
    unitCode: UnitCode.EA,
    storageLocation,
    expiryDate,
    expirySource: ExpirySource.MANUAL,
    status: ItemStatus.ACTIVE,
    notes: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}
