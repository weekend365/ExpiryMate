import { z } from "zod";
import { fieldLimits } from "../constants/field-limits";
import { ProductCategory, UnitCode } from "../enums/app-enums";
import { DATE_ONLY_PATTERN, isDateOnlyString } from "../utils/date";
import { storageLocationKeySchema } from "./inventory";

/** Maximum server retention for a recommendation with no saved favorite dish. */
export const UNFAVORITED_RECIPE_RECOMMENDATION_RETENTION_DAYS = 90;

export const recipeMealTypeSchema = z.enum([
  "any",
  "breakfast",
  "lunch",
  "dinner",
  "snack",
]);

export const recipeStrategySchema = z.enum([
  "expiring_first",
  "balanced",
  "minimal_extra",
  "quick_novel",
]);

export const recipeAllergenSchema = z.enum([
  "egg",
  "milk",
  "buckwheat",
  "peanut",
  "soybean",
  "wheat",
  "mackerel",
  "crab",
  "shrimp",
  "pork",
  "peach",
  "tomato",
  "sulfites",
  "walnut",
  "chicken",
  "beef",
  "squid",
  "shellfish",
  "pine_nut",
]);

export const recipeDietaryStyleSchema = z.enum([
  "any",
  "vegetarian",
  "vegan",
  "pescatarian",
]);

export const recipeSpiceLevelSchema = z.enum([
  "any",
  "none",
  "mild",
  "medium",
  "hot",
]);

export const recipeGeneratedSpiceLevelSchema = recipeSpiceLevelSchema.exclude([
  "any",
]);

export const recipeEquipmentSchema = z.enum([
  "stovetop",
  "microwave",
  "oven",
  "air_fryer",
]);

const excludedIngredientSchema = z.string().trim().min(1).max(40);

const recipePreferenceShape = {
  allergens: z.array(recipeAllergenSchema).max(19),
  excludedIngredients: z.array(excludedIngredientSchema).max(20),
  dietaryStyle: recipeDietaryStyleSchema,
  maxSpiceLevel: recipeSpiceLevelSchema,
  availableEquipment: z.array(recipeEquipmentSchema).min(1).max(4),
};

export const updateRecipePreferenceSchema = z
  .object(recipePreferenceShape)
  .transform((value) => ({
    ...value,
    allergens: [...new Set(value.allergens)],
    excludedIngredients: Array.from(
      new Map(
        value.excludedIngredients.map((item) => [item.toLocaleLowerCase("ko-KR"), item]),
      ).values(),
    ),
    availableEquipment: [...new Set(value.availableEquipment)],
  }));

export const recipePreferenceSchema = z.object({
  ...recipePreferenceShape,
  updatedAt: z.string(),
});

export const recipeEngagementActionSchema = z.enum([
  "view",
  "cooking_started",
  "cooking_completed",
  "dismiss",
  "undo_dismiss",
]);

export const updateRecipeEngagementSchema = z.object({
  action: recipeEngagementActionSchema,
});

export const recipeDishEngagementSchema = z.object({
  recommendationId: z.string(),
  dishIndex: z.number().int().nonnegative(),
  viewedAt: z.string().nullable(),
  cookingStartedAt: z.string().nullable(),
  cookingCompletedAt: z.string().nullable(),
  dismissedAt: z.string().nullable(),
  favoritedAt: z.string().nullable(),
  updatedAt: z.string(),
});

export const recipeRecommendationRequestSchema = z.object({
  servings: z.coerce.number().int().min(1).max(6).default(2),
  maxCookingMinutes: z.coerce.number().int().min(5).max(120).default(30),
  mealType: recipeMealTypeSchema.default("any"),
  useExpiringFirst: z.coerce.boolean().default(true),
  selectedInventoryItemIds: z
    .array(z.string().min(1))
    .min(1)
    .max(30)
    .optional(),
});

export const recipeInventorySnapshotItemSchema = z.object({
  inventoryItemId: z.string(),
  name: z.string().min(1).max(fieldLimits.recipeIngredientName),
  category: z.nativeEnum(ProductCategory).nullable().optional(),
  quantity: z.number(),
  unit: z.string().max(fieldLimits.unit).nullable().optional(),
  quantityBase: z.number().int().min(0).optional(),
  unitCode: z.nativeEnum(UnitCode).optional(),
  inferredAllergens: z.array(recipeAllergenSchema).optional(),
  storageLocation: storageLocationKeySchema,
  expiryDate: z
    .string()
    .regex(DATE_ONLY_PATTERN)
    .refine(isDateOnlyString, "올바른 날짜를 입력해주세요")
    .nullable(),
  daysUntilExpiry: z.number().int().nullable(),
});

