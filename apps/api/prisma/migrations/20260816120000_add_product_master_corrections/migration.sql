-- CreateEnum
CREATE TYPE "ProductMasterCorrectionStatus" AS ENUM ('pending', 'applied', 'dismissed');

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN "productMasterId" TEXT;

-- CreateTable
CREATE TABLE "ProductMasterCorrection" (
    "id" TEXT NOT NULL,
    "productMasterId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "catalogName" TEXT NOT NULL,
    "catalogBrand" TEXT NOT NULL,
    "catalogCategory" TEXT NOT NULL,
    "proposedName" TEXT NOT NULL,
    "proposedBrand" TEXT,
    "proposedCategory" TEXT,
    "status" "ProductMasterCorrectionStatus" NOT NULL DEFAULT 'pending',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMasterCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductMasterCorrection_productMasterId_submittedByUserId_key" ON "ProductMasterCorrection"("productMasterId", "submittedByUserId");

-- CreateIndex
CREATE INDEX "ProductMasterCorrection_status_createdAt_idx" ON "ProductMasterCorrection"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProductMasterCorrection_productMasterId_status_idx" ON "ProductMasterCorrection"("productMasterId", "status");

-- CreateIndex
CREATE INDEX "InventoryItem_productMasterId_idx" ON "InventoryItem"("productMasterId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productMasterId_fkey" FOREIGN KEY ("productMasterId") REFERENCES "ProductMaster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMasterCorrection" ADD CONSTRAINT "ProductMasterCorrection_productMasterId_fkey" FOREIGN KEY ("productMasterId") REFERENCES "ProductMaster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMasterCorrection" ADD CONSTRAINT "ProductMasterCorrection_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMasterCorrection" ADD CONSTRAINT "ProductMasterCorrection_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
