ALTER TABLE "NotificationPreference"
  ADD COLUMN "deliveryTime" TEXT NOT NULL DEFAULT '09:00',
  ADD COLUMN "groupBySpace" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "PushNotificationDelivery"
  ALTER COLUMN "inventoryItemId" DROP NOT NULL,
  ADD COLUMN "spaceId" TEXT,
  ADD COLUMN "dedupeKey" TEXT;

CREATE UNIQUE INDEX "PushNotificationDelivery_dedupeKey_key" ON "PushNotificationDelivery"("dedupeKey");
ALTER TABLE "PushNotificationDelivery" ADD CONSTRAINT "PushNotificationDelivery_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
