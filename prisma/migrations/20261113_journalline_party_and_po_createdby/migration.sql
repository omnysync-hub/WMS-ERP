-- AlterTable
ALTER TABLE "JournalLine" ADD COLUMN IF NOT EXISTS "partyType" TEXT;
ALTER TABLE "JournalLine" ADD COLUMN IF NOT EXISTS "partyId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JournalLine_partyType_partyId_idx" ON "JournalLine"("partyType", "partyId");

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
