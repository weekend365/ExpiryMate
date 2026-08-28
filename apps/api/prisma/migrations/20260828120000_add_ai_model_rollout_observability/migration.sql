ALTER TABLE "InventoryPhotoParseEvent"
ADD COLUMN "reviewItemCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "averageConfidence" DECIMAL(5,4),
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'succeeded',
ADD COLUMN "failureCode" TEXT,
ADD COLUMN "durationMs" INTEGER;

CREATE INDEX "InventoryPhotoParseEvent_aiModel_status_createdAt_idx"
ON "InventoryPhotoParseEvent"("aiModel", "status", "createdAt");

CREATE TABLE "RecipeAiGenerationEvent" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "spaceId" TEXT,
    "recommendationId" TEXT,
    "variant" TEXT NOT NULL,
    "aiProvider" TEXT NOT NULL DEFAULT 'openai',
    "aiModel" TEXT NOT NULL,
    "reasoningEffort" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "failureCode" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "generationAttempts" INTEGER NOT NULL DEFAULT 0,
    "repairApplied" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeAiGenerationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecipeAiGenerationEvent_recommendationId_key"
ON "RecipeAiGenerationEvent"("recommendationId");

CREATE INDEX "RecipeAiGenerationEvent_ownerKey_createdAt_idx"
ON "RecipeAiGenerationEvent"("ownerKey", "createdAt");

CREATE INDEX "RecipeAiGenerationEvent_aiModel_status_createdAt_idx"
ON "RecipeAiGenerationEvent"("aiModel", "status", "createdAt");

CREATE INDEX "RecipeAiGenerationEvent_createdAt_idx"
ON "RecipeAiGenerationEvent"("createdAt");

ALTER TABLE "RecipeAiGenerationEvent"
ADD CONSTRAINT "RecipeAiGenerationEvent_ownerKey_fkey"
FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecipeAiGenerationEvent"
ADD CONSTRAINT "RecipeAiGenerationEvent_spaceId_fkey"
FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecipeAiGenerationEvent"
ADD CONSTRAINT "RecipeAiGenerationEvent_recommendationId_fkey"
FOREIGN KEY ("recommendationId") REFERENCES "RecipeRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "RecipeAiGenerationEvent" (
    "id",
    "ownerKey",
    "spaceId",
    "recommendationId",
    "variant",
    "aiProvider",
    "aiModel",
    "reasoningEffort",
    "promptVersion",
    "status",
    "inputTokens",
    "cachedInputTokens",
    "outputTokens",
    "totalTokens",
    "estimatedCostUsd",
    "generationAttempts",
    "repairApplied",
    "createdAt"
)
SELECT
    'legacy_' || "id",
    "ownerKey",
    "spaceId",
    "id",
    'legacy',
    "aiProvider",
    "aiModel",
    'unspecified',
    "promptVersion",
    'succeeded',
    "inputTokens",
    "cachedInputTokens",
    "outputTokens",
    "totalTokens",
    "estimatedCostUsd",
    "generationAttempts",
    "repairApplied",
    "createdAt"
FROM "RecipeRecommendation";
