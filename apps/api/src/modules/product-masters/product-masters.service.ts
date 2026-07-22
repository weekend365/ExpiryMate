import {
  BadRequestException,
  Injectable,
  Logger,
} from "@nestjs/common";
import {
  BarcodeLookupSource,
  type BarcodeLookupResult,
  type ContributeBarcodeProductRequest,
  type ContributeBarcodeProductResponse,
  ProductMasterSource,
} from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";
import { serializeProductMaster } from "../../common/serializers";

type OpenFoodFactsResponse = {
  status?: number;
  product?: {
    product_name_ko?: string;
    product_name?: string;
    brands?: string;
    categories?: string;
    image_url?: string;
  };
};

@Injectable()
export class ProductMastersService {
  private readonly logger = new Logger(ProductMastersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async lookupByBarcode(rawBarcode: string): Promise<BarcodeLookupResult> {
    const barcode = normalizeBarcode(rawBarcode);

    if (!barcode) {
      throw new BadRequestException("올바른 바코드 번호를 입력해 주세요.");
    }

    const local = await this.prisma.productMaster.findUnique({
      where: { barcode },
    });

    if (local) {
      return {
        barcode: local.barcode,
        name: local.name,
        brand: local.brand,
        category: local.category,
        imageUrl: local.imageUrl,
        source: BarcodeLookupSource.PRODUCT_MASTER,
        productMasterId: local.id,
      };
    }

    const offProduct = await this.fetchOpenFoodFacts(barcode);

    if (offProduct) {
      const cached = await this.cacheOpenFoodFactsProduct(barcode, offProduct);

      return {
        barcode,
        name: offProduct.name,
        brand: offProduct.brand,
        category: offProduct.category,
        imageUrl: offProduct.imageUrl,
        source: BarcodeLookupSource.OPEN_FOOD_FACTS,
        productMasterId: cached?.id ?? null,
      };
    }

    return {
      barcode,
      name: null,
      brand: null,
      category: null,
      imageUrl: null,
      source: BarcodeLookupSource.NOT_FOUND,
      productMasterId: null,
    };
  }

  async contribute(
    dto: ContributeBarcodeProductRequest,
    ownerKey: string,
  ): Promise<ContributeBarcodeProductResponse> {
    const barcode = normalizeBarcode(dto.barcode);

    if (!barcode) {
      throw new BadRequestException("올바른 바코드 번호를 입력해 주세요.");
    }

    const name = dto.name.trim();
    const brand = dto.brand?.trim() || "알 수 없음";
    const category = dto.category?.trim() || "기타";

    if (!name) {
      throw new BadRequestException("재료명을 입력해 주세요.");
    }

    const existing = await this.prisma.productMaster.findUnique({
      where: { barcode },
    });

    if (existing) {
      // Authoritative catalog rows are never overwritten by user contributions.
      if (existing.source !== ProductMasterSource.USER_CONTRIBUTED) {
        return {
          product: serializeProductMaster(existing),
          created: false,
        };
      }

      // Only the original contributor may edit; others keep the existing catalog entry.
      // Orphaned rows (contributor cleared on account delete) may be adopted.
      const canEdit =
        !existing.contributedByUserId ||
        existing.contributedByUserId === ownerKey;

      if (!canEdit) {
        return {
          product: serializeProductMaster(existing),
          created: false,
        };
      }

      const updated = await this.prisma.productMaster.update({
        where: { barcode },
        data: {
          name,
          brand,
          category,
          contributedByUserId: ownerKey,
        },
      });

      return {
        product: serializeProductMaster(updated),
        created: false,
      };
    }

    const created = await this.prisma.productMaster.create({
      data: {
        barcode,
        name,
        brand,
        category,
        source: ProductMasterSource.USER_CONTRIBUTED,
        contributedByUserId: ownerKey,
      },
    });

    return {
      product: serializeProductMaster(created),
      created: true,
    };
  }

  private async fetchOpenFoodFacts(barcode: string) {
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
          barcode,
        )}.json?fields=product_name_ko,product_name,brands,categories,image_url`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "Jango/1.0 (barcode-lookup)",
          },
        },
      );

      if (!response.ok) {
        this.logger.warn(`Open Food Facts lookup failed: HTTP ${response.status}`);
        return null;
      }

      const payload = (await response.json()) as OpenFoodFactsResponse;

      if (payload.status !== 1 || !payload.product) {
        return null;
      }

      const name = [
        payload.product.product_name_ko,
        payload.product.product_name,
      ]
        .find((value) => typeof value === "string" && value.trim().length > 0)
        ?.trim();

      if (!name) {
        return null;
      }

      return {
        name,
        brand: payload.product.brands?.split(",")[0]?.trim() || "알 수 없음",
        category:
          payload.product.categories?.split(",")[0]?.trim() || "기타",
        imageUrl: payload.product.image_url?.trim() || null,
      };
    } catch (error) {
      this.logger.warn(
        `Open Food Facts lookup error: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
      return null;
    }
  }

  private async cacheOpenFoodFactsProduct(
    barcode: string,
    product: {
      name: string;
      brand: string;
      category: string;
      imageUrl: string | null;
    },
  ) {
    try {
      return await this.prisma.productMaster.create({
        data: {
          barcode,
          name: product.name,
          brand: product.brand,
          category: product.category,
          imageUrl: product.imageUrl,
          source: ProductMasterSource.OPEN_FOOD_FACTS,
        },
      });
    } catch (error) {
      // Concurrent lookups may race on unique barcode; prefer existing row.
      const existing = await this.prisma.productMaster.findUnique({
        where: { barcode },
      });

      if (existing) {
        return existing;
      }

      this.logger.warn(
        `Failed to cache Open Food Facts product ${barcode}: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
      return null;
    }
  }
}

export function normalizeBarcode(rawValue: string) {
  const digits = rawValue.replace(/\D/g, "");

  if (digits.length === 12) {
    return digits.padStart(13, "0");
  }

  if (digits.length === 8 || digits.length === 13 || digits.length === 14) {
    return digits;
  }

  return null;
}
