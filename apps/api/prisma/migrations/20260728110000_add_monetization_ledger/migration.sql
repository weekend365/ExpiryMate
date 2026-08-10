CREATE TYPE "SubscriptionBillingPeriod" AS ENUM ('monthly', 'yearly');
CREATE TYPE "RecommendationUsageSource" AS ENUM ('free', 'rewarded_ad', 'subscription');
CREATE TYPE "RecommendationUsageStatus" AS ENUM ('reserved', 'completed', 'released');
CREATE TYPE "RewardedAdPlatform" AS ENUM ('ios', 'android');
CREATE TYPE "RewardedAdSessionStatus" AS ENUM ('pending', 'verified', 'cancelled', 'expired');

ALTER TABLE "SubscriptionEntitlement"
  ADD COLUMN "planCode" TEXT,
  ADD COLUMN "billingPeriod" "SubscriptionBillingPeriod",
  ADD COLUMN "basePlanId" TEXT;

CREATE TABLE "RewardedAdSession" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL,
  "platform" "RewardedAdPlatform" NOT NULL,
  "status" "RewardedAdSessionStatus" NOT NULL DEFAULT 'pending',
  "adUnitId" TEXT NOT NULL,
  "transactionId" TEXT,
  "showExpiresAt" TIMESTAMP(3) NOT NULL,
  "verificationExpiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RewardedAdSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationUsageEvent" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL,
  "usageDay" TIMESTAMP(3) NOT NULL,
  "source" "RecommendationUsageSource" NOT NULL,
  "status" "RecommendationUsageStatus" NOT NULL DEFAULT 'reserved',
  "idempotencyKey" TEXT NOT NULL,
  "recommendationId" TEXT,
  "rewardedAdSessionId" TEXT,
  "releaseReason" TEXT,
  "completedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecommendationUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RewardedAdSession_transactionId_key" ON "RewardedAdSession"("transactionId");
CREATE INDEX "RewardedAdSession_ownerKey_status_createdAt_idx" ON "RewardedAdSession"("ownerKey", "status", "createdAt");
CREATE INDEX "RewardedAdSession_status_verificationExpiresAt_idx" ON "RewardedAdSession"("status", "verificationExpiresAt");
CREATE UNIQUE INDEX "RecommendationUsageEvent_recommendationId_key" ON "RecommendationUsageEvent"("recommendationId");
CREATE UNIQUE INDEX "RecommendationUsageEvent_rewardedAdSessionId_key" ON "RecommendationUsageEvent"("rewardedAdSessionId");
CREATE UNIQUE INDEX "RecommendationUsageEvent_ownerKey_idempotencyKey_key" ON "RecommendationUsageEvent"("ownerKey", "idempotencyKey");
CREATE INDEX "RecommendationUsageEvent_ownerKey_usageDay_status_idx" ON "RecommendationUsageEvent"("ownerKey", "usageDay", "status");
CREATE INDEX "RecommendationUsageEvent_source_usageDay_status_idx" ON "RecommendationUsageEvent"("source", "usageDay", "status");

ALTER TABLE "RewardedAdSession"
  ADD CONSTRAINT "RewardedAdSession_ownerKey_fkey"
  FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecommendationUsageEvent"
  ADD CONSTRAINT "RecommendationUsageEvent_ownerKey_fkey"
  FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecommendationUsageEvent"
  ADD CONSTRAINT "RecommendationUsageEvent_recommendationId_fkey"
  FOREIGN KEY ("recommendationId") REFERENCES "RecipeRecommendation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecommendationUsageEvent"
  ADD CONSTRAINT "RecommendationUsageEvent_rewardedAdSessionId_fkey"
  FOREIGN KEY ("rewardedAdSessionId") REFERENCES "RewardedAdSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
