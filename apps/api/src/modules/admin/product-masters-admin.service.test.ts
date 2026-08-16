import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ProductMasterCorrectionStatus } from "@prisma/client";
import { ProductMasterSource } from "@expirymate/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductMastersAdminService } from "./product-masters-admin.service";

const catalog = {
  id: "pm-1",
  barcode: "8801234567890",
  name: "우유",
  brand: "서울우유",
  category: "dairy",
  imageUrl: null,
  source: ProductMasterSource.USER_CONTRIBUTED,
  contributedByUserId: "user-a",
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

const pendingCorrection = {
  id: "corr-1",
  productMasterId: "pm-1",
  submittedByUserId: "user-b",
  catalogName: "우유",
  catalogBrand: "서울우유",
  catalogCategory: "dairy",
  proposedName: "서울우유 1L",
  proposedBrand: "서울우유",
  proposedCategory: "dairy",
  status: ProductMasterCorrectionStatus.pending,
  reviewedByUserId: null,
  reviewedAt: null,
  createdAt: new Date("2026-08-16T00:00:00.000Z"),
  updatedAt: new Date("2026-08-16T00:00:00.000Z"),
};

describe("ProductMastersAdminService", () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let adminAudit: { record: ReturnType<typeof vi.fn> };
  let service: ProductMastersAdminService;

  beforeEach(() => {
    prisma = createPrismaMock();
    adminAudit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new ProductMastersAdminService(prisma as never, adminAudit as never);
  });

  it("lists catalog rows with pending correction counts", async () => {
    prisma.productMaster.count.mockResolvedValue(1);
    prisma.productMaster.findMany.mockResolvedValue([
      { ...catalog, _count: { corrections: 2 } },
    ]);

    const result = await service.list({ hasPendingCorrections: true });

    expect(result.totalCount).toBe(1);
    expect(result.items[0]?.pendingCorrectionCount).toBe(2);
    expect(prisma.productMaster.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          corrections: {
            some: { status: ProductMasterCorrectionStatus.pending },
          },
        }),
      }),
    );
  });

  it("applies a pending correction onto the catalog without changing inventory", async () => {
    prisma.productMasterCorrection.findFirst.mockResolvedValue(pendingCorrection);
    prisma.productMaster.update.mockResolvedValue({
      ...catalog,
      name: "서울우유 1L",
    });
    prisma.productMasterCorrection.update.mockResolvedValue({
      ...pendingCorrection,
      status: ProductMasterCorrectionStatus.applied,
    });

    const result = await service.applyCorrection("pm-1", "corr-1", "admin-1");

    expect(result.name).toBe("서울우유 1L");
    expect(prisma.productMaster.update).toHaveBeenCalledWith({
      where: { id: "pm-1" },
      data: expect.objectContaining({
        name: "서울우유 1L",
        brand: "서울우유",
      }),
    });
    expect(adminAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "product_master.correction.apply",
        resourceId: "corr-1",
      }),
    );
  });

  it("does not apply a correction that was already reviewed", async () => {
    prisma.productMasterCorrection.findFirst.mockResolvedValue({
      ...pendingCorrection,
      status: ProductMasterCorrectionStatus.applied,
    });

    await expect(
      service.applyCorrection("pm-1", "corr-1", "admin-1"),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.productMaster.update).not.toHaveBeenCalled();
  });

  it("returns not found for an unknown catalog row", async () => {
    prisma.productMaster.findUnique.mockResolvedValue(null);

    await expect(service.getDetail("missing")).rejects.toThrow(NotFoundException);
  });
});

function createPrismaMock() {
  const prisma = {
    productMaster: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    productMasterCorrection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation(
    async (
      input:
        | Array<Promise<unknown>>
        | ((transaction: typeof prisma) => Promise<unknown>),
    ) =>
      typeof input === "function" ? input(prisma) : Promise.all(input),
  );
  return prisma;
}
