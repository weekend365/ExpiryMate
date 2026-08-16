-- AlterTable
ALTER TABLE "ProductMaster" ADD COLUMN "confidence" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN "confirmCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "ProductMaster"
SET "confidence" = 85
WHERE "source" = 'foodsafety_api';

UPDATE "ProductMaster"
SET "confidence" = 60
WHERE "source" = 'open_food_facts';

UPDATE "ProductMaster"
SET "confidence" = 35
WHERE "source" = 'user_contributed';

UPDATE "ProductMaster"
SET "confidence" = GREATEST("confidence", 75)
WHERE "crowdName" IS NOT NULL;
