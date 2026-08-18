import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ItemStatus, ProductCategory } from "@prisma/client";
import {
  COUPANG_PARTNERS_DISCLOSURE,
  fieldLimits,
  type AffiliateOffer,
  type AffiliateOffersResponse,
  type AffiliatePlacement,
  type AffiliatePresentation,
  type AffiliateProduct,
  type AffiliateProductGroup,
  type AffiliateProductSearchResponse,
  type AffiliateShoppingResponse,
} from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";
import { isStableMonetizationRolloutEnabled } from "../monetization/monetization-rollout";
import { isRecipeTextBlocked, normalizeRecipeTerm } from "../recipes/recipe-ranking";
import { RecipesService } from "../recipes/recipes.service";
import { SettingsService } from "../settings/settings.service";
import { CoupangPartnersClient } from "./coupang-partners.client";
import {
  buildCoupangSearchUrl,
  isBlockedShoppingText,
  readCoupangPartnersTrackingLink,
  resolveCoupangSearchQuery,
} from "./coupang-search-url";

const MAX_RECIPE_GROUPS = 2;
const MAX_RECENT_GROUPS = 3;
const RECENT_CONSUMED_DAYS = 30;
const SEARCH_RATE_LIMIT = 10;
const SEARCH_RATE_WINDOW_MS = 60_000;

type SearchRate = { startedAt: number; count: number };
const searchRates = new Map<string, SearchRate>();

@Injectable()
export class AffiliateOfferService {
  constructor(
    private readonly recipesService: RecipesService,
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
    private readonly coupang: CoupangPartnersClient,
  ) {}

  async getOffersForDish(input: {
    ownerKey: string;
    recommendationId: string;
    dishIndex: number;
    spaceId?: string;
  }): Promise<AffiliateOffersResponse> {
    if (!this.isEnabled(input.ownerKey)) return disabledOffersResponse();

    const recommendation = await this.recipesService.getRecommendation(
      input.recommendationId,
      input.ownerKey,
      input.spaceId,
    );
    const dish = recommendation.recommendations[input.dishIndex];
    if (!dish) throw new NotFoundException("추천 요리를 찾을 수 없습니다.");

    const preference = await this.settingsService.getRecipePreferences(
      input.ownerKey,
    );
    const ingredients = dish.optionalMissingIngredients
      .filter(
        (ingredient) =>
          !isRecipeTextBlocked(ingredient.name, preference) &&
          !isRecipeTextBlocked(ingredient.reason, preference),
      )
      .slice(0, MAX_RECIPE_GROUPS);
    const productGroups = (
      await Promise.all(
        ingredients.map((ingredient) =>
          this.buildProductGroup({
            ingredientName: ingredient.name,
            reason: ingredient.reason,
            placement: "recipe_missing_ingredient",
          }),
        ),
      )
    ).filter((group): group is AffiliateProductGroup => group !== null);
    const trackingMode = this.trackingMode();
    return {
      enabled: true,
      provider: "coupang_partners",
      trackingMode,
      presentation: resolvePresentation(productGroups, trackingMode),
      disclosure: COUPANG_PARTNERS_DISCLOSURE,
      offers: toLegacyOffers(productGroups),
      productGroups,
    };
  }

