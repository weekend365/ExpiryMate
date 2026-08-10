ALTER TYPE "RecommendationUsageSource" ADD VALUE 'paid_credit';

CREATE TYPE "RecommendationCreditPurchaseStatus" AS ENUM ('active', 'revoked');

CREATE TABLE "RecommendationCreditPurchase" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "store" "SubscriptionStore" NOT NULL,
    "productId" TEXT NOT NULL,
    "transactionId" TEXT,
    "purchaseTokenHash" TEXT,
    "orderId" TEXT,
    "creditsGranted" INTEGER NOT NULL,
    "status" "RecommendationCreditPurchaseStatus" NOT NULL DEFAULT 'active',
    "environment" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawVerification" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecommendationCreditPurchase_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RecommendationUsageEvent" ADD COLUMN "paidCreditPurchaseId" TEXT;

CREATE UNIQUE INDEX "RecommendationCreditPurchase_store_transactionId_key" ON "RecommendationCreditPurchase"("store", "transactionId");
CREATE UNIQUE INDEX "RecommendationCreditPurchase_store_purchaseTokenHash_key" ON "RecommendationCreditPurchase"("store", "purchaseTokenHash");
CREATE INDEX "RecommendationCreditPurchase_ownerKey_status_createdAt_idx" ON "RecommendationCreditPurchase"("ownerKey", "status", "createdAt");
CREATE INDEX "RecommendationCreditPurchase_store_productId_createdAt_idx" ON "RecommendationCreditPurchase"("store", "productId", "createdAt");
CREATE INDEX "RecommendationUsageEvent_paidCreditPurchaseId_status_idx" ON "RecommendationUsageEvent"("paidCreditPurchaseId", "status");

ALTER TABLE "RecommendationCreditPurchase" ADD CONSTRAINT "RecommendationCreditPurchase_ownerKey_fkey" FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationUsageEvent" ADD CONSTRAINT "RecommendationUsageEvent_paidCreditPurchaseId_fkey" FOREIGN KEY ("paidCreditPurchaseId") REFERENCES "RecommendationCreditPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
