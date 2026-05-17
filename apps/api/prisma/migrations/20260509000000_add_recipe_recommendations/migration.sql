CREATE TABLE "RecipeRecommendation" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL DEFAULT 'demo-user',
  "request" JSONB NOT NULL,
  "inventorySnapshot" JSONB NOT NULL,
  "recommendations" JSONB NOT NULL,
  "aiProvider" TEXT NOT NULL,
  "aiModel" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecipeRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RecipeRecommendation_ownerKey_createdAt_idx"
ON "RecipeRecommendation"("ownerKey", "createdAt");
