import { BadRequestException, Logger } from "@nestjs/common";
import {
  ProductMasterCorrectionStatus as PrismaCorrectionStatus,
  type PrismaClient,
  type ProductMaster,
  type ProductMasterCorrection,
} from "@prisma/client";
import {
  catalogCorrectionThresholdFor,
  catalogCorrectionVoteKey,
  catalogIdentityDiffers,
  catalogConfidenceAfterApply,
  bumpCatalogConfidence,
  getKstDayWindow,
  pickMostCommonCatalogText,
  ProductMasterSource,
  resolveCatalogConfidence,
  resolveCatalogDisplayIdentity,
  type CreateInventoryItemBody,
} from "@expirymate/shared";
import { resolveBarcodeRewardPolicy } from "../monetization/barcode-reward-policy";
import { isValidGtin } from "./barcode-format";
import { findProhibitedBarcodeContributionFields } from "./barcode-contribution-moderation";

type PrismaLike = Pick<
  PrismaClient,
  | "productMaster"
  | "productMasterCorrection"
  | "inventoryItem"
  | "barcodeRewardCredit"
  | "monetizationFunnelEvent"
>;

const logger = new Logger("CatalogCorrection");

export async function loadProductMasterOrThrow(
  prisma: PrismaLike,
  productMasterId?: string,
): Promise<ProductMaster | null> {
  if (!productMasterId) {
    return null;
  }

  const product = await prisma.productMaster.findUnique({
    where: { id: productMasterId },
  });
  if (!product) {
    throw new BadRequestException("상품 정보를 찾지 못했어요.");
  }

  return product;
}

export async function syncCatalogCorrectionAfterCreate(
  prisma: PrismaLike,
  params: {
    catalog: ProductMaster;
    ownerKey: string;
    proposed: Pick<
      CreateInventoryItemBody,
      "displayName" | "brand" | "category"
    >;
  },
): Promise<void> {
  const display = resolveCatalogDisplayIdentity(params.catalog);
  const proposedName = params.proposed.displayName.trim();
  const proposedBrand = params.proposed.brand?.trim() || null;
  const proposedCategory = params.proposed.category?.trim() || null;
  const differs = catalogIdentityDiffers(display, {
    name: proposedName,
    brand: proposedBrand,
    category: proposedCategory,
  });

  if (!differs) {
    await prisma.productMasterCorrection.updateMany({
      where: {
        productMasterId: params.catalog.id,
        submittedByUserId: params.ownerKey,
        status: PrismaCorrectionStatus.pending,
      },
      data: {
        status: PrismaCorrectionStatus.dismissed,
        reviewedAt: new Date(),
        reviewedByUserId: null,
      },
    });
    await maybeRecordCatalogConfirmation(prisma, {
      catalog: params.catalog,
      ownerKey: params.ownerKey,
    });
    return;
  }

  const prohibitedFields = findProhibitedBarcodeContributionFields({
    name: proposedName,
    brand: proposedBrand ?? undefined,
    category: proposedCategory ?? undefined,
  });
  if (prohibitedFields.length > 0) {
    logger.warn(
      `Skipped catalog correction for ${params.catalog.id}: prohibited content`,
    );
    return;
  }

  await prisma.productMasterCorrection.upsert({
    where: {
      productMasterId_submittedByUserId: {
        productMasterId: params.catalog.id,
        submittedByUserId: params.ownerKey,
      },
    },
    create: {
      productMasterId: params.catalog.id,
      submittedByUserId: params.ownerKey,
      catalogName: display.name,
      catalogBrand: display.brand ?? "",
      catalogCategory: display.category ?? "",
      proposedName,
      proposedBrand,
      proposedCategory,
      status: PrismaCorrectionStatus.pending,
    },
    update: {
      catalogName: display.name,
      catalogBrand: display.brand ?? "",
      catalogCategory: display.category ?? "",
      proposedName,
      proposedBrand,
      proposedCategory,
      status: PrismaCorrectionStatus.pending,
      reviewedAt: null,
      reviewedByUserId: null,
    },
  });

  await maybePromoteCatalogCorrection(prisma, {
    catalog: params.catalog,
    voteKey: catalogCorrectionVoteKey(proposedName),
    grantRewardToUserId: params.ownerKey,
  });
}

export async function applyPendingCatalogCorrection(
  prisma: PrismaLike,
  params: {
    catalog: ProductMaster;
    correction: ProductMasterCorrection;
    actorUserId: string;
  },
): Promise<ProductMaster> {
  const pending = await prisma.productMasterCorrection.findMany({
    where: {
      productMasterId: params.catalog.id,
      status: PrismaCorrectionStatus.pending,
    },
  });
  const matching = pending.filter(
    (item) =>
      catalogCorrectionVoteKey(item.proposedName) ===
      catalogCorrectionVoteKey(params.correction.proposedName),
  );

  return promoteMatchingCatalogCorrections(prisma, {
    catalog: params.catalog,
    matching,
    actorUserId: params.actorUserId,
  });
}

