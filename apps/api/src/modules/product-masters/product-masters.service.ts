import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  BarcodeLookupSource,
  type BarcodeLookupResult,
  type BarcodeRewardReason,
  type ContributeBarcodeProductRequest,
  type ContributeBarcodeProductResponse,
  getKstDayWindow,
  ProductMasterSource,
  catalogNeedsNameConfirmation,
  initialCatalogConfidence,
  resolveCatalogConfidence,
  resolveCatalogDisplayIdentity,
} from "@expirymate/shared";
import { serializeProductMaster } from "../../common/serializers";
import { CodedHttpException } from "../../common/coded-http.exception";
import { PrismaService } from "../../database/prisma.service";
import {
  barcodeRewardsGloballyEnabled,
  resolveBarcodeRewardPolicy,
} from "../monetization/barcode-reward-policy";
import { findProhibitedBarcodeContributionFields } from "./barcode-contribution-moderation";
import { isValidGtin, normalizeBarcode } from "./barcode-format";

export { isValidGtin, normalizeBarcode } from "./barcode-format";

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

type OpenFoodFactsProduct = {
  name: string;
  brand: string;
  category: string;
  imageUrl: string | null;
};

type OpenFoodFactsLookup =
  | { kind: "found"; product: OpenFoodFactsProduct }
  | { kind: "not_found" }
  | { kind: "unavailable" };

type RewardSnapshot = {
  balance: number;
  earnedToday: number;
};

