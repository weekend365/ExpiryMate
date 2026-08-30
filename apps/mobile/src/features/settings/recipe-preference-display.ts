import {
  summarizeRecipePreference,
  type RecipePreference,
} from "@expirymate/shared";

export function resolveRecipePreferenceSummary(input: {
  preference?: RecipePreference | null;
  isError: boolean;
  isLoading: boolean;
}) {
  if (input.preference) {
    return summarizeRecipePreference(input.preference);
  }
  if (input.isError) {
    return { applied: false, text: "맞춤 설정을 확인하러 갈까요?" };
  }
  if (input.isLoading) {
    return { applied: false, text: "살펴보는 중이에요" };
  }
  return summarizeRecipePreference(undefined);
}
