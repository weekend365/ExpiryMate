CREATE TYPE "MonetizationRevenueEventKind" AS ENUM (
  'subscription_purchase',
  'subscription_renewal',
  'subscription_refund',
  'subscription_cancelled',
  'credit_purchase',
  'credit_refund',
  'rewarded_ad_impression'
);

CREATE TABLE "MonetizationRevenueEvent" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT,
  "spaceId" TEXT,
  "kind" "MonetizationRevenueEventKind" NOT NULL,
  "source" TEXT NOT NULL,
  "store" "SubscriptionStore",
  "productId" TEXT,
  "billingPeriod" "SubscriptionBillingPeriod",
  "externalKeyHash" TEXT NOT NULL,
  "estimatedNetRevenueKrw" DECIMAL(14,2) NOT NULL,
  "estimateConfigured" BOOLEAN NOT NULL DEFAULT false,
  "properties" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonetizationRevenueEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MonetizationRevenueEvent_externalKeyHash_key"
  ON "MonetizationRevenueEvent"("externalKeyHash");
CREATE INDEX "MonetizationRevenueEvent_kind_occurredAt_idx"
  ON "MonetizationRevenueEvent"("kind", "occurredAt");
CREATE INDEX "MonetizationRevenueEvent_source_occurredAt_idx"
  ON "MonetizationRevenueEvent"("source", "occurredAt");
CREATE INDEX "MonetizationRevenueEvent_ownerKey_occurredAt_idx"
  ON "MonetizationRevenueEvent"("ownerKey", "occurredAt");
CREATE INDEX "MonetizationRevenueEvent_spaceId_occurredAt_idx"
  ON "MonetizationRevenueEvent"("spaceId", "occurredAt");

ALTER TABLE "MonetizationRevenueEvent"
  ADD CONSTRAINT "MonetizationRevenueEvent_ownerKey_fkey"
  FOREIGN KEY ("ownerKey") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonetizationRevenueEvent"
  ADD CONSTRAINT "MonetizationRevenueEvent_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
