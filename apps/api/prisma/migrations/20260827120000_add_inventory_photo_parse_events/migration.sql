-- CreateTable
CREATE TABLE "InventoryPhotoParseEvent" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "spaceId" TEXT,
    "scene" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "aiProvider" TEXT NOT NULL DEFAULT 'openai',
    "aiModel" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryPhotoParseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryPhotoParseEvent_ownerKey_createdAt_idx" ON "InventoryPhotoParseEvent"("ownerKey", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryPhotoParseEvent_createdAt_idx" ON "InventoryPhotoParseEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "InventoryPhotoParseEvent" ADD CONSTRAINT "InventoryPhotoParseEvent_ownerKey_fkey" FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryPhotoParseEvent" ADD CONSTRAINT "InventoryPhotoParseEvent_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
