-- Feature: FOC (job referred by an external company) payment tracking, office collection mode,
-- technician discount requests.
-- Defaults keep every existing job on its old behaviour:
--   paymentCollectionMode = 'technician' -> field collection as before
--   focAmountReceived = 0 -> nothing recorded yet via the new FOC-payment action (legacy company
--   payments recorded through hisaab settlements are still read by the Accounts views)
-- IF NOT EXISTS guards make it safe on a DB that was previously `db push`ed.

ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "focReason" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "focApprovedBy" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "focApprovedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "focAmountReceived" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "focPaymentReceivedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "focPaymentRef" TEXT;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "paymentCollectionMode" TEXT NOT NULL DEFAULT 'technician';

CREATE TABLE IF NOT EXISTS "JobDiscountRequest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "itemId" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "approvedAmount" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedById" TEXT,
    "requestedByName" TEXT NOT NULL,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobDiscountRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JobDiscountRequest_jobId_status_idx" ON "JobDiscountRequest"("jobId", "status");
CREATE INDEX IF NOT EXISTS "JobDiscountRequest_status_idx" ON "JobDiscountRequest"("status");

DO $$ BEGIN
  ALTER TABLE "JobDiscountRequest" ADD CONSTRAINT "JobDiscountRequest_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