const recipeUsedIngredientBaseSchema = z.object({
  inventoryItemId: z.string().nullable(),
  name: z.string().min(1).max(fieldLimits.recipeIngredientName),
});

export const recipeUsedIngredientSchema = recipeUsedIngredientBaseSchema.extend({
  /** Canonical integer amount for new recommendations; optional for stored legacy JSON. */
  amount: z.number().int().positive().optional(),
  unitCode: z.nativeEnum(UnitCode).optional(),
});

export const generatedRecipeUsedIngredientSchema =
  recipeUsedIngredientBaseSchema.extend({
    amount: z.number().int().positive(),
    unitCode: z.nativeEnum(UnitCode),
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
  /** Derived timer duration for each step; omitted by stored legacy recommendations. */
  stepTimerSeconds: z
    .array(z.number().int().min(1).max(120 * 60).nullable())
    .optional(),
  tips: z.array(z.string().max(fieldLimits.recipeText)),
  safetyNote: z.string().max(fieldLimits.recipeText),
  spiceLevel: recipeGeneratedSpiceLevelSchema.optional(),
  requiredEquipment: z.array(recipeEquipmentSchema).optional(),
  /** Optional for stored legacy recommendations; required for new generations. */
  mealType: recipeMealTypeSchema.exclude(["any"]).optional(),
  strategy: recipeStrategySchema.optional(),
});

export const recipeRecommendationsPayloadSchema = z.object({
  recommendations: z.array(recipeRecommendationDishSchema).length(3),
});

export const generatedRecipeRecommendationsPayloadSchema = z.object({
  recommendations: z
    .array(
      recipeRecommendationDishSchema.omit({ stepTimerSeconds: true }).extend({
        usedIngredients: z.array(generatedRecipeUsedIngredientSchema),
        optionalMissingIngredients: z
          .array(recipeOptionalMissingIngredientSchema)
          .max(2),
        steps: z
          .array(z.string().trim().min(1).max(fieldLimits.recipeText))
          .min(4)
          .max(8),
        tips: z
          .array(z.string().trim().min(1).max(fieldLimits.recipeText))
          .min(1)
          .max(3),
        safetyNote: z.string().trim().min(6).max(fieldLimits.recipeText),
        spiceLevel: recipeGeneratedSpiceLevelSchema,
        requiredEquipment: z.array(recipeEquipmentSchema).min(1),
        mealType: recipeMealTypeSchema.exclude(["any"]),
        strategy: recipeStrategySchema,
      }),
    )
    .length(3),
});

export const recipeRecommendationSchema = z.object({
  id: z.string(),
  ownerKey: z.string(),
  spaceId: z.string().nullable().optional(),
  createdAt: z.string(),
  request: recipeRecommendationRequestSchema,
  inventorySnapshot: z.array(recipeInventorySnapshotItemSchema),
  recommendations: z.array(recipeRecommendationDishSchema),
});

export const recipeFavoriteSchema = z.object({
  id: z.string(),
  ownerKey: z.string(),
  sourceRecommendationId: z.string(),
  sourceDishIndex: z.number().int().nonnegative(),
  dish: recipeRecommendationDishSchema,
  inventorySnapshot: z.array(recipeInventorySnapshotItemSchema),
  createdAt: z.string(),
});

export const deleteRecipeFavoriteResponseSchema = z.object({
  ok: z.literal(true),
});

export type RecipeMealType = z.infer<typeof recipeMealTypeSchema>;
export type RecipeStrategy = z.infer<typeof recipeStrategySchema>;
export type RecipeAllergen = z.infer<typeof recipeAllergenSchema>;
export type RecipeDietaryStyle = z.infer<typeof recipeDietaryStyleSchema>;
export type RecipeSpiceLevel = z.infer<typeof recipeSpiceLevelSchema>;
export type RecipeGeneratedSpiceLevel = z.infer<
  typeof recipeGeneratedSpiceLevelSchema
>;
export type RecipeEquipment = z.infer<typeof recipeEquipmentSchema>;
export type RecipePreference = z.infer<typeof recipePreferenceSchema>;
export type UpdateRecipePreference = z.infer<
  typeof updateRecipePreferenceSchema
>;
export type RecipeEngagementAction = z.infer<
  typeof recipeEngagementActionSchema
>;
export type UpdateRecipeEngagement = z.infer<
  typeof updateRecipeEngagementSchema
>;
export type RecipeDishEngagement = z.infer<
  typeof recipeDishEngagementSchema
>;
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
export type RecipeFavorite = z.infer<typeof recipeFavoriteSchema>;
export type DeleteRecipeFavoriteResponse = z.infer<
  typeof deleteRecipeFavoriteResponseSchema
>;
