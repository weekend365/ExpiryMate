-- CreateEnum
CREATE TYPE "PushTokenPlatform" AS ENUM ('ios', 'android', 'web', 'unknown');

-- CreateEnum
CREATE TYPE "PushNotificationDeliveryStatus" AS ENUM ('pending', 'sent', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "PushTokenPlatform" NOT NULL DEFAULT 'unknown',
    "deviceId" TEXT,
    "appVersion" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushNotificationDelivery" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "pushTokenId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "reminderDate" TIMESTAMP(3) NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "status" "PushNotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
    "expoTicketId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushNotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_ownerKey_enabled_idx" ON "PushToken"("ownerKey", "enabled");

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_ownerKey_reminderDate_idx" ON "PushNotificationDelivery"("ownerKey", "reminderDate");

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_pushTokenId_status_idx" ON "PushNotificationDelivery"("pushTokenId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PushNotificationDelivery_pushTokenId_inventoryItemId_reminderDate_daysBefore_key" ON "PushNotificationDelivery"("pushTokenId", "inventoryItemId", "reminderDate", "daysBefore");

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_ownerKey_fkey" FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationDelivery" ADD CONSTRAINT "PushNotificationDelivery_ownerKey_fkey" FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationDelivery" ADD CONSTRAINT "PushNotificationDelivery_pushTokenId_fkey" FOREIGN KEY ("pushTokenId") REFERENCES "PushToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationDelivery" ADD CONSTRAINT "PushNotificationDelivery_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