const CONTRIBUTION_TOKEN_TTL_MS = 15 * 60 * 1000;

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
      const display = resolveCatalogDisplayIdentity(local);
      const confidence = resolveCatalogConfidence(local);
      return {
        barcode: local.barcode,
        name: display.name,
        brand: display.brand ?? null,
        category: display.category ?? null,
        imageUrl: local.imageUrl,
        source: BarcodeLookupSource.PRODUCT_MASTER,
        productMasterId: local.id,
        confidence,
        needsNameConfirmation: catalogNeedsNameConfirmation(confidence),
      };
    }

    const offLookup = await this.fetchOpenFoodFacts(barcode);
    if (offLookup.kind === "found") {
      const cached = await this.cacheOpenFoodFactsProduct(
        barcode,
        offLookup.product,
      );
      const confidence = resolveCatalogConfidence(
        cached ?? { source: ProductMasterSource.OPEN_FOOD_FACTS },
      );
      return {
        barcode,
        name: offLookup.product.name,
        brand: offLookup.product.brand,
        category: offLookup.product.category,
        imageUrl: offLookup.product.imageUrl,
        source: BarcodeLookupSource.OPEN_FOOD_FACTS,
        productMasterId: cached?.id ?? null,
        confidence,
        needsNameConfirmation: catalogNeedsNameConfirmation(confidence),
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
      needsNameConfirmation: false,
      contributionToken:
        offLookup.kind === "not_found" && isValidGtin(barcode)
          ? this.createContributionToken(barcode)
          : undefined,
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
    const providedBrand = dto.brand?.trim();
    const providedCategory = dto.category?.trim();
    const brand = providedBrand || "브랜드 없음";
    const category = providedCategory || "기타";
    if (!name) {
      throw new BadRequestException("재료명을 입력해 주세요.");
    }

    const prohibitedFields = findProhibitedBarcodeContributionFields({
      name,
      brand: providedBrand,
      category: providedCategory,
    });
    if (prohibitedFields.length > 0) {
      throw new CodedHttpException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        "BARCODE_CONTRIBUTION_PROHIBITED_CONTENT",
        "상품 정보에 사용할 수 없는 표현이 있어요. 문구를 수정해 주세요.",
        { fields: prohibitedFields },
      );
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const now = new Date();
            const existing = await tx.productMaster.findUnique({
              where: { barcode },
            });

            if (existing) {
              let product = existing;
              const canEdit =
                existing.source === ProductMasterSource.USER_CONTRIBUTED &&
                (!existing.contributedByUserId ||
                  existing.contributedByUserId === ownerKey);
              if (canEdit) {
                product = await tx.productMaster.update({
                  where: { barcode },
                  data: {
                    name,
                    brand,
                    category,
                    contributedByUserId: ownerKey,
                  },
                });
              }

              return {
                product: serializeProductMaster(product),
                created: false,
                reward: await this.buildDeniedReward(
                  tx,
                  ownerKey,
                  now,
                  "existing_barcode",
                ),
              };
            }

            const created = await tx.productMaster.create({
              data: {
                barcode,
                name,
                brand,
                category,
                source: ProductMasterSource.USER_CONTRIBUTED,
                contributedByUserId: ownerKey,
                confidence: initialCatalogConfidence(
                  ProductMasterSource.USER_CONTRIBUTED,
                ),
              },
            });
            const reward = await this.grantBarcodeReward(tx, {
              ownerKey,
              productMasterId: created.id,
              barcode,
              contributionToken: dto.contributionToken,
              hasAdditionalData: Boolean(providedBrand || providedCategory),
              now,
            });

            return {
              product: serializeProductMaster(created),
              created: true,
              reward,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < 2) continue;
        throw error;
      }
    }

    throw new Error("Barcode contribution transaction did not complete.");
  }

  private async grantBarcodeReward(
    tx: Prisma.TransactionClient,
    input: {
      ownerKey: string;
      productMasterId: string;
      barcode: string;
      contributionToken?: string;
      hasAdditionalData: boolean;
      now: Date;
    },
  ): Promise<ContributeBarcodeProductResponse["reward"]> {
    const policy = resolveBarcodeRewardPolicy(input.ownerKey);
    const snapshot = await this.getRewardSnapshot(tx, input.ownerKey, input.now);
    let reason: BarcodeRewardReason | null = null;

    if (!policy.enabled) reason = "rewards_disabled";
    else if (!isValidGtin(input.barcode)) reason = "invalid_gtin";
    else if (!this.verifyContributionToken(input.contributionToken, input.barcode)) {
      reason = "lookup_unverified";
    } else if (!input.hasAdditionalData) reason = "insufficient_product_data";
    else if (snapshot.earnedToday >= policy.dailyLimit) {
      reason = "daily_limit_reached";
    } else if (snapshot.balance >= policy.balanceLimit) {
      reason = "balance_limit_reached";
    }

    if (reason) {
      await this.recordRewardEvent(tx, input.ownerKey, policy.cohort, reason);
      return this.formatReward(policy, snapshot, reason);
    }

    await tx.barcodeRewardCredit.create({
      data: {
        ownerKey: input.ownerKey,
        productMasterId: input.productMasterId,
        earnedDay: getKstDayWindow(input.now).start,
      },
    });
    const grantedSnapshot = {
      balance: snapshot.balance + 1,
      earnedToday: snapshot.earnedToday + 1,
    };
    await this.recordRewardEvent(tx, input.ownerKey, policy.cohort, "granted");
    return this.formatReward(policy, grantedSnapshot, "granted");
  }

  private async buildDeniedReward(
    tx: Prisma.TransactionClient,
    ownerKey: string,
    now: Date,
    reason: BarcodeRewardReason,
  ) {
    const policy = resolveBarcodeRewardPolicy(ownerKey);
    const snapshot = await this.getRewardSnapshot(tx, ownerKey, now);
    await this.recordRewardEvent(tx, ownerKey, policy.cohort, reason);
    return this.formatReward(policy, snapshot, reason);
  }

  private formatReward(
    policy: ReturnType<typeof resolveBarcodeRewardPolicy>,
    snapshot: RewardSnapshot,
    reason: BarcodeRewardReason,
  ): ContributeBarcodeProductResponse["reward"] {
    return {
      granted: reason === "granted",
      creditsGranted: reason === "granted" ? 1 : 0,
      balance: snapshot.balance,
      earnedToday: snapshot.earnedToday,
      dailyLimit: policy.dailyLimit,
      balanceLimit: policy.balanceLimit,
      reason,
    };
  }

  private async getRewardSnapshot(
    tx: Prisma.TransactionClient,
    ownerKey: string,
    now: Date,
  ): Promise<RewardSnapshot> {
    const { start } = getKstDayWindow(now);
    const [balance, earnedToday] = await Promise.all([
      tx.barcodeRewardCredit.count({
        where: { ownerKey, usageEvent: { is: null } },
      }),
      tx.barcodeRewardCredit.count({
        where: { ownerKey, earnedDay: start },
      }),
    ]);
    return { balance, earnedToday };
  }

  private async recordRewardEvent(
    tx: Prisma.TransactionClient,
    ownerKey: string,
    cohort: "control" | "reward",
    reason: BarcodeRewardReason,
  ) {
    await tx.monetizationFunnelEvent.create({
      data: {
        ownerKey,
        eventName:
          reason === "granted"
            ? "barcode_reward_granted"
            : "barcode_reward_denied",
        experimentKey: "barcode-rewards-v1",
        experimentVariant: cohort,
        properties: { reason },
      },
    });
  }

  private createContributionToken(barcode: string) {
    if (!barcodeRewardsGloballyEnabled()) return undefined;
    const secret = process.env.BARCODE_REWARD_TOKEN_SECRET?.trim();
    if (!secret) {
      this.logger.warn("BARCODE_REWARD_TOKEN_SECRET is missing.");
      return undefined;
    }
    const payload = Buffer.from(
      JSON.stringify({
        barcode,
        expiresAt: Date.now() + CONTRIBUTION_TOKEN_TTL_MS,
      }),
      "utf8",
    ).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");
    return `${payload}.${signature}`;
  }

  private verifyContributionToken(token: string | undefined, barcode: string) {
    const secret = process.env.BARCODE_REWARD_TOKEN_SECRET?.trim();
    if (!token || !secret) return false;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return false;
    const expected = createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return false;
    }
    try {
      const parsed = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as { barcode?: unknown; expiresAt?: unknown };
      return (
        parsed.barcode === barcode &&
        typeof parsed.expiresAt === "number" &&
        parsed.expiresAt >= Date.now()
      );
    } catch {
      return false;
    }
  }

  private async fetchOpenFoodFacts(
    barcode: string,
  ): Promise<OpenFoodFactsLookup> {
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

      if (response.status === 404) return { kind: "not_found" };
      if (!response.ok) {
        this.logger.warn(`Open Food Facts lookup failed: HTTP ${response.status}`);
        return { kind: "unavailable" };
      }

      const payload = (await response.json()) as OpenFoodFactsResponse;
      if (payload.status !== 1 || !payload.product) {
        return { kind: "not_found" };
      }

      const name = [
        payload.product.product_name_ko,
        payload.product.product_name,
      ]
        .find((value) => typeof value === "string" && value.trim().length > 0)
        ?.trim();
      if (!name) return { kind: "not_found" };

      return {
        kind: "found",
        product: {
          name,
          brand: payload.product.brands?.split(",")[0]?.trim() || "브랜드 없음",
          category:
            payload.product.categories?.split(",")[0]?.trim() || "기타",
          imageUrl: payload.product.image_url?.trim() || null,
        },
      };
    } catch (error) {
      this.logger.warn(
        `Open Food Facts lookup error: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
      return { kind: "unavailable" };
    }
  }

  private async cacheOpenFoodFactsProduct(
    barcode: string,
    product: OpenFoodFactsProduct,
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
          confidence: initialCatalogConfidence(
            ProductMasterSource.OPEN_FOOD_FACTS,
          ),
        },
      });
    } catch (error) {
      const existing = await this.prisma.productMaster.findUnique({
        where: { barcode },
      });
      if (existing) return existing;
      this.logger.warn(
        `Failed to cache Open Food Facts product ${barcode}: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
      return null;
    }
  }
}

function isRetryableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}
