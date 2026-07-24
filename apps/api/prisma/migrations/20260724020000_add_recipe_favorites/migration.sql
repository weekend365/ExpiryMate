CREATE TABLE "RecipeFavorite" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL,
  "sourceRecommendationId" TEXT NOT NULL,
  "sourceDishIndex" INTEGER NOT NULL,
  "dishSnapshot" JSONB NOT NULL,
  "inventorySnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RecipeFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeFavorite_ownerKey_sourceRecommendationId_sourceDishIndex_key"
ON "RecipeFavorite"("ownerKey", "sourceRecommendationId", "sourceDishIndex");

CREATE INDEX "RecipeFavorite_ownerKey_createdAt_idx"
ON "RecipeFavorite"("ownerKey", "createdAt");

ALTER TABLE "RecipeFavorite"
ADD CONSTRAINT "RecipeFavorite_ownerKey_fkey"
FOREIGN KEY ("ownerKey") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
