-- CreateEnum
CREATE TYPE "SupportInquiryCategory" AS ENUM ('bug', 'account', 'recipe_ai', 'other');

-- CreateEnum
CREATE TYPE "SupportInquiryStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "SupportInquiry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "SupportInquiryCategory" NOT NULL,
    "body" TEXT NOT NULL,
    "appVersion" TEXT,
    "platform" TEXT,
    "status" "SupportInquiryStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportInquiry_userId_createdAt_idx" ON "SupportInquiry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportInquiry_status_createdAt_idx" ON "SupportInquiry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SupportInquiry_category_createdAt_idx" ON "SupportInquiry"("category", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportInquiry" ADD CONSTRAINT "SupportInquiry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
