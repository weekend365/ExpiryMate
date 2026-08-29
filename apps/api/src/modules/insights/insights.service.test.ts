import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { InsightsService } from "./insights.service";

describe("InsightsService", () => {
  it("returns a free 30-day preview only for a space member", async () => {
    const prisma = createPrisma();
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      spaceId: "space-a",
    });
    prisma.inventoryDispositionEvent.groupBy.mockResolvedValue([
      { outcome: "consumed", _count: { _all: 3 } },
      { outcome: "discarded", _count: { _all: 2 } },
    ]);
    prisma.inventoryDispositionEvent.count.mockResolvedValue(5);
    const service = new InsightsService(prisma as never);

    const preview = await service.getPreview(
      "owner-a",
      "space-a",
      new Date("2026-08-29T05:00:00.000Z"),
    );

    expect(preview).toEqual({
      period: { from: "2026-07-31", to: "2026-08-29" },
      consumed: 3,
      discarded: 2,
      resolved: 5,
      ready: true,
    });
    expect(prisma.inventoryDispositionEvent.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ spaceId: "space-a" }),
      }),
    );
  });

  it("returns 90-day Plus trends from disposition events", async () => {
    const prisma = createPrisma();
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue({
      spaceId: "space-a",
    });
    prisma.subscriptionEntitlement.findFirst.mockResolvedValue({ id: "plus-1" });
    prisma.inventoryDispositionEvent.groupBy
      .mockResolvedValueOnce([
        { outcome: "consumed", _count: { _all: 18 } },
        { outcome: "discarded", _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { outcome: "consumed", _count: { _all: 4 } },
        { outcome: "discarded", _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { outcome: "consumed", _count: { _all: 3 } },
        { outcome: "discarded", _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        { category: "dairy", _count: { _all: 2 } },
      ]);
    prisma.inventoryItem.count.mockResolvedValue(2);
    prisma.inventoryItem.findMany.mockResolvedValue([
      { displayName: "우유", expiryDate: new Date("2026-08-30T00:00:00Z") },
    ]);
    const service = new InsightsService(prisma as never);

    const overview = await service.getOverview(
      "owner-a",
      "space-a",
      90,
      new Date("2026-08-29T05:00:00.000Z"),
    );

    expect(overview).toMatchObject({
      windowDays: 90,
      consumed: 18,
      discarded: 2,
      wasteRatePercent: 10,
      expiringSoon: 2,
      topDiscardedCategories: [{ category: "dairy", count: 2 }],
      weekly: {
        current: { consumed: 4, discarded: 1, wasteRatePercent: 20 },
        previous: { consumed: 3, discarded: 2, wasteRatePercent: 40 },
        wasteRateChangePercentagePoints: -20,
        trend: "improved",
      },
    });
    expect(overview.actions[0]).toMatchObject({
      kind: "use_expiring",
      itemNames: ["우유"],
    });
  });

  it("rejects a user who is not a member of the selected space", async () => {
    const prisma = createPrisma();
    prisma.inventorySpaceMembership.findUnique.mockResolvedValue(null);
    const service = new InsightsService(prisma as never);

    await expect(service.getPreview("owner-a", "space-b")).rejects.toThrow(
      ForbiddenException,
    );
  });
});

function createPrisma() {
  return {
    inventorySpaceMembership: { findUnique: vi.fn() },
    subscriptionEntitlement: { findFirst: vi.fn() },
    inventoryDispositionEvent: { groupBy: vi.fn(), count: vi.fn() },
    inventoryItem: { count: vi.fn(), findMany: vi.fn() },
  };
}
