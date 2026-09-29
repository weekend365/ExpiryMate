ALTER TABLE "InventoryItem" ADD COLUMN "openedDate" DATE, ADD COLUMN "openedCheckDate" DATE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_opened_dates_check" CHECK ("openedCheckDate" IS NULL OR ("openedDate" IS NOT NULL AND "openedCheckDate" >= "openedDate"));
CREATE INDEX "InventoryItem_spaceId_openedCheckDate_idx" ON "InventoryItem"("spaceId", "openedCheckDate");
CREATE TABLE "InventoryActivity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "spaceId" TEXT NOT NULL,
  "inventoryItemId" TEXT,
  "actorUserId" TEXT,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryActivity_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryActivity_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "InventoryActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "InventoryActivity_spaceId_createdAt_id_idx" ON "InventoryActivity"("spaceId", "createdAt", "id");
CREATE INDEX "InventoryActivity_inventoryItemId_createdAt_idx" ON "InventoryActivity"("inventoryItemId", "createdAt");
