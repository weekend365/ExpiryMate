import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  COUPANG_PARTNERS_DISCLOSURE,
  type AffiliateOffersResponse,
  type RecipePreference,
  type RecipeRecommendationDish,
} from "@expirymate/shared";
import { isStableMonetizationRolloutEnabled } from "../monetization/monetization-rollout";
import { isRecipeTextBlocked } from "../recipes/recipe-ranking";
import { RecipesService } from "../recipes/recipes.service";
import { SettingsService } from "../settings/settings.service";
import {
  convertCoupangSearchUrlToDeeplink,
  readCoupangPartnersCredentials,
} from "./coupang-deeplink";
import {
  buildCoupangSearchUrl,
  readCoupangPartnersTrackingLink,
  resolveCoupangSearchQuery,
} from "./coupang-search-url";

const MAX_OFFERS = 2;

type CachedLanding = {
  landingUrl: string;
  tracked: boolean;
  expiresAt: number;
};

const landingCache = new Map<string, CachedLanding>();

export function resetAffiliateLandingCache() {
  landingCache.clear();
}

@Injectable()
export class AffiliateOfferService {
  private readonly logger = new Logger(AffiliateOfferService.name);

  constructor(
    private readonly recipesService: RecipesService,
    private readonly settingsService: SettingsService,
  ) {}

  async getOffersForDish(input: {
    ownerKey: string;
    recommendationId: string;
    dishIndex: number;
    spaceId?: string;
  }): Promise<AffiliateOffersResponse> {
    const disabled: AffiliateOffersResponse = {
      enabled: false,
      provider: "coupang_partners",
      trackingMode: "none",
      disclosure: COUPANG_PARTNERS_DISCLOSURE,
      offers: [],
    };

    if (!this.isEnabled(input.ownerKey)) {
      return disabled;
    }

    const recommendation = await this.recipesService.getRecommendation(
      input.recommendationId,
      input.ownerKey,
      input.spaceId,
    );
    const dish = recommendation.recommendations[input.dishIndex];
    if (!dish) {
      throw new NotFoundException("추천 요리를 찾을 수 없습니다.");
    }

    const preference = await this.settingsService.getRecipePreferences(
      input.ownerKey,
    );
    const trackingMode = readCoupangPartnersCredentials()
      ? "deeplink"
      : readCoupangPartnersTrackingLink()
        ? "partner_link"
        : "none";

    return {
      enabled: true,
      provider: "coupang_partners",
      trackingMode,
      disclosure: COUPANG_PARTNERS_DISCLOSURE,
      offers: await this.buildOffers(
        dish.optionalMissingIngredients,
        preference,
      ),
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

  private async buildOffers(
    ingredients: RecipeRecommendationDish["optionalMissingIngredients"],
    preference: RecipePreference,
  ) {
    const selected = ingredients
      .filter(
        (ingredient) =>
          !isRecipeTextBlocked(ingredient.name, preference) &&
          !isRecipeTextBlocked(ingredient.reason, preference),
      )
      .slice(0, MAX_OFFERS);

    const offers = [];
    for (const ingredient of selected) {
      const query = resolveCoupangSearchQuery(ingredient.name);
      if (!query) {
        continue;
      }

      const landing = await this.resolveLanding(query);
      if (!landing) {
        continue;
      }

      offers.push({
        ingredientName: ingredient.name,
        reason: ingredient.reason,
        query,
        landingUrl: landing.landingUrl,
        tracked: landing.tracked,
      });
    }

    return offers;
  }

  private async resolveLanding(query: string) {
    const cacheKey = query.toLocaleLowerCase("ko-KR");
    const cached = landingCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    const searchUrl = buildCoupangSearchUrl(query);
    let tracked = false;
    let landingUrl: string | null = null;

    try {
      const deeplink = await convertCoupangSearchUrlToDeeplink(searchUrl);
      if (deeplink) {
        landingUrl = deeplink;
        tracked = true;
      }
    } catch (error) {
      this.logger.warn(
        `Coupang deeplink conversion failed for ${query}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }

    if (!landingUrl) {
      landingUrl = readCoupangPartnersTrackingLink();
      tracked = Boolean(landingUrl);
    }

    if (!landingUrl) {
      return null;
    }

    const resolved = {
      landingUrl,
      tracked,
      expiresAt: Date.now() + readCacheTtlMs(),
    };
    landingCache.set(cacheKey, resolved);
    return resolved;
  }
}

function readCacheTtlMs() {
  const parsed = Number(process.env.AFFILIATE_OFFER_CACHE_SECONDS ?? 86_400);
  const seconds =
    Number.isInteger(parsed) && parsed > 0 ? parsed : 86_400;
  return seconds * 1000;
}
