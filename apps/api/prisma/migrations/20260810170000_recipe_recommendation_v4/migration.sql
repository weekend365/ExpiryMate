CREATE TYPE "RecipeAllergen" AS ENUM (
  'egg', 'milk', 'buckwheat', 'peanut', 'soybean', 'wheat', 'mackerel',
  'crab', 'shrimp', 'pork', 'peach', 'tomato', 'sulfites', 'walnut',
  'chicken', 'beef', 'squid', 'shellfish', 'pine_nut'
);

CREATE TYPE "RecipeDietaryStyle" AS ENUM ('any', 'vegetarian', 'vegan', 'pescatarian');
CREATE TYPE "RecipeSpiceLevel" AS ENUM ('any', 'none', 'mild', 'medium', 'hot');
CREATE TYPE "RecipeEquipment" AS ENUM ('stovetop', 'microwave', 'oven', 'air_fryer');

ALTER TABLE "RecipeRecommendation"
  ADD COLUMN "generationAttempts" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "repairApplied" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "selectionVersion" TEXT NOT NULL DEFAULT 'recipe-selection-v1';

CREATE TABLE "RecipePreference" (
  "ownerKey" TEXT NOT NULL,
  "allergens" "RecipeAllergen"[] NOT NULL DEFAULT ARRAY[]::"RecipeAllergen"[],
  "excludedIngredients" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "dietaryStyle" "RecipeDietaryStyle" NOT NULL DEFAULT 'any',
  "maxSpiceLevel" "RecipeSpiceLevel" NOT NULL DEFAULT 'any',
  "availableEquipment" "RecipeEquipment"[] NOT NULL DEFAULT ARRAY['stovetop']::"RecipeEquipment"[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecipePreference_pkey" PRIMARY KEY ("ownerKey"),
  CONSTRAINT "RecipePreference_ownerKey_fkey" FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RecipeDishEngagement" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL,
  "recommendationId" TEXT NOT NULL,
  "dishIndex" INTEGER NOT NULL,
  "viewedAt" TIMESTAMP(3),
  "cookingStartedAt" TIMESTAMP(3),
  "cookingCompletedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "favoritedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RecipeDishEngagement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecipeDishEngagement_ownerKey_fkey" FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RecipeDishEngagement_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "RecipeRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RecipeDishEngagement_ownerKey_recommendationId_dishIndex_key"
  ON "RecipeDishEngagement"("ownerKey", "recommendationId", "dishIndex");
CREATE INDEX "RecipeDishEngagement_ownerKey_updatedAt_idx"
  ON "RecipeDishEngagement"("ownerKey", "updatedAt");
CREATE INDEX "RecipeDishEngagement_ownerKey_cookingCompletedAt_idx"
  ON "RecipeDishEngagement"("ownerKey", "cookingCompletedAt");
CREATE INDEX "RecipeDishEngagement_ownerKey_dismissedAt_idx"
  ON "RecipeDishEngagement"("ownerKey", "dismissedAt");
