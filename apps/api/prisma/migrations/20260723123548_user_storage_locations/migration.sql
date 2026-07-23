-- Convert InventoryItem.storageLocation from enum to text
ALTER TABLE "InventoryItem" ALTER COLUMN "storageLocation" TYPE TEXT USING ("storageLocation"::text);

DROP TYPE "StorageLocation";

-- CreateTable
CREATE TABLE "UserStorageLocation" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserStorageLocation_ownerKey_idx" ON "UserStorageLocation"("ownerKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserStorageLocation_ownerKey_key_key" ON "UserStorageLocation"("ownerKey", "key");

-- AddForeignKey
ALTER TABLE "UserStorageLocation" ADD CONSTRAINT "UserStorageLocation_ownerKey_fkey" FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
