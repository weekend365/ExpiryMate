-- Store inventory expiry dates as calendar dates.
-- Existing timestamps are interpreted as UTC instants and converted to the
-- corresponding Asia/Seoul calendar date before truncation.

ALTER TABLE "InventoryItem"
ALTER COLUMN "expiryDate" TYPE DATE
USING (("expiryDate" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date);
