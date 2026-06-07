ALTER TABLE "RecipeRecommendation"
ADD COLUMN "requestCacheKey" TEXT,
ADD COLUMN "inputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "outputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "estimatedCostUsd" DECIMAL(10, 6) NOT NULL DEFAULT 0;

CREATE INDEX "RecipeRecommendation_ownerKey_requestCacheKey_createdAt_idx"
ON "RecipeRecommendation"("ownerKey", "requestCacheKey", "createdAt");
