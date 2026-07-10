-- AlterTable
ALTER TABLE "ProductMaster" ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'foodsafety_api',
ADD COLUMN "contributedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "ProductMaster_source_idx" ON "ProductMaster"("source");
