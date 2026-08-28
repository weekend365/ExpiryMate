import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { InventoryPhotoParseCleanupService } from "./inventory-photo-parse-cleanup.service";

describe("InventoryPhotoParseCleanupService", () => {
  it("removes only expired stored results", async () => {
    const prisma = {
      inventoryPhotoParseEvent: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const service = new InventoryPhotoParseCleanupService(prisma as never);
    const now = new Date("2026-08-29T00:00:00.000Z");

    await expect(service.runCleanup(now)).resolves.toBe(2);
    expect(prisma.inventoryPhotoParseEvent.updateMany).toHaveBeenCalledWith({
      where: {
        resultPayload: { not: Prisma.DbNull },
        resultExpiresAt: { lte: now },
      },
      data: {
        resultPayload: Prisma.DbNull,
        resultExpiresAt: null,
      },
    });
  });
});