  async getShopping(input: {
    ownerKey: string;
    spaceId: string;
  }): Promise<AffiliateShoppingResponse> {
    if (!this.isEnabled(input.ownerKey)) return disabledShoppingResponse();
    const since = new Date(Date.now() - RECENT_CONSUMED_DAYS * 24 * 60 * 60 * 1000);
    const consumed = await this.prisma.inventoryItem.findMany({
      where: {
        spaceId: input.spaceId,
        status: ItemStatus.consumed,
        quantityBase: 0,
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { displayName: true, brand: true, category: true },
    });
    const unique = new Map<string, { displayName: string; brand: string | null }>();
    for (const item of consumed) {
      if (item.category && !REPURCHASE_ALLOWED_CATEGORIES.has(item.category)) {
        continue;
      }
      const name = normalizeRecipeTerm(item.displayName);
      if (!name) continue;
      const key = `${name}:${normalizeRecipeTerm(item.brand ?? "")}`;
      if (!unique.has(key)) unique.set(key, item);
      if (unique.size >= MAX_RECENT_GROUPS) break;
    }
    const productGroups = (
      await Promise.all(
        [...unique.values()].map((item) =>
          this.buildProductGroup({
            ingredientName: item.displayName,
            reason: "최근에 모두 사용한 재료예요.",
            placement: "shopping_recently_consumed",
            brand: item.brand,
          }),
        ),
      )
    ).filter((group): group is AffiliateProductGroup => group !== null);
    return {
      enabled: true,
      provider: "coupang_partners",
      disclosure: COUPANG_PARTNERS_DISCLOSURE,
      productGroups,
    };
  }

  async searchProducts(input: {
    ownerKey: string;
    query: string;
  }): Promise<AffiliateProductSearchResponse> {
    if (!this.isEnabled(input.ownerKey)) return disabledSearchResponse();
    enforceSearchRate(input.ownerKey);
    const group = await this.buildProductGroup({
      ingredientName: input.query.trim(),
      reason: "직접 검색한 상품이에요.",
      placement: "shopping_search",
    });
    return {
      enabled: true,
      provider: "coupang_partners",
      presentation: group
        ? resolvePresentation([group], this.trackingMode())
        : "none",
      disclosure: COUPANG_PARTNERS_DISCLOSURE,
      group,
    };
  }

  private isEnabled(ownerKey: string) {
    return isStableMonetizationRolloutEnabled({
      subjectKey: ownerKey,
      enabledFlag: "AFFILIATE_OFFERS_ENABLED",
      rolloutFlag: "AFFILIATE_OFFERS_ROLLOUT_PERCENT",
      experimentKey: "affiliate-offers-v1",
    });
  }

  private trackingMode(): AffiliateOffersResponse["trackingMode"] {
    if (this.coupang.hasCredentials()) return "deeplink";
    return readCoupangPartnersTrackingLink() ? "partner_link" : "none";
  }

  private async buildProductGroup(input: {
    ingredientName: string;
    reason: string;
    placement: AffiliatePlacement;
    brand?: string | null;
  }): Promise<AffiliateProductGroup | null> {
    const baseQuery = resolveCoupangSearchQuery(input.ingredientName);
    if (!baseQuery) return null;
    const query = [input.brand?.trim(), baseQuery]
      .filter(Boolean)
      .join(" ")
      .slice(0, fieldLimits.recipeIngredientName);
    const products = this.coupang.hasCredentials()
      ? filterRelevantProducts(
          (await this.coupang.searchProducts(query)) ?? [],
          baseQuery,
        ).slice(0, readMaxProducts())
      : [];
    let fallbackUrl = products[0]?.productUrl ?? null;
    if (!fallbackUrl && this.coupang.hasCredentials()) {
      fallbackUrl = await this.coupang.createDeeplink(buildCoupangSearchUrl(query));
    }
    fallbackUrl ||= readCoupangPartnersTrackingLink();
    if (!fallbackUrl && products.length === 0) return null;
    return {
      ingredientName: input.ingredientName,
      reason: input.reason,
      query,
      placement: input.placement,
      products,
      fallbackUrl,
    };
  }
}

function filterRelevantProducts(products: AffiliateProduct[], query: string) {
  const normalizedQuery = normalizeRecipeTerm(query);
  const tokens = query
    .split(/\s+/)
    .map(normalizeRecipeTerm)
    .filter((token) => token.length >= 2);
  return products.filter((product) => {
    if (isBlockedShoppingText(product.productName)) return false;
    const normalizedProduct = normalizeRecipeTerm(product.productName);
    return (
      normalizedProduct.includes(normalizedQuery) ||
      (tokens.length > 0 && tokens.every((token) => normalizedProduct.includes(token)))
    );
  });
}

const REPURCHASE_ALLOWED_CATEGORIES = new Set<ProductCategory>([
  ProductCategory.dairy,
  ProductCategory.egg,
  ProductCategory.tofu,
  ProductCategory.beverage,
  ProductCategory.instant_food,
  ProductCategory.frozen_food,
  ProductCategory.produce,
  ProductCategory.seasoning,
  ProductCategory.snack,
  ProductCategory.household,
]);

function toLegacyOffers(groups: AffiliateProductGroup[]): AffiliateOffer[] {
  return groups.flatMap((group) => {
    const landingUrl = group.products[0]?.productUrl ?? group.fallbackUrl;
    return landingUrl
      ? [{
          ingredientName: group.ingredientName,
          reason: group.reason,
          query: group.query,
          landingUrl,
          tracked: true,
        }]
      : [];
  });
}

function resolvePresentation(
  groups: AffiliateProductGroup[],
  mode: AffiliateOffersResponse["trackingMode"],
): AffiliatePresentation {
  if (groups.some((group) => group.products.length > 0)) return "product_search";
  if (mode === "deeplink" && groups.length > 0) {
    const configuredFallback = readCoupangPartnersTrackingLink();
    const hasGeneratedDeeplink = groups.some(
      (group) => group.fallbackUrl && group.fallbackUrl !== configuredFallback,
    );
    return hasGeneratedDeeplink ? "deeplink_fallback" : "partner_link";
  }
  if (mode === "partner_link" && groups.length > 0) return "partner_link";
  return "none";
}

function readMaxProducts() {
  const parsed = Number(process.env.AFFILIATE_MAX_PRODUCTS_PER_INGREDIENT ?? 3);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 3) : 3;
}

function enforceSearchRate(ownerKey: string) {
  const now = Date.now();
  const current = searchRates.get(ownerKey);
  if (!current || current.startedAt <= now - SEARCH_RATE_WINDOW_MS) {
    searchRates.set(ownerKey, { startedAt: now, count: 1 });
    return;
  }
  if (current.count >= SEARCH_RATE_LIMIT) {
    throw new HttpException(
      "검색을 너무 자주 요청했어요. 잠시 후 다시 시도해 주세요.",
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
  current.count += 1;
}

function disabledOffersResponse(): AffiliateOffersResponse {
  return {
    enabled: false,
    provider: "coupang_partners",
    trackingMode: "none",
    presentation: "none",
    disclosure: COUPANG_PARTNERS_DISCLOSURE,
    offers: [],
    productGroups: [],
  };
}

function disabledShoppingResponse(): AffiliateShoppingResponse {
  return {
    enabled: false,
    provider: "coupang_partners",
    disclosure: COUPANG_PARTNERS_DISCLOSURE,
    productGroups: [],
  };
}

function disabledSearchResponse(): AffiliateProductSearchResponse {
  return {
    enabled: false,
    provider: "coupang_partners",
    presentation: "none",
    disclosure: COUPANG_PARTNERS_DISCLOSURE,
    group: null,
  };
}

export function resetAffiliateRuntimeState() {
  searchRates.clear();
}

/** Backwards-compatible test helper retained for existing callers. */
export const resetAffiliateLandingCache = resetAffiliateRuntimeState;
