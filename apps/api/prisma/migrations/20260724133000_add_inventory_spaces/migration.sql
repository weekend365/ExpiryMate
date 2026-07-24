-- Expand-only migration for shared inventory spaces. Legacy ownerKey columns
-- remain during the mobile compatibility window.
CREATE TYPE "InventorySpaceType" AS ENUM ('personal', 'household', 'store');
CREATE TYPE "InventorySpaceRole" AS ENUM ('owner', 'manager', 'member');

CREATE TABLE "InventorySpace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InventorySpaceType" NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventorySpace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventorySpaceMembership" (
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "InventorySpaceRole" NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventorySpaceMembership_pkey" PRIMARY KEY ("spaceId", "userId")
);

CREATE TABLE "SpaceInvitation" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "InventorySpaceRole" NOT NULL DEFAULT 'member',
    "tokenHash" TEXT NOT NULL,
    "invitedByUserId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpaceInvitation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InventoryItem"
  ADD COLUMN "spaceId" TEXT,
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "updatedByUserId" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "UserStorageLocation" ADD COLUMN "spaceId" TEXT;
ALTER TABLE "RecipeRecommendation" ADD COLUMN "spaceId" TEXT;

INSERT INTO "InventorySpace" ("id", "name", "type", "ownerUserId", "createdAt", "updatedAt")
SELECT 'personal_' || "id", '내 냉장고', 'personal', "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "InventorySpaceMembership"
  ("spaceId", "userId", "role", "notificationsEnabled", "joinedAt", "updatedAt")
SELECT 'personal_' || "id", "id", 'owner', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
ON CONFLICT ("spaceId", "userId") DO NOTHING;

UPDATE "InventoryItem"
SET
  "spaceId" = 'personal_' || "ownerKey",
  "createdByUserId" = "ownerKey",
  "updatedByUserId" = "ownerKey"
WHERE "spaceId" IS NULL;

UPDATE "UserStorageLocation"
SET "spaceId" = 'personal_' || "ownerKey"
WHERE "spaceId" IS NULL;

UPDATE "RecipeRecommendation"
SET "spaceId" = 'personal_' || "ownerKey"
WHERE "spaceId" IS NULL;

DROP INDEX IF EXISTS "UserStorageLocation_ownerKey_key_key";

CREATE UNIQUE INDEX "SpaceInvitation_tokenHash_key" ON "SpaceInvitation"("tokenHash");
CREATE INDEX "InventorySpace_ownerUserId_idx" ON "InventorySpace"("ownerUserId");
CREATE INDEX "InventorySpace_type_idx" ON "InventorySpace"("type");
CREATE INDEX "InventorySpaceMembership_userId_joinedAt_idx" ON "InventorySpaceMembership"("userId", "joinedAt");
CREATE INDEX "InventorySpaceMembership_spaceId_role_idx" ON "InventorySpaceMembership"("spaceId", "role");
CREATE INDEX "SpaceInvitation_spaceId_email_createdAt_idx" ON "SpaceInvitation"("spaceId", "email", "createdAt");
CREATE INDEX "SpaceInvitation_email_expiresAt_idx" ON "SpaceInvitation"("email", "expiresAt");
CREATE INDEX "InventoryItem_spaceId_status_idx" ON "InventoryItem"("spaceId", "status");
CREATE INDEX "InventoryItem_spaceId_expiryDate_idx" ON "InventoryItem"("spaceId", "expiryDate");
CREATE UNIQUE INDEX "UserStorageLocation_spaceId_key_key" ON "UserStorageLocation"("spaceId", "key");
CREATE INDEX "UserStorageLocation_spaceId_idx" ON "UserStorageLocation"("spaceId");
CREATE INDEX "RecipeRecommendation_spaceId_createdAt_idx" ON "RecipeRecommendation"("spaceId", "createdAt");
CREATE INDEX "RecipeRecommendation_spaceId_requestCacheKey_createdAt_idx" ON "RecipeRecommendation"("spaceId", "requestCacheKey", "createdAt");

ALTER TABLE "InventorySpace" ADD CONSTRAINT "InventorySpace_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventorySpaceMembership" ADD CONSTRAINT "InventorySpaceMembership_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventorySpaceMembership" ADD CONSTRAINT "InventorySpaceMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceInvitation" ADD CONSTRAINT "SpaceInvitation_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpaceInvitation" ADD CONSTRAINT "SpaceInvitation_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserStorageLocation" ADD CONSTRAINT "UserStorageLocation_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecipeRecommendation" ADD CONSTRAINT "RecipeRecommendation_spaceId_fkey"
  FOREIGN KEY ("spaceId") REFERENCES "InventorySpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
