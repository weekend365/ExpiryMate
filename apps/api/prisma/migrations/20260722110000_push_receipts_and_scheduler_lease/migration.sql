-- AlterTable
ALTER TABLE "PushNotificationDelivery" ADD COLUMN "receiptCheckedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_status_receiptCheckedAt_sentAt_idx" ON "PushNotificationDelivery"("status", "receiptCheckedAt", "sentAt");

-- CreateIndex
CREATE INDEX "PushNotificationDelivery_status_updatedAt_idx" ON "PushNotificationDelivery"("status", "updatedAt");

-- CreateTable
CREATE TABLE "SchedulerLease" (
    "key" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerLease_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "SchedulerLease_expiresAt_idx" ON "SchedulerLease"("expiresAt");
