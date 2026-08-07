ALTER TYPE "RecommendationUsageSource" ADD VALUE 'barcode_contribution';

CREATE TABLE "BarcodeRewardCredit" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL,
  "productMasterId" TEXT NOT NULL,
  "earnedDay" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BarcodeRewardCredit_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RecommendationUsageEvent"
  ADD COLUMN "barcodeRewardCreditId" TEXT;

CREATE UNIQUE INDEX "BarcodeRewardCredit_productMasterId_key"
  ON "BarcodeRewardCredit"("productMasterId");
CREATE INDEX "BarcodeRewardCredit_ownerKey_earnedDay_idx"
  ON "BarcodeRewardCredit"("ownerKey", "earnedDay");
CREATE INDEX "BarcodeRewardCredit_ownerKey_createdAt_idx"
  ON "BarcodeRewardCredit"("ownerKey", "createdAt");
CREATE UNIQUE INDEX "RecommendationUsageEvent_barcodeRewardCreditId_key"
  ON "RecommendationUsageEvent"("barcodeRewardCreditId");

ALTER TABLE "BarcodeRewardCredit"
  ADD CONSTRAINT "BarcodeRewardCredit_ownerKey_fkey"
  FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BarcodeRewardCredit"
  ADD CONSTRAINT "BarcodeRewardCredit_productMasterId_fkey"
  FOREIGN KEY ("productMasterId") REFERENCES "ProductMaster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecommendationUsageEvent"
  ADD CONSTRAINT "RecommendationUsageEvent_barcodeRewardCreditId_fkey"
  FOREIGN KEY ("barcodeRewardCreditId") REFERENCES "BarcodeRewardCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
