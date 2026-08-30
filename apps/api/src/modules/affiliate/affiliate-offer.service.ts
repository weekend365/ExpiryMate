import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  InventoryDispositionOutcome,
  ItemStatus,
  ProductCategory,
} from "@prisma/client";
import {
  COUPANG_PARTNERS_DISCLOSURE,
  fieldLimits,
  type AffiliateOffer,
  type AffiliateContextualSearchPlacement,
  type AffiliateOffersResponse,
  type AffiliatePlacement,
  type AffiliatePresentation,
  type AffiliateProduct,
  type AffiliateProductGroup,
  type AffiliateProductSearchResponse,
  type AffiliateReorderPreviewKind,
  type AffiliateReorderPreviewResponse,
  type AffiliateShoppingResponse,
} from "@expirymate/shared";
import { PrismaService } from "../../database/prisma.service";
import {
  isStableMonetizationRolloutEnabled,
  isSubjectInStableRollout,
} from "../monetization/monetization-rollout";
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
const MAX_RECENT_CANDIDATES = 9;
const RECENT_RESOLVED_DAYS = 30;
const REPEAT_PURCHASE_LOOKBACK_DAYS = 180;
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
    if (!this.isPlacementEnabled(input.ownerKey, "recipe_missing_ingredient")) {
      return disabledOffersResponse();
    }

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
    if (!this.isPlacementEnabled(input.ownerKey, "shopping_recently_consumed")) {
      return disabledShoppingResponse();
    }
    const since = new Date(Date.now() - RECENT_RESOLVED_DAYS * 24 * 60 * 60 * 1000);
    const resolved = await this.prisma.inventoryItem.findMany({
      where: {
        spaceId: input.spaceId,
        status: ItemStatus.consumed,
        quantityBase: 0,
        updatedAt: { gte: since },
      },
      orderBy: { updatedAt: "desc" },
      select: { displayName: true, brand: true, category: true },
    });
    const unique = uniqueRecentResolvedItems(resolved);
    const productGroups = (
      await Promise.all(
        [...unique.values()].slice(0, MAX_RECENT_CANDIDATES).map((item) =>
          this.buildProductGroup({
            ingredientName: item.displayName,
            reason: "",
            placement: "shopping_recently_consumed",
            brand: item.brand,
          }),
        ),
      )
    )
      .filter(
        (group): group is AffiliateProductGroup =>
          group !== null && group.products.length > 0,
      );
    return {
      enabled: true,
      provider: "coupang_partners",
      disclosure: COUPANG_PARTNERS_DISCLOSURE,
      recentResolvedCount: unique.size,
      // Keep the old field populated while released clients still read it.
      recentConsumedCount: unique.size,
      productGroups,
    };
  }

  async searchProducts(input: {
    ownerKey: string;
    query: string;
    placement: AffiliateContextualSearchPlacement;
  }): Promise<AffiliateProductSearchResponse> {
    if (!this.isPlacementEnabled(input.ownerKey, input.placement)) {
      return disabledSearchResponse();
    }
    enforceSearchRate(input.ownerKey);
    const group = await this.buildProductGroup({
      ingredientName: input.query.trim(),
      reason: contextualSearchReason(input.placement),
      placement: input.placement,
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

  async getReorderPreview(input: {
    ownerKey: string;
    spaceId: string;
  }): Promise<AffiliateReorderPreviewResponse> {
    if (!this.isPlacementEnabled(input.ownerKey, "home_reorder_preview")) {
      return disabledReorderPreviewResponse();
    }

    const since = new Date(
      Date.now() - REPEAT_PURCHASE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
    );
    const events = await this.prisma.inventoryDispositionEvent.findMany({
      where: {
        spaceId: input.spaceId,
        outcome: InventoryDispositionOutcome.consumed,
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: "desc" },
      take: 60,
      select: {
        displayName: true,
        category: true,
        itemSnapshot: true,
        occurredAt: true,
      },
    });
    const candidate = selectReorderPreviewCandidate(events);
    if (!candidate) {
      return emptyReorderPreviewResponse();
    }

    const group = await this.buildProductGroup({
      ingredientName: candidate.displayName,
      brand: candidate.brand,
      reason:
        candidate.kind === "repeat_purchase_due"
          ? `평소 소비 주기를 기준으로 다시 필요할 때예요.`
          : "최근 모두 사용한 재료예요.",
      placement: "home_reorder_preview",
    });
    if (!group || group.products.length === 0) {
      return emptyReorderPreviewResponse();
    }

    return {
      enabled: true,
      provider: "coupang_partners",
      disclosure: COUPANG_PARTNERS_DISCLOSURE,
      kind: candidate.kind,
      cadenceDays: candidate.cadenceDays,
      lastConsumedAt: candidate.lastConsumedAt.toISOString(),
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

  private isPlacementEnabled(ownerKey: string, placement: AffiliatePlacement) {
    if (!this.isEnabled(ownerKey)) return false;
    const key = AFFILIATE_PLACEMENT_ENV_KEYS[placement];
    const enabled = readOptionalBoolean(process.env[`${key}_ENABLED`], true);
    const rollout = readOptionalPercentage(
      process.env[`${key}_ROLLOUT_PERCENT`],
      100,
    );
    return isSubjectInStableRollout({
      subjectKey: ownerKey,
      enabled,
      percent: rollout,
      experimentKey: `affiliate-placement-${placement}`,
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
      ? uniqueByProductId(
          filterRelevantProducts(
            (await this.coupang.searchProducts(query)) ?? [],
            baseQuery,
          ),
        ).slice(0, readMaxProducts())
      : [];
    if (input.placement === "shopping_recently_consumed" && products.length === 0) {
      return null;
    }
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

function contextualSearchReason(placement: AffiliateContextualSearchPlacement) {
  switch (placement) {
    case "inventory_consumed":
      return "방금 모두 사용한 재료예요.";
    case "cooking_complete":
      return "오늘 요리에 모두 사용한 재료예요.";
    case "recipe_optional_entry":
      return "이 요리에 있으면 더 좋은 재료예요.";
    case "home_reorder_preview":
      return "다시 필요할 때가 된 재료예요.";
    default:
      return "직접 검색한 상품이에요.";
  }
}

function uniqueRecentResolvedItems(
  items: Array<{
    displayName: string;
    brand: string | null;
    category: ProductCategory | null;
  }>,
) {
  const unique = new Map<string, { displayName: string; brand: string | null }>();
  for (const item of items) {
    if (item.category && !REPURCHASE_ALLOWED_CATEGORIES.has(item.category)) {
      continue;
    }
    const name = normalizeRecipeTerm(item.displayName);
    if (!name) continue;
    const key = `${name}:${normalizeRecipeTerm(item.brand ?? "")}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return unique;
}

function uniqueByProductId(products: AffiliateProduct[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.productId)) return false;
    seen.add(product.productId);
    return true;
  });
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

const AFFILIATE_PLACEMENT_ENV_KEYS: Record<AffiliatePlacement, string> = {
  recipe_missing_ingredient: "AFFILIATE_PLACEMENT_RECIPE_MISSING",
  shopping_recently_consumed: "AFFILIATE_PLACEMENT_SHOPPING_RECENT",
  shopping_search: "AFFILIATE_PLACEMENT_SHOPPING_SEARCH",
  inventory_consumed: "AFFILIATE_PLACEMENT_INVENTORY_CONSUMED",
  cooking_complete: "AFFILIATE_PLACEMENT_COOKING_COMPLETE",
  recipe_optional_entry: "AFFILIATE_PLACEMENT_RECIPE_OPTIONAL_ENTRY",
  home_reorder_preview: "AFFILIATE_PLACEMENT_HOME_REORDER",
};

type ReorderPreviewEvent = {
  displayName: string;
  category: ProductCategory | null;
  itemSnapshot: unknown;
  occurredAt: Date;
};

type ReorderPreviewCandidate = {
  displayName: string;
  brand: string | null;
  kind: AffiliateReorderPreviewKind;
  cadenceDays: number | null;
  lastConsumedAt: Date;
};

export function selectReorderPreviewCandidate(
  events: ReorderPreviewEvent[],
  now = new Date(),
): ReorderPreviewCandidate | null {
  const grouped = new Map<string, ReorderPreviewEvent[]>();
  for (const event of events) {
    if (event.category && !REPURCHASE_ALLOWED_CATEGORIES.has(event.category)) {
      continue;
    }
    const normalized = normalizeRecipeTerm(event.displayName);
    if (!normalized) continue;
    const brand = readSnapshotBrand(event.itemSnapshot);
    const key = `${normalized}:${normalizeRecipeTerm(brand ?? "")}`;
    const current = grouped.get(key) ?? [];
    current.push(event);
    grouped.set(key, current);
  }

  const repeated = [...grouped.values()]
    .filter((group) => group.length >= 2)
    .flatMap((group) => {
      const ordered = [...group].sort(
        (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
      );
      const intervals = ordered.slice(1).map((event, index) =>
        Math.max(
          1,
          Math.round(
            (event.occurredAt.getTime() - ordered[index]!.occurredAt.getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        ),
      );
      const cadenceDays = Math.max(
        1,
        Math.round(
          intervals.reduce((sum, value) => sum + value, 0) / intervals.length,
        ),
      );
      const latest = ordered[ordered.length - 1]!;
      const daysSinceLast = Math.max(
        0,
        Math.floor(
          (now.getTime() - latest.occurredAt.getTime()) / (24 * 60 * 60 * 1000),
        ),
      );
      if (daysSinceLast < Math.max(1, Math.floor(cadenceDays * 0.75))) {
        return [];
      }
      return [{
        displayName: latest.displayName,
        brand: readSnapshotBrand(latest.itemSnapshot),
        kind: "repeat_purchase_due" as const,
        cadenceDays,
        lastConsumedAt: latest.occurredAt,
        urgency: daysSinceLast / cadenceDays,
      }];
    })
    .sort((left, right) => right.urgency - left.urgency);
  if (repeated[0]) {
    return {
      displayName: repeated[0].displayName,
      brand: repeated[0].brand,
      kind: repeated[0].kind,
      cadenceDays: repeated[0].cadenceDays,
      lastConsumedAt: repeated[0].lastConsumedAt,
    };
  }

  const latest = [...grouped.values()]
    .flat()
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())[0];
  if (!latest) return null;
  const daysSinceLast = Math.floor(
    (now.getTime() - latest.occurredAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (daysSinceLast > RECENT_RESOLVED_DAYS) return null;
  return {
    displayName: latest.displayName,
    brand: readSnapshotBrand(latest.itemSnapshot),
    kind: "recently_consumed",
    cadenceDays: null,
    lastConsumedAt: latest.occurredAt,
  };
}

function readSnapshotBrand(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return null;
  }
  const value = (snapshot as Record<string, unknown>).brand;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

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

function readOptionalBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function readOptionalPercentage(value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : fallback;
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
    recentResolvedCount: 0,
    recentConsumedCount: 0,
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

function emptyReorderPreviewResponse(): AffiliateReorderPreviewResponse {
  return {
    enabled: true,
    provider: "coupang_partners",
    disclosure: COUPANG_PARTNERS_DISCLOSURE,
    kind: null,
    cadenceDays: null,
    lastConsumedAt: null,
    group: null,
  };
}

function disabledReorderPreviewResponse(): AffiliateReorderPreviewResponse {
  return {
    ...emptyReorderPreviewResponse(),
    enabled: false,
  };
}

export function resetAffiliateRuntimeState() {
  searchRates.clear();
}

/** Backwards-compatible test helper retained for existing callers. */
export const resetAffiliateLandingCache = resetAffiliateRuntimeState;
