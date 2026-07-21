-- CreateTable
CREATE TABLE "OAuthAuthorizationSession" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "returnUri" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redirectedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAuthorizationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationSession_state_key" ON "OAuthAuthorizationSession"("state");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationSession_expiresAt_idx" ON "OAuthAuthorizationSession"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationSession_provider_createdAt_idx" ON "OAuthAuthorizationSession"("provider", "createdAt");
