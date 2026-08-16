import { ProductMasterCorrectionStatus } from "@prisma/client";
import { ProductMasterSource } from "@expirymate/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  maybePromoteCatalogCorrection,
  syncCatalogCorrectionAfterCreate,
} from "./catalog-correction";

const catalog = {
  id: "pm-milk",
  barcode: "3017620422003",
  name: "우유",
  brand: "서울우유",
  category: "dairy",
  imageUrl: null,
  source: ProductMasterSource.USER_CONTRIBUTED,
  contributedByUserId: "owner-a",
  crowdName: null,
  crowdBrand: null,
  crowdCategory: null,
  confidence: 35,
  confirmCount: 0,
  createdAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
};

const pending = (
  id: string,
  ownerKey: string,
  proposedName = "서울우유 1L",
) => ({
  id,
  productMasterId: "pm-milk",
  submittedByUserId: ownerKey,
  catalogName: "우유",
  catalogBrand: "서울우유",
  catalogCategory: "dairy",
  proposedName,
  proposedBrand: "서울우유",
  proposedCategory: "dairy",
  status: ProductMasterCorrectionStatus.pending,
  reviewedByUserId: null,
  reviewedAt: null,
  createdAt: new Date("2026-08-16T00:00:00.000Z"),
  updatedAt: new Date("2026-08-16T00:00:00.000Z"),
});

