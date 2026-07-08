-- CreateTable
CREATE TABLE "ProductMaster" (
    "id" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMaster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductMaster_barcode_key" ON "ProductMaster"("barcode");

-- CreateIndex
CREATE INDEX "ProductMaster_name_idx" ON "ProductMaster"("name");

-- CreateIndex
CREATE INDEX "ProductMaster_category_idx" ON "ProductMaster"("category");
