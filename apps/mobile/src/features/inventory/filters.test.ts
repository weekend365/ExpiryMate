import {
  ExpirySource,
  ItemStatus,
  StorageLocation,
  type InventoryItem,
  UnitCode,
} from "@expirymate/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInventoryFacetCounts,
  buildInventoryUrgencySections,
  filterInventoryItems,
  getInventoryGroupSectionSlot,
  getInventoryUrgencySection,
  inventoryUrgencySectionDescriptions,
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
    expect(parseInventoryViewFilter("today")).toBe("within7");
    expect(parseInventoryViewFilter("within7")).toBe("within7");
    expect(parseInventoryViewFilter("expiring")).toBe("within7");
    expect(parseInventoryViewFilter(["expired"])).toBe("expired");
    expect(parseInventoryViewFilter("safe")).toBe("safe");
    expect(parseInventoryViewFilter("all")).toBe("all");
    expect(parseInventoryViewFilter("unknown")).toBeNull();
    expect(parseInventoryViewFilter(undefined)).toBeNull();
  });

  it("returns only past items when the expired filter is applied", () => {
    const result = filterInventoryItems(
      [
        createItem("later", "두부", "2026-06-15"),
        createItem("soon", "계란", "2026-06-10"),
        createItem("today", "요거트", "2026-06-07"),
        createItem("expired", "우유", "2026-06-06"),
      ],
      "expired",
      "all",
    );

    expect(result.map((item) => item.id)).toEqual(["expired"]);
  });

  it("returns only items at least eight days away for the safe filter", () => {
    const result = filterInventoryItems(
      [
        createItem("day-7", "계란", "2026-06-14"),
        createItem("day-8", "두부", "2026-06-15"),
      ],
      "safe",
      "all",
    );

    expect(result.map((item) => item.id)).toEqual(["day-8"]);
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

  it("counts each filter facet against the other active facets", () => {
    const items = [
      createItem("fridge-expired", "우유", "2026-06-06"),
      createItem("fridge-soon", "계란", "2026-06-10"),
      createItem(
        "room-soon",
        "계란",
        "2026-06-10",
        StorageLocation.ROOM,
      ),
      createItem("fridge-safe", "두부", "2026-06-20"),
    ];

    const counts = buildInventoryFacetCounts(
      items,
      "within7",
      StorageLocation.FRIDGE,
    );

    expect(counts.status).toEqual({
      all: 3,
      expired: 1,
      within7: 1,
      safe: 1,
    });
    expect(counts.locationTotal).toBe(2);
    expect(counts.location).toEqual({
      [StorageLocation.FRIDGE]: 1,
      [StorageLocation.ROOM]: 1,
    });
  });

  it("maps nearest expiry dates into urgency sections", () => {
    expect(getInventoryUrgencySection("2026-06-06")).toBe("expired");
    expect(getInventoryUrgencySection("2026-06-07")).toBe("within7");
    expect(getInventoryUrgencySection("2026-06-10")).toBe("within7");
    expect(getInventoryUrgencySection("2026-06-20")).toBe("safe");
  });

  it("builds exclusive urgency sections and hides empty buckets", () => {
    const sections = buildInventoryUrgencySections([
      createItem("expired", "우유", "2026-06-06"),
      createItem("today", "요거트", "2026-06-07"),
      createItem("later", "두부", "2026-06-20"),
    ]);

    expect(sections.map((section) => section.key)).toEqual([
      "expired",
      "within7",
      "safe",
    ]);
    expect(sections[0]?.title).toBe("만료");
    expect(sections[1]?.title).toBe("곧 만료");
    expect(sections[2]?.title).toBe("여유 있어요");
    expect(inventoryUrgencySectionDescriptions.expired).toBe(
      "유통기한이 지났어요",
    );
    expect(inventoryUrgencySectionDescriptions.within7).toBe(
      "일주일 안에 손보면 좋아요",
    );
    expect(inventoryUrgencySectionDescriptions.safe).toBe(
      "아직은 여유로워요",
    );
    expect(sections.map((section) => section.itemCount)).toEqual([1, 1, 1]);
    expect(sections[2]?.data[0]?.items.map((item) => item.id)).toEqual([
      "later",
    ]);
  });

  it("groups the same product only within each urgency section", () => {
    const sections = buildInventoryUrgencySections([
      createItem("expired", "우유", "2026-06-06"),
      createItem("expired-lot-2", "우유", "2026-06-05"),
      createItem("safe", "우유", "2026-06-20"),
    ]);

    expect(sections).toHaveLength(2);
    expect(sections[0]?.data[0]?.items.map((item) => item.id)).toEqual([
      "expired-lot-2",
      "expired",
    ]);
    expect(sections[1]?.data[0]?.items.map((item) => item.id)).toEqual(["safe"]);
    expect(sections[0]?.data[0]?.id).not.toBe(sections[1]?.data[0]?.id);
    expect(sections.map((section) => section.itemCount)).toEqual([2, 1]);
  });

  it("maps row index to connected section slots", () => {
    expect(getInventoryGroupSectionSlot(0, 0)).toBe("solo");
    expect(getInventoryGroupSectionSlot(0, 1)).toBe("solo");
    expect(getInventoryGroupSectionSlot(0, 2)).toBe("first");
    expect(getInventoryGroupSectionSlot(1, 2)).toBe("last");
    expect(getInventoryGroupSectionSlot(1, 3)).toBe("middle");
    expect(getInventoryGroupSectionSlot(2, 3)).toBe("last");
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
