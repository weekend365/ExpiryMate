CREATE TABLE "AffiliateReportDaily" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "trackingCode" TEXT NOT NULL DEFAULT '',
    "subId" TEXT NOT NULL DEFAULT '',
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "orders" INTEGER NOT NULL DEFAULT 0,
    "cancels" INTEGER NOT NULL DEFAULT 0,
    "gmvKrw" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "commissionKrw" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateReportDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AffiliateReportDaily_date_trackingCode_subId_key"
ON "AffiliateReportDaily"("date", "trackingCode", "subId");

CREATE INDEX "AffiliateReportDaily_date_idx" ON "AffiliateReportDaily"("date");
CREATE INDEX "AffiliateReportDaily_lastSyncedAt_idx" ON "AffiliateReportDaily"("lastSyncedAt");
