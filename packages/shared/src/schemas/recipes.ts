import { z } from "zod";
import { ProductCategory, StorageLocation } from "../enums/app-enums";

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
  name: z.string(),
  category: z.nativeEnum(ProductCategory).nullable().optional(),
  quantity: z.number(),
  unit: z.string().nullable().optional(),
  storageLocation: z.nativeEnum(StorageLocation),
  expiryDate: z.string(),
  daysUntilExpiry: z.number().int(),
});

export const recipeUsedIngredientSchema = z.object({
  inventoryItemId: z.string().nullable(),
  name: z.string(),
});

export const recipeOptionalMissingIngredientSchema = z.object({
  name: z.string(),
  reason: z.string(),
});

export const recipeRecommendationDishSchema = z.object({
  title: z.string(),
  summary: z.string(),
  cookingTimeMinutes: z.number().int().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  servings: z.number().int().min(1),
  usedIngredients: z.array(recipeUsedIngredientSchema),
  optionalMissingIngredients: z.array(recipeOptionalMissingIngredientSchema),
  steps: z.array(z.string()).min(1),
  tips: z.array(z.string()),
  safetyNote: z.string(),
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
