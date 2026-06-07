-- AlterTable
ALTER TABLE "User" ADD COLUMN "aiDataNoticeAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "aiDataNoticeVersion" TEXT;
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