export async function maybePromoteCatalogCorrection(
  prisma: PrismaLike,
  params: {
    catalog: ProductMaster;
    voteKey: string;
    grantRewardToUserId?: string;
  },
): Promise<ProductMaster | null> {
  const pending = await prisma.productMasterCorrection.findMany({
    where: {
      productMasterId: params.catalog.id,
      status: PrismaCorrectionStatus.pending,
    },
  });
  const matching = pending.filter(
    (item) => catalogCorrectionVoteKey(item.proposedName) === params.voteKey,
  );
  const uniqueVoters = new Set(
    matching
      .map((item) => item.submittedByUserId)
      .filter((userId): userId is string => Boolean(userId)),
  );
  const threshold = catalogCorrectionThresholdFor(params.catalog.source);

  if (uniqueVoters.size < threshold) {
    return null;
  }

  const updated = await promoteMatchingCatalogCorrections(prisma, {
    catalog: params.catalog,
    matching,
    actorUserId: null,
  });

  if (params.grantRewardToUserId) {
    await maybeGrantCorrectionReward(prisma, {
      ownerKey: params.grantRewardToUserId,
      productMasterId: params.catalog.id,
      barcode: params.catalog.barcode,
    });
  }

  return updated;
}

async function promoteMatchingCatalogCorrections(
  prisma: PrismaLike,
  params: {
    catalog: ProductMaster;
    matching: ProductMasterCorrection[];
    actorUserId: string | null;
  },
): Promise<ProductMaster> {
  const latest = [...params.matching].sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  )[0];
  if (!latest) {
    return params.catalog;
  }

  const winningName = latest.proposedName.trim();
  const winningBrand = pickMostCommonCatalogText(
    params.matching.map((item) => item.proposedBrand),
  );
  const winningCategory = pickMostCommonCatalogText(
    params.matching.map((item) => item.proposedCategory),
  );
  const writesUserContributedFields =
    params.catalog.source === ProductMasterSource.USER_CONTRIBUTED;
  const updated = await prisma.productMaster.update({
    where: { id: params.catalog.id },
    data: writesUserContributedFields
      ? {
          name: winningName,
          brand: winningBrand ?? undefined,
          category: winningCategory ?? undefined,
          confidence: catalogConfidenceAfterApply(
            params.catalog.source,
            params.catalog.confidence,
          ),
        }
      : {
          crowdName: winningName,
          crowdBrand: winningBrand ?? undefined,
          crowdCategory: winningCategory ?? undefined,
          confidence: catalogConfidenceAfterApply(
            params.catalog.source,
            params.catalog.confidence,
          ),
        },
  });

  await prisma.productMasterCorrection.updateMany({
    where: {
      id: { in: params.matching.map((item) => item.id) },
      status: PrismaCorrectionStatus.pending,
    },
    data: {
      status: PrismaCorrectionStatus.applied,
      reviewedByUserId: params.actorUserId,
      reviewedAt: new Date(),
    },
  });

  return updated;
}

async function maybeRecordCatalogConfirmation(
  prisma: PrismaLike,
  params: {
    catalog: ProductMaster;
    ownerKey: string;
  },
): Promise<void> {
  const ownerLotCount = await prisma.inventoryItem.count({
    where: {
      productMasterId: params.catalog.id,
      ownerKey: params.ownerKey,
    },
  });
  if (ownerLotCount !== 1) {
    return;
  }

  await prisma.productMaster.update({
    where: { id: params.catalog.id },
    data: {
      confirmCount: { increment: 1 },
      confidence: bumpCatalogConfidence(
        resolveCatalogConfidence(params.catalog),
      ),
    },
  });
}

async function maybeGrantCorrectionReward(
  prisma: PrismaLike,
  params: {
    ownerKey: string;
    productMasterId: string;
    barcode: string;
  },
): Promise<void> {
  const now = new Date();
  const policy = resolveBarcodeRewardPolicy(params.ownerKey);
  const { start } = getKstDayWindow(now);
  const [existingCredit, balance, earnedToday] = await Promise.all([
    prisma.barcodeRewardCredit.findUnique({
      where: { productMasterId: params.productMasterId },
    }),
    prisma.barcodeRewardCredit.count({
      where: { ownerKey: params.ownerKey, usageEvent: { is: null } },
    }),
    prisma.barcodeRewardCredit.count({
      where: { ownerKey: params.ownerKey, earnedDay: start },
    }),
  ]);

  let reason:
    | "granted"
    | "rewards_disabled"
    | "invalid_gtin"
    | "existing_barcode"
    | "daily_limit_reached"
    | "balance_limit_reached" = "granted";

  if (!policy.enabled) reason = "rewards_disabled";
  else if (!isValidGtin(params.barcode)) reason = "invalid_gtin";
  else if (existingCredit) reason = "existing_barcode";
  else if (earnedToday >= policy.dailyLimit) reason = "daily_limit_reached";
  else if (balance >= policy.balanceLimit) reason = "balance_limit_reached";

  await prisma.monetizationFunnelEvent.create({
    data: {
      ownerKey: params.ownerKey,
      eventName:
        reason === "granted" ? "barcode_reward_granted" : "barcode_reward_denied",
      experimentKey: "barcode-rewards-v1",
      experimentVariant: policy.cohort,
      properties: { reason, source: "catalog_correction" },
    },
  });

  if (reason !== "granted") {
    return;
  }

  await prisma.barcodeRewardCredit.create({
    data: {
      ownerKey: params.ownerKey,
      productMasterId: params.productMasterId,
      earnedDay: start,
    },
  });
}
