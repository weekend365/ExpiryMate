-- Remove barcode scanning domain data and schema.

DROP TABLE IF EXISTS "ScanLog";

DROP INDEX IF EXISTS "InventoryItem_barcode_idx";
DROP INDEX IF EXISTS "Product_barcode_key";

ALTER TABLE IF EXISTS "InventoryItem" DROP COLUMN IF EXISTS "barcode";
ALTER TABLE IF EXISTS "Product" DROP COLUMN IF EXISTS "barcode";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpirySource') THEN
    IF to_regclass('"InventoryItem"') IS NOT NULL THEN
      UPDATE "InventoryItem"
      SET "expirySource" = 'manual'
      WHERE "expirySource" = 'barcode_decoded';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumtypid = '"ExpirySource"'::regtype
        AND enumlabel = 'barcode_decoded'
    ) THEN
      CREATE TYPE "ExpirySource_new" AS ENUM ('manual', 'preset', 'ocr_detected');

      IF to_regclass('"InventoryItem"') IS NOT NULL THEN
        ALTER TABLE "InventoryItem"
        ALTER COLUMN "expirySource" TYPE "ExpirySource_new"
        USING ("expirySource"::text::"ExpirySource_new");
      END IF;

      ALTER TYPE "ExpirySource" RENAME TO "ExpirySource_old";
      ALTER TYPE "ExpirySource_new" RENAME TO "ExpirySource";
      DROP TYPE "ExpirySource_old";
    END IF;
  END IF;
END $$;
