import {
  ProductCategory,
  type RecipeAllergen,
  type RecipeDietaryStyle,
  type RecipePreference,
  type RecipeRecommendationRequest,
} from "@expirymate/shared";

export const RECIPE_SELECTION_VERSION = "recipe-selection-v2";
export const MAX_RECIPE_INGREDIENTS = 30;

export interface RecipeRankingCandidate {
  id: string;
  displayName: string;
  category: ProductCategory | null;
  unitCode: string;
  daysUntilExpiry: number;
  updatedAt: Date;
}

const allergenTerms: Record<RecipeAllergen, string[]> = {
  egg: ["계란", "달걀", "난류", "egg"],
  milk: ["우유", "유제품", "치즈", "버터", "요거트", "크림", "milk", "cheese"],
  buckwheat: ["메밀", "buckwheat"],
  peanut: ["땅콩", "peanut"],
  soybean: ["대두", "콩", "두부", "두유", "된장", "간장", "soy"],
  wheat: ["밀", "밀가루", "빵", "면", "파스타", "wheat", "flour"],
  mackerel: ["고등어", "mackerel"],
  crab: ["게", "꽃게", "대게", "crab"],
  shrimp: ["새우", "shrimp", "prawn"],
  pork: ["돼지고기", "돼지", "삼겹살", "베이컨", "햄", "소시지", "pork"],
  peach: ["복숭아", "peach"],
  tomato: ["토마토", "tomato"],
  sulfites: ["아황산", "sulfite"],
  walnut: ["호두", "walnut"],
  chicken: ["닭고기", "닭", "치킨", "chicken"],
  beef: ["쇠고기", "소고기", "beef"],
  squid: ["오징어", "squid"],
  shellfish: ["조개", "굴", "전복", "홍합", "shellfish", "oyster", "mussel"],
  pine_nut: ["잣", "pine nut"],
};

const meatTerms = [
  "돼지", "삼겹살", "베이컨", "햄", "소시지", "소고기", "쇠고기", "닭", "치킨",
  "오리", "양고기", "육수", "pork", "beef", "chicken", "duck", "lamb",
];
const seafoodTerms = [
  "생선", "고등어", "연어", "참치", "멸치", "새우", "게", "오징어", "조개", "굴",
  "전복", "홍합", "fish", "salmon", "tuna", "shrimp", "crab", "squid", "shellfish",
];
const animalProductTerms = [
  ...meatTerms,
  ...seafoodTerms,
  ...allergenTerms.egg,
  ...allergenTerms.milk,
];

export function normalizeRecipeTerm(value: string) {
  return value.toLocaleLowerCase("ko-KR").replace(/[^0-9a-z가-힣]/g, "");
}

export function getBlockedRecipeTerms(
  preference: Pick<RecipePreference, "allergens" | "excludedIngredients" | "dietaryStyle">,
) {
  const values = [
    ...preference.allergens.flatMap((allergen) => allergenTerms[allergen]),
    ...preference.excludedIngredients,
    ...dietaryBlockedTerms(preference.dietaryStyle),
  ];

  return [...new Set(values.map(normalizeRecipeTerm).filter(Boolean))];
}

export function isRecipeTextBlocked(
  value: string,
  preference: Pick<RecipePreference, "allergens" | "excludedIngredients" | "dietaryStyle">,
) {
  const normalized = normalizeRecipeTerm(value);
  return getBlockedRecipeTerms(preference).some((term) => normalized.includes(term));
}

export function isCandidateBlocked(
  candidate: Pick<RecipeRankingCandidate, "displayName" | "category">,
  preference: Pick<RecipePreference, "allergens" | "excludedIngredients" | "dietaryStyle">,
) {
  if (isRecipeTextBlocked(candidate.displayName, preference)) {
    return true;
  }

  if (candidate.category === ProductCategory.EGG && preference.allergens.includes("egg")) {
    return true;
  }
  if (candidate.category === ProductCategory.DAIRY && preference.allergens.includes("milk")) {
    return true;
  }
  if (candidate.category === ProductCategory.TOFU && preference.allergens.includes("soybean")) {
    return true;
  }

  if (preference.dietaryStyle === "vegan") {
    return candidate.category === ProductCategory.EGG || candidate.category === ProductCategory.DAIRY;
  }

  return false;
}

