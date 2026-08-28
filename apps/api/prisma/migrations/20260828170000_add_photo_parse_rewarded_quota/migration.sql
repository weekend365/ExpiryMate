-- CreateEnum
CREATE TYPE "RewardedAdPurpose" AS ENUM ('recipe_generation', 'inventory_photo_parse');

-- CreateEnum
CREATE TYPE "InventoryPhotoParseUsageSource" AS ENUM ('free', 'rewarded_ad');

-- AlterTable
ALTER TABLE "RewardedAdSession"
ADD COLUMN "purpose" "RewardedAdPurpose" NOT NULL DEFAULT 'recipe_generation';

-- AlterTable
ALTER TABLE "InventoryPhotoParseEvent"
ADD COLUMN "reservedCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
ADD COLUMN "usageDay" DATE,
ADD COLUMN "usageSource" "InventoryPhotoParseUsageSource",
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "rewardedAdSessionId" TEXT,
ADD COLUMN "resultPayload" JSONB,
ADD COLUMN "resultExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPhotoParseEvent_ownerKey_idempotencyKey_key"
ON "InventoryPhotoParseEvent"("ownerKey", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryPhotoParseEvent_rewardedAdSessionId_key"
ON "InventoryPhotoParseEvent"("rewardedAdSessionId");

-- CreateIndex
CREATE INDEX "InventoryPhotoParseEvent_ownerKey_usageDay_status_idx"
ON "InventoryPhotoParseEvent"("ownerKey", "usageDay", "status");

-- CreateIndex
CREATE INDEX "InventoryPhotoParseEvent_usageSource_usageDay_status_idx"
ON "InventoryPhotoParseEvent"("usageSource", "usageDay", "status");

-- CreateIndex
CREATE INDEX "InventoryPhotoParseEvent_resultExpiresAt_idx"
ON "InventoryPhotoParseEvent"("resultExpiresAt");

-- ReplaceIndex
DROP INDEX "RewardedAdSession_ownerKey_status_createdAt_idx";
CREATE INDEX "RewardedAdSession_ownerKey_purpose_status_createdAt_idx"
ON "RewardedAdSession"("ownerKey", "purpose", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "InventoryPhotoParseEvent"
ADD CONSTRAINT "InventoryPhotoParseEvent_rewardedAdSessionId_fkey"
FOREIGN KEY ("rewardedAdSessionId") REFERENCES "RewardedAdSession"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
