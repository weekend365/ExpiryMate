-- CreateEnum
CREATE TYPE "SubscriptionStore" AS ENUM ('apple_app_store', 'google_play');

-- CreateEnum
CREATE TYPE "SubscriptionEntitlementStatus" AS ENUM ('active', 'grace_period', 'billing_retry', 'paused', 'expired', 'revoked', 'unknown');

-- CreateTable
CREATE TABLE "SubscriptionEntitlement" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "store" "SubscriptionStore" NOT NULL,
    "productId" TEXT NOT NULL,
    "originalTransactionId" TEXT,
    "transactionId" TEXT,
    "purchaseTokenHash" TEXT,
    "status" "SubscriptionEntitlementStatus" NOT NULL DEFAULT 'unknown',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "willRenew" BOOLEAN,
    "expiresAt" TIMESTAMP(3),
    "environment" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawVerification" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubscriptionEntitlement_ownerKey_isActive_expiresAt_idx" ON "SubscriptionEntitlement"("ownerKey", "isActive", "expiresAt");

-- CreateIndex
CREATE INDEX "SubscriptionEntitlement_store_productId_idx" ON "SubscriptionEntitlement"("store", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEntitlement_store_originalTransactionId_key" ON "SubscriptionEntitlement"("store", "originalTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEntitlement_store_purchaseTokenHash_key" ON "SubscriptionEntitlement"("store", "purchaseTokenHash");

-- AddForeignKey
ALTER TABLE "SubscriptionEntitlement" ADD CONSTRAINT "SubscriptionEntitlement_ownerKey_fkey" FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
