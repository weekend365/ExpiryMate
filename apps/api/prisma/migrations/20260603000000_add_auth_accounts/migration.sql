CREATE TYPE "UserRole" AS ENUM ('user', 'admin');
CREATE TYPE "AccountType" AS ENUM ('anonymous', 'registered');
CREATE TYPE "OAuthProvider" AS ENUM ('apple', 'google', 'kakao');
CREATE TYPE "OneTimeAuthTokenPurpose" AS ENUM ('email_verification', 'password_reset');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "accountType" "AccountType" NOT NULL DEFAULT 'anonymous',
    "emailVerifiedAt" TIMESTAMP(3),
    "mergedIntoUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordCredential" (
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordCredential_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "replacedByTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OneTimeAuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "OneTimeAuthTokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneTimeAuthToken_pkey" PRIMARY KEY ("id")
);

INSERT INTO "User" ("id", "accountType", "createdAt", "updatedAt")
SELECT DISTINCT "ownerKey", 'anonymous'::"AccountType", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT "ownerKey" FROM "InventoryItem"
    UNION
    SELECT "ownerKey" FROM "NotificationPreference"
    UNION
    SELECT "ownerKey" FROM "RecipeRecommendation"
    UNION
    SELECT 'demo-user' AS "ownerKey"
) AS owners
WHERE "ownerKey" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_accountType_idx" ON "User"("accountType");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE UNIQUE INDEX "OAuthAccount_provider_providerUserId_key" ON "OAuthAccount"("provider", "providerUserId");
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");
CREATE UNIQUE INDEX "RefreshSession_tokenHash_key" ON "RefreshSession"("tokenHash");
CREATE INDEX "RefreshSession_userId_expiresAt_idx" ON "RefreshSession"("userId", "expiresAt");
CREATE UNIQUE INDEX "OneTimeAuthToken_tokenHash_key" ON "OneTimeAuthToken"("tokenHash");
CREATE INDEX "OneTimeAuthToken_userId_purpose_idx" ON "OneTimeAuthToken"("userId", "purpose");
CREATE INDEX "OneTimeAuthToken_purpose_expiresAt_idx" ON "OneTimeAuthToken"("purpose", "expiresAt");

ALTER TABLE "User"
ADD CONSTRAINT "User_mergedIntoUserId_fkey"
FOREIGN KEY ("mergedIntoUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PasswordCredential"
ADD CONSTRAINT "PasswordCredential_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthAccount"
ADD CONSTRAINT "OAuthAccount_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RefreshSession"
ADD CONSTRAINT "RefreshSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OneTimeAuthToken"
ADD CONSTRAINT "OneTimeAuthToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryItem"
ADD CONSTRAINT "InventoryItem_ownerKey_fkey"
FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_ownerKey_fkey"
FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecipeRecommendation"
ADD CONSTRAINT "RecipeRecommendation_ownerKey_fkey"
FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
