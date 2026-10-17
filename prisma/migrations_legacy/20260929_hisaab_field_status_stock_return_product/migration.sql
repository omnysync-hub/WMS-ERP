-- Double-hisaab fix: technician field collection is recorded as an UNPOSTED field report;
-- accountant hisaab / cash handover confirms it and posts GL exactly once.
ALTER TABLE "HisaabSettlement" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'posted';

-- Backfill: legacy rows created by completeJob (field app) never had GL posted
UPDATE "HisaabSettlement"
   SET "status" = 'field_reported'
 WHERE "settledBy" LIKE '%(field app%'
   AND "accountantReceivedAt" IS NULL
   AND "status" = 'posted';

-- Stock return acknowledge requires a resolvable warehouse product
ALTER TABLE "StockReturn" ADD COLUMN IF NOT EXISTS "productId" TEXT;