describe("catalog correction promotion", () => {
  const originalRewards = process.env.BARCODE_REWARDS_ENABLED;
  const originalRollout = process.env.BARCODE_REWARD_ROLLOUT_PERCENT;
  const originalSalt = process.env.MONETIZATION_EXPERIMENT_SALT;
  let prisma: ReturnType<typeof createPrismaMock>;

  beforeEach(() => {
    process.env.BARCODE_REWARDS_ENABLED = "true";
    process.env.BARCODE_REWARD_ROLLOUT_PERCENT = "100";
    process.env.MONETIZATION_EXPERIMENT_SALT = "catalog-correction-test";
    prisma = createPrismaMock();
  });

  afterEach(() => {
    if (originalRewards === undefined) delete process.env.BARCODE_REWARDS_ENABLED;
    else process.env.BARCODE_REWARDS_ENABLED = originalRewards;
    if (originalRollout === undefined) {
      delete process.env.BARCODE_REWARD_ROLLOUT_PERCENT;
    } else {
      process.env.BARCODE_REWARD_ROLLOUT_PERCENT = originalRollout;
    }
    if (originalSalt === undefined) delete process.env.MONETIZATION_EXPERIMENT_SALT;
    else process.env.MONETIZATION_EXPERIMENT_SALT = originalSalt;
  });

  it("keeps a single user-contributed vote pending", async () => {
    prisma.productMasterCorrection.findMany.mockResolvedValue([
      pending("corr-1", "owner-b"),
    ]);

    await expect(
      maybePromoteCatalogCorrection(prisma as never, {
        catalog,
        voteKey: "서울우유 1l",
        grantRewardToUserId: "owner-b",
      }),
    ).resolves.toBeNull();
    expect(prisma.productMaster.update).not.toHaveBeenCalled();
    expect(prisma.barcodeRewardCredit.create).not.toHaveBeenCalled();
  });

  it("applies a user-contributed name once two accounts agree", async () => {
    prisma.productMasterCorrection.findMany.mockResolvedValue([
      pending("corr-1", "owner-b"),
      pending("corr-2", "owner-c"),
    ]);
    prisma.productMaster.update.mockResolvedValue({
      ...catalog,
      name: "서울우유 1L",
    });
    prisma.barcodeRewardCredit.findUnique.mockResolvedValue(null);

    await maybePromoteCatalogCorrection(prisma as never, {
      catalog,
      voteKey: "서울우유 1l",
      grantRewardToUserId: "owner-c",
    });

    expect(prisma.productMaster.update).toHaveBeenCalledWith({
      where: { id: "pm-milk" },
      data: expect.objectContaining({
        name: "서울우유 1L",
        brand: "서울우유",
        confidence: 70,
      }),
    });
    expect(prisma.productMasterCorrection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProductMasterCorrectionStatus.applied,
        }),
      }),
    );
    expect(prisma.barcodeRewardCredit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ownerKey: "owner-c",
        productMasterId: "pm-milk",
      }),
    });
  });

  it("keeps official catalog rows unchanged until three accounts agree", async () => {
    prisma.productMasterCorrection.findMany.mockResolvedValue([
      pending("corr-1", "owner-a"),
      pending("corr-2", "owner-b"),
    ]);

    await expect(
      maybePromoteCatalogCorrection(prisma as never, {
        catalog: {
          ...catalog,
          source: ProductMasterSource.FOODSAFETY_API,
        },
        voteKey: "서울우유 1l",
        grantRewardToUserId: "owner-b",
      }),
    ).resolves.toBeNull();
    expect(prisma.productMaster.update).not.toHaveBeenCalled();
  });

  it("writes a crowd overlay for official catalog rows instead of overwriting them", async () => {
    const official = {
      ...catalog,
      source: ProductMasterSource.FOODSAFETY_API,
      confidence: 85,
    };
    prisma.productMasterCorrection.findMany.mockResolvedValue([
      pending("corr-1", "owner-a"),
      pending("corr-2", "owner-b"),
      pending("corr-3", "owner-c"),
    ]);
    prisma.productMaster.update.mockResolvedValue({
      ...official,
      crowdName: "서울우유 1L",
    });
    prisma.barcodeRewardCredit.findUnique.mockResolvedValue(null);

    await maybePromoteCatalogCorrection(prisma as never, {
      catalog: official,
      voteKey: "서울우유 1l",
      grantRewardToUserId: "owner-c",
    });

    expect(prisma.productMaster.update).toHaveBeenCalledWith({
      where: { id: "pm-milk" },
      data: expect.objectContaining({
        crowdName: "서울우유 1L",
        crowdBrand: "서울우유",
        confidence: 85,
      }),
    });
    expect(prisma.productMaster.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          name: "서울우유 1L",
        }),
      }),
    );
  });

  it("does not grant another credit when the barcode was already rewarded", async () => {
    prisma.productMasterCorrection.findMany.mockResolvedValue([
      pending("corr-1", "owner-b"),
      pending("corr-2", "owner-c"),
    ]);
    prisma.productMaster.update.mockResolvedValue({
      ...catalog,
      name: "서울우유 1L",
    });
    prisma.barcodeRewardCredit.findUnique.mockResolvedValue({ id: "credit-1" });

    await maybePromoteCatalogCorrection(prisma as never, {
      catalog,
      voteKey: "서울우유 1l",
      grantRewardToUserId: "owner-c",
    });

    expect(prisma.barcodeRewardCredit.create).not.toHaveBeenCalled();
    expect(prisma.monetizationFunnelEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventName: "barcode_reward_denied",
        }),
      }),
    );
  });

  it("does not record a correction when the crowd-facing name already matches", async () => {
    await syncCatalogCorrectionAfterCreate(prisma as never, {
      catalog: {
        ...catalog,
        source: ProductMasterSource.FOODSAFETY_API,
        crowdName: "서울우유 1L",
      },
      ownerKey: "owner-b",
      proposed: { displayName: "서울우유 1L" },
    });

    expect(prisma.productMasterCorrection.upsert).not.toHaveBeenCalled();
    expect(prisma.productMasterCorrection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ProductMasterCorrectionStatus.dismissed,
        }),
      }),
    );
  });

  it("raises confidence the first time an account confirms the catalog name", async () => {
    prisma.inventoryItem.count.mockResolvedValue(1);

    await syncCatalogCorrectionAfterCreate(prisma as never, {
      catalog,
      ownerKey: "owner-b",
      proposed: { displayName: "우유", brand: "서울우유" },
    });

    expect(prisma.productMaster.update).toHaveBeenCalledWith({
      where: { id: "pm-milk" },
      data: expect.objectContaining({
        confirmCount: { increment: 1 },
        confidence: 43,
      }),
    });
  });

  it("does not raise confidence again for the same account", async () => {
    prisma.inventoryItem.count.mockResolvedValue(2);

    await syncCatalogCorrectionAfterCreate(prisma as never, {
      catalog,
      ownerKey: "owner-b",
      proposed: { displayName: "우유", brand: "서울우유" },
    });

    expect(prisma.productMaster.update).not.toHaveBeenCalled();
  });
});

function createPrismaMock() {
  return {
    productMaster: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    productMasterCorrection: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    inventoryItem: {
      count: vi.fn().mockResolvedValue(0),
    },
    barcodeRewardCredit: {
      findUnique: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
    },
    monetizationFunnelEvent: {
      create: vi.fn(),
    },
  };
}
