-- Historical telemetry lacks cache-write usage: retain NULL and legacy status.
ALTER TABLE "RecipeRecommendation"
  ADD COLUMN "cacheWriteInputTokens" INTEGER,
  ADD COLUMN "reasoningTokens" INTEGER,
  ADD COLUMN "usageStatus" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "pricingVersion" TEXT NOT NULL DEFAULT 'legacy';

ALTER TABLE "RecipeAiGenerationEvent"
  ADD COLUMN "cacheWriteInputTokens" INTEGER,
  ADD COLUMN "reasoningTokens" INTEGER,
  ADD COLUMN "usageStatus" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "pricingVersion" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "usageSource" TEXT,
  ADD COLUMN "requestClass" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "attempts" JSONB;

ALTER TABLE "InventoryPhotoParseEvent"
  ADD COLUMN "cacheWriteInputTokens" INTEGER,
  ADD COLUMN "reasoningTokens" INTEGER,
  ADD COLUMN "usageStatus" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "pricingVersion" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "variant" TEXT NOT NULL DEFAULT 'control',
  ADD COLUMN "generationAttempts" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "attempts" JSONB;

ALTER TABLE "RecipeRecommendation" ADD CONSTRAINT "RecipeRecommendation_ai_usage_valid"
  CHECK ("usageStatus" IN ('reported', 'estimated', 'unavailable', 'partial', 'legacy')
    AND ("cacheWriteInputTokens" IS NULL OR "cacheWriteInputTokens" >= 0)
    AND ("reasoningTokens" IS NULL OR "reasoningTokens" >= 0));
ALTER TABLE "RecipeAiGenerationEvent" ADD CONSTRAINT "RecipeAiGenerationEvent_ai_usage_valid"
  CHECK ("usageStatus" IN ('reported', 'estimated', 'unavailable', 'partial', 'legacy')
    AND ("cacheWriteInputTokens" IS NULL OR "cacheWriteInputTokens" >= 0)
    AND ("reasoningTokens" IS NULL OR "reasoningTokens" >= 0));
ALTER TABLE "InventoryPhotoParseEvent" ADD CONSTRAINT "InventoryPhotoParseEvent_ai_usage_valid"
  CHECK ("usageStatus" IN ('reported', 'estimated', 'unavailable', 'partial', 'legacy')
    AND ("cacheWriteInputTokens" IS NULL OR "cacheWriteInputTokens" >= 0)
    AND ("reasoningTokens" IS NULL OR "reasoningTokens" >= 0));
