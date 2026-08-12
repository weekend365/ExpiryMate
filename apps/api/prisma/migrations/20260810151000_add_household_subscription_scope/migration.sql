ALTER TABLE "RecommendationUsageEvent" ADD COLUMN "spaceId" TEXT;
ALTER TABLE "RecommendationUsageEvent" ADD COLUMN "subscriptionEntitlementId" TEXT;
ALTER TABLE "SubscriptionEntitlement" ADD COLUMN "spaceId" TEXT;

UPDATE "RecommendationUsageEvent" AS usage
SET "spaceId" = recommendation."spaceId"
FROM "RecipeRecommendation" AS recommendation
WHERE usage."recommendationId" = recommendation.id
  AND recommendation."spaceId" IS NOT NULL;

CREATE INDEX "RecommendationUsageEvent_spaceId_usageDay_status_idx"
  ON "RecommendationUsageEvent"("spaceId", "usageDay", "status");
CREATE INDEX "RecommendationUsageEvent_subscriptionEntitlementId_status_idx"
  ON "RecommendationUsageEvent"("subscriptionEntitlementId", "status");
CREATE INDEX "SubscriptionEntitlement_spaceId_isActive_expiresAt_idx"
  ON "SubscriptionEntitlement"("spaceId", "isActive", "expiresAt");

ALTER TABLE "RecommendationUsageEvent"
  ADD CONSTRAINT "RecommendationUsageEvent_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecommendationUsageEvent"
  ADD CONSTRAINT "RecommendationUsageEvent_subscriptionEntitlementId_fkey"
  FOREIGN KEY ("subscriptionEntitlementId") REFERENCES "SubscriptionEntitlement"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlement"
  ADD CONSTRAINT "SubscriptionEntitlement_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
