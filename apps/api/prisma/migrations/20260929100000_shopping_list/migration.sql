CREATE TABLE "ShoppingListItem" (
  "id" TEXT NOT NULL,
  "spaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit" TEXT NOT NULL DEFAULT '개',
  "version" INTEGER NOT NULL DEFAULT 1,
  "completedAt" TIMESTAMP(3),
  "inventoryItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShoppingListItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShoppingListItem_spaceId_normalizedName_key" ON "ShoppingListItem"("spaceId", "normalizedName");
CREATE INDEX "ShoppingListItem_spaceId_completedAt_idx" ON "ShoppingListItem"("spaceId", "completedAt");
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
