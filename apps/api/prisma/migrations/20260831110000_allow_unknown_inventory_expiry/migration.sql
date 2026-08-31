ALTER TYPE "ExpirySource" ADD VALUE IF NOT EXISTS 'unknown';

ALTER TABLE "InventoryItem"
ALTER COLUMN "expiryDate" DROP NOT NULL;

CREATE TABLE "InventoryCreateRequest" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "itemIds" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryCreateRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryCreateRequest_spaceId_idempotencyKey_key"
ON "InventoryCreateRequest"("spaceId", "idempotencyKey");

CREATE INDEX "InventoryCreateRequest_createdAt_idx"
ON "InventoryCreateRequest"("createdAt");
