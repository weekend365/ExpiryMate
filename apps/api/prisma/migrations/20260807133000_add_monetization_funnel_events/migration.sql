CREATE TABLE "MonetizationFunnelEvent" (
  "id" TEXT NOT NULL,
  "ownerKey" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "experimentKey" TEXT NOT NULL,
  "experimentVariant" TEXT NOT NULL,
  "properties" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MonetizationFunnelEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MonetizationFunnelEvent_eventName_createdAt_idx"
  ON "MonetizationFunnelEvent"("eventName", "createdAt");
CREATE INDEX "MonetizationFunnelEvent_experimentKey_experimentVariant_createdAt_idx"
  ON "MonetizationFunnelEvent"("experimentKey", "experimentVariant", "createdAt");
CREATE INDEX "MonetizationFunnelEvent_ownerKey_createdAt_idx"
  ON "MonetizationFunnelEvent"("ownerKey", "createdAt");

ALTER TABLE "MonetizationFunnelEvent"
  ADD CONSTRAINT "MonetizationFunnelEvent_ownerKey_fkey"
  FOREIGN KEY ("ownerKey") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
