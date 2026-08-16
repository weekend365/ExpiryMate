import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ProductMasterCorrectionStatus as PrismaCorrectionStatus } from "@prisma/client";
import {
  ProductMasterSource,
  type AdminProductMasterDetail,
  type AdminProductMasterListResponse,
  type UpdateProductMasterBody,
} from "@expirymate/shared";
import {
  serializeProductMaster,
  serializeProductMasterCorrection,
} from "../../common/serializers";
import { PrismaService } from "../../database/prisma.service";
import { applyPendingCatalogCorrection } from "../product-masters/catalog-correction";
import { AdminAuditService } from "./admin-audit.service";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export interface AdminProductMasterListParams {
  page?: number;
  limit?: number;
  q?: string;
  source?: string;
  hasPendingCorrections?: boolean;
}

@Injectable()
export class ProductMastersAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAudit: AdminAuditService,
  ) {}

  async list(
    params: AdminProductMasterListParams,
  ): Promise<AdminProductMasterListResponse> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE),
    );
    const source = parseProductMasterSource(params.source);
    const pendingFilter = params.hasPendingCorrections
      ? {
          corrections: {
            some: { status: PrismaCorrectionStatus.pending },
          },
        }
      : undefined;
    const searchFilter = params.q?.trim()
      ? {
          OR: [
            {
              name: {
                contains: params.q.trim(),
                mode: "insensitive" as const,
              },
            },
            {
              brand: {
                contains: params.q.trim(),
                mode: "insensitive" as const,
              },
            },
            {
              crowdName: {
                contains: params.q.trim(),
                mode: "insensitive" as const,
              },
            },
            {
              crowdBrand: {
                contains: params.q.trim(),
                mode: "insensitive" as const,
              },
            },
            {
              barcode: {
                contains: params.q.trim(),
              },
            },
          ],
        }
      : undefined;

    const where = {
      source,
      ...pendingFilter,
      ...searchFilter,
    };

    const [totalCount, products] = await this.prisma.$transaction([
      this.prisma.productMaster.count({ where }),
      this.prisma.productMaster.findMany({
        where,
        include: {
          _count: {
            select: {
              corrections: {
                where: { status: PrismaCorrectionStatus.pending },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: products.map((product) => ({
        ...serializeProductMaster(product),
        pendingCorrectionCount: product._count.corrections,
      })),
      page,
      limit,
      totalCount,
      hasMore: page * limit < totalCount,
    };
  }

  async getDetail(id: string): Promise<AdminProductMasterDetail> {
    const product = await this.prisma.productMaster.findUnique({
      where: { id },
      include: {
        corrections: {
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        },
      },
    });

    if (!product) {
      throw new NotFoundException("바코드 상품을 찾지 못했어요.");
    }

    const { corrections, ...catalog } = product;
    return {
      product: serializeProductMaster(catalog),
      corrections: corrections.map((correction) =>
        serializeProductMasterCorrection(correction, { maskSubmitter: true }),
      ),
    };
  }

  async update(
    id: string,
    dto: UpdateProductMasterBody,
    actorUserId: string,
  ) {
    await this.getDetail(id);

    const product = await this.prisma.productMaster.update({
      where: { id },
      data: {
        name: dto.name,
        brand: dto.brand,
        category: dto.category,
        imageUrl:
          dto.imageUrl === ""
            ? null
            : dto.imageUrl === undefined
              ? undefined
              : dto.imageUrl,
      },
    });

    await this.adminAudit.record({
      actorUserId,
      action: "product_master.update",
      resourceType: "product_master",
      resourceId: product.id,
      metadata: {
        ...dto,
      },
    });

    return serializeProductMaster(product);
  }

  async applyCorrection(
    productMasterId: string,
    correctionId: string,
    actorUserId: string,
  ) {
    const correction = await this.requirePendingCorrection(
      productMasterId,
      correctionId,
    );

    const product = await this.prisma.$transaction(async (tx) => {
      const catalog = await tx.productMaster.findUnique({
        where: { id: productMasterId },
      });
      if (!catalog) {
        throw new NotFoundException("바코드 상품을 찾지 못했어요.");
      }

      return applyPendingCatalogCorrection(tx, {
        catalog,
        correction,
        actorUserId,
      });
    });

    await this.adminAudit.record({
      actorUserId,
      action: "product_master.correction.apply",
      resourceType: "product_master_correction",
      resourceId: correctionId,
      metadata: {
        productMasterId,
        proposedName: correction.proposedName,
      },
    });

    return serializeProductMaster(product);
  }

  async dismissCorrection(
    productMasterId: string,
    correctionId: string,
    actorUserId: string,
  ) {
    await this.requirePendingCorrection(productMasterId, correctionId);

    await this.prisma.productMasterCorrection.update({
      where: { id: correctionId },
      data: {
        status: PrismaCorrectionStatus.dismissed,
        reviewedByUserId: actorUserId,
        reviewedAt: new Date(),
      },
    });

    await this.adminAudit.record({
      actorUserId,
      action: "product_master.correction.dismiss",
      resourceType: "product_master_correction",
      resourceId: correctionId,
      metadata: { productMasterId },
    });

    return this.getDetail(productMasterId);
  }

  private async requirePendingCorrection(
    productMasterId: string,
    correctionId: string,
  ) {
    const correction = await this.prisma.productMasterCorrection.findFirst({
      where: { id: correctionId, productMasterId },
    });

    if (!correction) {
      throw new NotFoundException("수정 제안을 찾지 못했어요.");
    }

    if (correction.status !== PrismaCorrectionStatus.pending) {
      throw new BadRequestException("이미 살펴본 제안이에요.");
    }

    return correction;
  }
}

function parseProductMasterSource(value?: string) {
  if (!value) {
    return undefined;
  }

  if (
    !Object.values(ProductMasterSource).includes(value as ProductMasterSource)
  ) {
    return undefined;
  }

  return value;
}
