import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";
import { ProductCategory, StorageLocation } from "../enums/app-enums";
import { DATE_ONLY_PATTERN, isDateOnlyString } from "../utils/date";

export const recipeMealTypeSchema = z.enum([
  "any",
  "breakfast",
  "lunch",
  "dinner",
  "snack",
]);

export const recipeRecommendationRequestSchema = z.object({
  servings: z.coerce.number().int().min(1).max(6).default(2),
  maxCookingMinutes: z.coerce.number().int().min(5).max(120).default(30),
  mealType: recipeMealTypeSchema.default("any"),
  useExpiringFirst: z.coerce.boolean().default(true),
});

export const recipeInventorySnapshotItemSchema = z.object({
  inventoryItemId: z.string(),
  name: z.string().min(1).max(fieldLimits.recipeIngredientName),
  category: z.nativeEnum(ProductCategory).nullable().optional(),
  quantity: z.number(),
  unit: z.string().max(fieldLimits.unit).nullable().optional(),
  storageLocation: z.nativeEnum(StorageLocation),
  expiryDate: z
    .string()
    .regex(DATE_ONLY_PATTERN)
    .refine(isDateOnlyString, "올바른 날짜를 입력해주세요"),
  daysUntilExpiry: z.number().int(),
});

export const recipeUsedIngredientSchema = z.object({
  inventoryItemId: z.string().nullable(),
  name: z.string().min(1).max(fieldLimits.recipeIngredientName),
});

export const recipeOptionalMissingIngredientSchema = z.object({
  name: z.string().min(1).max(fieldLimits.recipeIngredientName),
  reason: z.string().min(1).max(fieldLimits.recipeText),
});

export const recipeRecommendationDishSchema = z.object({
  title: z.string().min(1).max(fieldLimits.displayName),
  summary: z.string().min(1).max(fieldLimits.recipeText),
  cookingTimeMinutes: z.number().int().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  servings: z.number().int().min(1),
  usedIngredients: z.array(recipeUsedIngredientSchema),
  optionalMissingIngredients: z.array(recipeOptionalMissingIngredientSchema),
  steps: z.array(z.string().min(1).max(fieldLimits.recipeText)).min(1),
  tips: z.array(z.string().max(fieldLimits.recipeText)),
  safetyNote: z.string().max(fieldLimits.recipeText),
});

export const recipeRecommendationsPayloadSchema = z.object({
  recommendations: z.array(recipeRecommendationDishSchema).length(3),
});

export const recipeRecommendationSchema = z.object({
  id: z.string(),
  ownerKey: z.string(),
  createdAt: z.string(),
  request: recipeRecommendationRequestSchema,
  inventorySnapshot: z.array(recipeInventorySnapshotItemSchema),
  recommendations: z.array(recipeRecommendationDishSchema),
});

export type RecipeMealType = z.infer<typeof recipeMealTypeSchema>;
export type RecipeRecommendationRequest = z.infer<
  typeof recipeRecommendationRequestSchema
>;
export type RecipeRecommendationRequestInput = z.input<
  typeof recipeRecommendationRequestSchema
>;
export type RecipeInventorySnapshotItem = z.infer<
  typeof recipeInventorySnapshotItemSchema
>;
export type RecipeRecommendationDish = z.infer<
  typeof recipeRecommendationDishSchema
>;
export type RecipeRecommendation = z.infer<typeof recipeRecommendationSchema>;
