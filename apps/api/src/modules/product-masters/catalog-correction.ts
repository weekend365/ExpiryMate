import { BadRequestException, Logger } from "@nestjs/common";
import {
  ProductMasterCorrectionStatus as PrismaCorrectionStatus,
  type PrismaClient,
  type ProductMaster,
} from "@prisma/client";
import {
  catalogIdentityDiffers,
  type CreateInventoryItemBody,
} from "@expirymate/shared";
import { findProhibitedBarcodeContributionFields } from "./barcode-contribution-moderation";

type PrismaLike = Pick<
  PrismaClient,
  "productMaster" | "productMasterCorrection"
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
  const proposedName = params.proposed.displayName.trim();
  const proposedBrand = params.proposed.brand?.trim() || null;
  const proposedCategory = params.proposed.category?.trim() || null;
  const differs = catalogIdentityDiffers(
    {
      name: params.catalog.name,
      brand: params.catalog.brand,
      category: params.catalog.category,
    },
    {
      name: proposedName,
      brand: proposedBrand,
      category: proposedCategory,
    },
  );

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
      catalogName: params.catalog.name,
      catalogBrand: params.catalog.brand,
      catalogCategory: params.catalog.category,
      proposedName,
      proposedBrand,
      proposedCategory,
      status: PrismaCorrectionStatus.pending,
    },
    update: {
      catalogName: params.catalog.name,
      catalogBrand: params.catalog.brand,
      catalogCategory: params.catalog.category,
      proposedName,
      proposedBrand,
      proposedCategory,
      status: PrismaCorrectionStatus.pending,
      reviewedAt: null,
      reviewedByUserId: null,
    },
  });
}
