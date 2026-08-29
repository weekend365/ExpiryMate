-- Personal Plus quota accounting and append-only disposition ledger.

ALTER TYPE "InventoryPhotoParseUsageSource" ADD VALUE 'subscription';

CREATE TYPE "InventoryDispositionOutcome" AS ENUM ('consumed', 'discarded');
CREATE TYPE "InventoryDispositionSource" AS ENUM ('live', 'backfill');

ALTER TABLE "InventoryPhotoParseEvent"
ADD COLUMN "subscriptionEntitlementId" TEXT;

CREATE INDEX "InventoryPhotoParseEvent_subscriptionEntitlementId_status_idx"
ON "InventoryPhotoParseEvent"("subscriptionEntitlementId", "status");

ALTER TABLE "InventoryPhotoParseEvent"
ADD CONSTRAINT "InventoryPhotoParseEvent_subscriptionEntitlementId_fkey"
FOREIGN KEY ("subscriptionEntitlementId") REFERENCES "SubscriptionEntitlement"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "InventoryDispositionEvent" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "ownerKey" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "displayName" TEXT NOT NULL,
  "category" "ProductCategory",
  "itemSnapshot" JSONB NOT NULL,
  "outcome" "InventoryDispositionOutcome" NOT NULL,
  "source" "InventoryDispositionSource" NOT NULL DEFAULT 'live',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryDispositionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryDispositionEvent_inventoryItemId_key"
ON "InventoryDispositionEvent"("inventoryItemId");
CREATE INDEX "InventoryDispositionEvent_spaceId_occurredAt_idx"
ON "InventoryDispositionEvent"("spaceId", "occurredAt");
CREATE INDEX "InventoryDispositionEvent_ownerKey_occurredAt_idx"
ON "InventoryDispositionEvent"("ownerKey", "occurredAt");
CREATE INDEX "InventoryDispositionEvent_outcome_occurredAt_idx"
ON "InventoryDispositionEvent"("outcome", "occurredAt");

ALTER TABLE "InventoryDispositionEvent"
ADD CONSTRAINT "InventoryDispositionEvent_inventoryItemId_fkey"
FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryDispositionEvent"
ADD CONSTRAINT "InventoryDispositionEvent_ownerKey_fkey"
FOREIGN KEY ("ownerKey") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryDispositionEvent"
ADD CONSTRAINT "InventoryDispositionEvent_spaceId_fkey"
FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryDispositionEvent"
ADD CONSTRAINT "InventoryDispositionEvent_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Historical terminal items are explicitly marked as estimates based on updatedAt.
INSERT INTO "InventoryDispositionEvent" (
  "id", "inventoryItemId", "ownerKey", "spaceId", "actorUserId",
  "displayName", "category", "itemSnapshot", "outcome", "source", "occurredAt", "createdAt"
)
SELECT
  'backfill_' || md5(item."id"),
  item."id",
  item."ownerKey",
  item."spaceId",
  item."updatedByUserId",
  item."displayName",
  item."category",
  jsonb_build_object(
    'productId', item."productId",
    'productMasterId', item."productMasterId",
    'displayName', item."displayName",
    'brand', item."brand",
    'category', item."category",
    'quantity', item."quantity",
    'unit', item."unit",
    'quantityBase', item."quantityBase",
    'unitCode', item."unitCode",
    'storageLocation', item."storageLocation",
    'expiryDate', to_char(item."expiryDate", 'YYYY-MM-DD')
  ),
  item."status"::text::"InventoryDispositionOutcome",
  'backfill',
  item."updatedAt",
  CURRENT_TIMESTAMP
FROM "InventoryItem" item
WHERE item."status" IN ('consumed', 'discarded')
  AND item."spaceId" IS NOT NULL;

CREATE TABLE "SubscriptionPurchaseIntent" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL,
  "store" "SubscriptionStore" NOT NULL,
  "productId" TEXT NOT NULL,
  "appleAppAccountToken" TEXT NOT NULL,
  "googleObfuscatedAccountId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubscriptionPurchaseIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubscriptionPurchaseIntent_ownerKey_expiresAt_idx"
ON "SubscriptionPurchaseIntent"("ownerKey", "expiresAt");
CREATE INDEX "SubscriptionPurchaseIntent_store_productId_createdAt_idx"
ON "SubscriptionPurchaseIntent"("store", "productId", "createdAt");

ALTER TABLE "SubscriptionPurchaseIntent"
ADD CONSTRAINT "SubscriptionPurchaseIntent_ownerKey_fkey"
FOREIGN KEY ("ownerKey") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
