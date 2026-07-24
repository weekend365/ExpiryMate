CREATE TYPE "InventoryUnitCode" AS ENUM ('ea', 'ml', 'g');

ALTER TABLE "InventoryItem"
ADD COLUMN "quantityBase" INTEGER,
ADD COLUMN "unitCode" "InventoryUnitCode" NOT NULL DEFAULT 'ea';

UPDATE "InventoryItem"
SET "quantityBase" = "quantity"
WHERE "quantityBase" IS NULL;

ALTER TABLE "InventoryItem"
ALTER COLUMN "quantityBase" SET NOT NULL,
ALTER COLUMN "quantityBase" SET DEFAULT 1;

ALTER TABLE "InventoryItem"
ADD CONSTRAINT "InventoryItem_quantityBase_nonnegative"
CHECK ("quantityBase" >= 0);
