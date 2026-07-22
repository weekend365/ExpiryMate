import { ItemStatus, StorageLocation } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { maskOwnerKey } from "../../common/serializers";
import { AdminService } from "./admin.service";

describe("AdminService", () => {
  it("paginates inventory and masks owner/notes fields", async () => {
    const row = {
      id: "item-1",
      productId: null,
      ownerKey: "user_secret_owner",
      displayName: "우유",
      brand: "서울",
      category: null,
      quantity: 1,
      unit: "개",
      storageLocation: StorageLocation.fridge,
      expiryDate: new Date("2026-07-23T00:00:00.000Z"),
      expirySource: "manual",
      status: ItemStatus.active,
      notes: "비밀 메모",
      createdAt: new Date("2026-07-01T00:00:00.000Z"),
      updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    };

    const prisma = {
      $transaction: vi.fn(async (ops: Array<Promise<unknown>>) =>
        Promise.all(ops),
      ),
      inventoryItem: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([row]),
      },
    };

    const service = new AdminService(prisma as never);
    const result = await service.listInventory({ page: 1, limit: 50, q: "우유" });

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50,
      }),
    );
    expect(result.totalCount).toBe(1);
    expect(result.items[0]?.notes).toBeNull();
    expect(result.items[0]?.ownerKey).toBe(maskOwnerKey("user_secret_owner"));
    expect(result.items[0]?.ownerKey).not.toBe("user_secret_owner");
  });

  it("builds dashboard summary from aggregates instead of a full table scan", async () => {
    const prisma = {
      inventoryItem: {
        count: vi
          .fn()
          .mockResolvedValueOnce(10)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(4),
        groupBy: vi.fn().mockResolvedValue([
          { storageLocation: StorageLocation.fridge, _count: { _all: 7 } },
        ]),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new AdminService(prisma as never);
    const summary = await service.getDashboardSummary(
      new Date("2026-07-22T01:00:00.000Z"),
    );

    expect(summary.totalActiveCount).toBe(10);
    expect(summary.expiredCount).toBe(2);
    expect(summary.todayExpiryCount).toBe(1);
    expect(summary.locationCounts.fridge).toBe(7);
    expect(prisma.inventoryItem.findMany).toHaveBeenCalledTimes(2);
  });
});
