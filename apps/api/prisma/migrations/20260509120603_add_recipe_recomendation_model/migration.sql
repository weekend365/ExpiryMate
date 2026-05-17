-- CreateEnum
CREATE TYPE "StorageLocation" AS ENUM ('fridge', 'freezer', 'room', 'bathroom', 'kitchen');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('active', 'consumed', 'discarded', 'expired');

-- CreateEnum
CREATE TYPE "ExpirySource" AS ENUM ('manual', 'preset', 'ocr_detected');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('dairy', 'egg', 'tofu', 'beverage', 'instant_food', 'personal_care', 'paper_goods', 'cleaning', 'frozen_food', 'produce', 'seasoning', 'snack', 'household');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL DEFAULT 'demo-user',
    "productId" TEXT,
    "displayName" TEXT NOT NULL,
    "brand" TEXT,
    "category" "ProductCategory",
    "quantity" INTEGER NOT NULL,
    "unit" TEXT DEFAULT '개',
    "storageLocation" "StorageLocation" NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "expirySource" "ExpirySource" NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL DEFAULT 'demo-user',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysBefore" INTEGER[] DEFAULT ARRAY[1, 3, 7]::INTEGER[],
    "remindOnDayOf" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" TEXT NOT NULL DEFAULT '22:00',
    "quietHoursEnd" TEXT NOT NULL DEFAULT '07:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_ownerKey_status_idx" ON "InventoryItem"("ownerKey", "status");

-- CreateIndex
CREATE INDEX "InventoryItem_ownerKey_expiryDate_idx" ON "InventoryItem"("ownerKey", "expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_ownerKey_key" ON "NotificationPreference"("ownerKey");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
