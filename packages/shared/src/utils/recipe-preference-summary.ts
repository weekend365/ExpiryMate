import {
  recipeAllergenLabels,
  recipeDietaryStyleLabels,
} from "../constants/labels";
import type { RecipeAllergen, RecipePreference } from "../schemas/recipes";

export const EMPTY_RECIPE_PREFERENCE_SUMMARY =
  "알레르기·식단을 아직 안 정했어요";

export type RecipePreferenceSummaryInput = Pick<
  RecipePreference,
  "allergens" | "excludedIngredients" | "dietaryStyle"
>;

export type RecipePreferenceSummary = {
  applied: boolean;
  text: string;
};

export function summarizeRecipePreference(
  preference: RecipePreferenceSummaryInput | null | undefined,
): RecipePreferenceSummary {
  if (!preference) {
    return { applied: false, text: EMPTY_RECIPE_PREFERENCE_SUMMARY };
  }

  const parts: string[] = [];
  const allergenPart = formatExcludedTerms(
    preference.allergens.map(allergenSummaryLabel),
  );
  if (allergenPart) {
    parts.push(allergenPart);
  }

  const excludedPart = formatExcludedTerms(preference.excludedIngredients);
  if (excludedPart) parts.push(excludedPart);

  if (preference.dietaryStyle !== "any") {
    parts.push(`${recipeDietaryStyleLabels[preference.dietaryStyle]} 적용 중`);
  }

  if (parts.length === 0) {
    return { applied: false, text: EMPTY_RECIPE_PREFERENCE_SUMMARY };
  }

  return { applied: true, text: parts.join(" · ") };
}

function allergenSummaryLabel(allergen: RecipeAllergen) {
  if (allergen === "shellfish") return "조개류";
  return recipeAllergenLabels[allergen];
}

function formatExcludedTerms(terms: string[]) {
  const labels = terms.map((term) => term.trim()).filter(Boolean);
  if (labels.length === 0) return null;
  if (labels.length === 1) return `${labels[0]} 제외`;
  if (labels.length === 2) return `${labels[0]} · ${labels[1]} 제외`;
  return `${labels[0]} 외 ${labels.length - 1}가지 제외`;
}
