ALTER TABLE "JobExpenseClaim"
ADD COLUMN "category" TEXT,
ADD COLUMN "allocationGroupId" TEXT;

CREATE INDEX "JobExpenseClaim_allocationGroupId_idx"
ON "JobExpenseClaim"("allocationGroupId");

CREATE INDEX "JobExpenseClaim_technicianId_createdAt_idx"
ON "JobExpenseClaim"("technicianId", "createdAt");