export function rankRecipeCandidates<T extends RecipeRankingCandidate>(
  candidates: T[],
  request: Pick<RecipeRecommendationRequest, "useExpiringFirst">,
  recentUsage: ReadonlyMap<string, number>,
) {
  const scored = candidates.map((candidate) => ({
    candidate,
    score:
      urgencyScore(candidate.daysUntilExpiry) *
        (request.useExpiringFirst ? 1 : 0.25) +
      utilityScore(candidate.category) -
      Math.min(
        45,
        15 *
          Math.max(
            recentUsage.get(candidate.id) ?? 0,
            recentUsage.get(normalizeRecipeTerm(candidate.displayName)) ?? 0,
          ),
      ),
  }));

  scored.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    if (left.candidate.daysUntilExpiry !== right.candidate.daysUntilExpiry) {
      return left.candidate.daysUntilExpiry - right.candidate.daysUntilExpiry;
    }
    const updatedDifference =
      right.candidate.updatedAt.getTime() - left.candidate.updatedAt.getTime();
    if (updatedDifference !== 0) return updatedDifference;
    return left.candidate.id.localeCompare(right.candidate.id);
  });

  const selected: T[] = [];
  const selectedIds = new Set<string>();
  const selectedGroups = new Set<string>();
  const add = (candidate: T, allowDuplicateGroup = false) => {
    if (selectedIds.has(candidate.id)) return false;
    const group = `${normalizeRecipeTerm(candidate.displayName)}:${candidate.unitCode}`;
    if (!allowDuplicateGroup && selectedGroups.has(group)) return false;
    selected.push(candidate);
    selectedIds.add(candidate.id);
    selectedGroups.add(group);
    return true;
  };
  const fill = (items: typeof scored, target: number) => {
    for (const item of items) {
      if (selected.length >= target) break;
      add(item.candidate);
    }
  };

  fill(scored, 15);
  fill(scored.filter(({ candidate }) => isMainIngredient(candidate.category)), 25);
  fill(scored.filter(({ candidate }) => isSupportingIngredient(candidate.category)), 30);
  fill(scored, 30);

  if (selected.length < Math.min(MAX_RECIPE_INGREDIENTS, candidates.length)) {
    for (const item of scored) {
      if (selected.length >= MAX_RECIPE_INGREDIENTS) break;
      add(item.candidate, true);
    }
  }

  return selected;
}

function urgencyScore(days: number) {
  if (days <= 1) return 100;
  if (days <= 3) return 80;
  if (days <= 7) return 60;
  if (days <= 14) return 35;
  if (days <= 30) return 15;
  return 0;
}

function utilityScore(category: ProductCategory | null) {
  if (
    category === ProductCategory.EGG ||
    category === ProductCategory.TOFU ||
    category === ProductCategory.FROZEN_FOOD ||
    category === ProductCategory.INSTANT_FOOD
  ) {
    return 25;
  }
  if (category === ProductCategory.PRODUCE || category === ProductCategory.DAIRY) return 20;
  if (category === ProductCategory.BEVERAGE) return 5;
  if (category === ProductCategory.SEASONING) return 0;
  if (category === ProductCategory.SNACK) return -10;
  return category === null ? 5 : 10;
}

function isMainIngredient(category: ProductCategory | null) {
  return (
    category === null ||
    category === ProductCategory.EGG ||
    category === ProductCategory.TOFU ||
    category === ProductCategory.PRODUCE ||
    category === ProductCategory.DAIRY ||
    category === ProductCategory.FROZEN_FOOD ||
    category === ProductCategory.INSTANT_FOOD
  );
}

function isSupportingIngredient(category: ProductCategory | null) {
  return (
    category === ProductCategory.SEASONING ||
    category === ProductCategory.BEVERAGE ||
    category === ProductCategory.SNACK
  );
}

function dietaryBlockedTerms(style: RecipeDietaryStyle) {
  if (style === "vegan") return animalProductTerms;
  if (style === "vegetarian") return [...meatTerms, ...seafoodTerms];
  if (style === "pescatarian") return meatTerms;
  return [];
}
