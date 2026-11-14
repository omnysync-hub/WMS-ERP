-- CreateTable
CREATE TABLE "WorkshopJobCard" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "workshopType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "bikeRegNo" TEXT,
    "chassisNumber" TEXT,
    "engineNumber" TEXT,
    "currentKm" DOUBLE PRECISION,
    "bikeMakeModel" TEXT,
    "unitType" TEXT,
    "brandModel" TEXT,
    "serialNumber" TEXT,
    "customerSite" TEXT,
    "compressorSpec" TEXT,
    "refrigerantType" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "complaint" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supervisorName" TEXT,
    "supervisorId" TEXT,
    "assignedStaffId" TEXT,
    "assignedStaffName" TEXT,
    "assignedStaffRole" TEXT,
    "assignedAt" TIMESTAMP(3),
    "inspectionFindings" TEXT,
    "workRequired" TEXT,
    "estimatedHours" DOUBLE PRECISION,
    "estimatedCost" DOUBLE PRECISION DEFAULT 0,
    "diagnosedAt" TIMESTAMP(3),
    "diagnosedBy" TEXT,
    "approvalStatus" TEXT DEFAULT 'pending',
    "managerApprovedAt" TIMESTAMP(3),
    "managerApprovedBy" TEXT,
    "rejectionReason" TEXT,
    "testingPressurePsi" DOUBLE PRECISION,
    "testingLeakTest" TEXT,
    "testingRunTestAmps" DOUBLE PRECISION,
    "testingNotes" TEXT,
    "testedAt" TIMESTAMP(3),
    "testedBy" TEXT,
    "workDoneSummary" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closeNotes" TEXT,
    "deliveryStatus" TEXT DEFAULT 'in_workshop',
    "deliveredAt" TIMESTAMP(3),
    "deliveredTo" TEXT,
    "totalMaterialCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalLabourCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalJobCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopJobCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopMaterialRequisition" (
    "id" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "productId" TEXT,
    "itemCode" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "requestedQty" DOUBLE PRECISION NOT NULL,
    "issuedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "returnedQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestedBy" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuedBy" TEXT,
    "returnedAt" TIMESTAMP(3),
    "returnedBy" TEXT,
    "returnReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopMaterialRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopTool" (
    "id" TEXT NOT NULL,
    "toolCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "workshopType" TEXT NOT NULL DEFAULT 'general',
    "totalQuantity" INTEGER NOT NULL DEFAULT 1,
    "availableQuantity" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'Operational',
    "conditionNotes" TEXT,
    "lastCountDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopToolIssue" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "jobCardId" TEXT,
    "staffId" TEXT,
    "staffName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedBy" TEXT NOT NULL,
    "expectedReturnDate" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "returnedBy" TEXT,
    "returnCondition" TEXT,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopToolIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopScrapItem" (
    "id" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "workshopType" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "customerKept" BOOLEAN NOT NULL DEFAULT false,
    "returnedToStore" BOOLEAN NOT NULL DEFAULT false,
    "returnedToStoreAt" TIMESTAMP(3),
    "storeKeeperName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "disposalValue" DOUBLE PRECISION DEFAULT 0,
    "disposalNotes" TEXT,
    "disposedAt" TIMESTAMP(3),
    "disposedBy" TEXT,
    "approvedBy" TEXT,
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopScrapItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopStatusLog" (
    "id" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "metadata" JSONB,

    CONSTRAINT "WorkshopStatusLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopToolCount" (
    "id" TEXT NOT NULL,
    "auditMonth" TEXT NOT NULL,
    "workshopType" TEXT NOT NULL,
    "countedBy" TEXT NOT NULL,
    "verifiedBy" TEXT,
    "totalToolsCounted" INTEGER NOT NULL DEFAULT 0,
    "discrepancyCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopToolCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopJobCard_jobNumber_key" ON "WorkshopJobCard"("jobNumber");
CREATE INDEX "WorkshopJobCard_workshopType_status_idx" ON "WorkshopJobCard"("workshopType", "status");
CREATE INDEX "WorkshopJobCard_bikeRegNo_idx" ON "WorkshopJobCard"("bikeRegNo");
CREATE INDEX "WorkshopJobCard_serialNumber_idx" ON "WorkshopJobCard"("serialNumber");
CREATE INDEX "WorkshopJobCard_assignedStaffId_idx" ON "WorkshopJobCard"("assignedStaffId");

-- CreateIndex
CREATE INDEX "WorkshopMaterialRequisition_jobCardId_idx" ON "WorkshopMaterialRequisition"("jobCardId");
CREATE INDEX "WorkshopMaterialRequisition_productId_idx" ON "WorkshopMaterialRequisition"("productId");
CREATE INDEX "WorkshopMaterialRequisition_status_idx" ON "WorkshopMaterialRequisition"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopTool_toolCode_key" ON "WorkshopTool"("toolCode");
CREATE INDEX "WorkshopTool_workshopType_condition_idx" ON "WorkshopTool"("workshopType", "condition");

-- CreateIndex
CREATE INDEX "WorkshopToolIssue_toolId_idx" ON "WorkshopToolIssue"("toolId");
CREATE INDEX "WorkshopToolIssue_jobCardId_idx" ON "WorkshopToolIssue"("jobCardId");
CREATE INDEX "WorkshopToolIssue_status_idx" ON "WorkshopToolIssue"("status");

-- CreateIndex
CREATE INDEX "WorkshopScrapItem_jobCardId_idx" ON "WorkshopScrapItem"("jobCardId");
CREATE INDEX "WorkshopScrapItem_workshopType_status_idx" ON "WorkshopScrapItem"("workshopType", "status");

-- CreateIndex
CREATE INDEX "WorkshopStatusLog_jobCardId_changedAt_idx" ON "WorkshopStatusLog"("jobCardId", "changedAt");

-- CreateIndex
CREATE INDEX "WorkshopToolCount_workshopType_auditMonth_idx" ON "WorkshopToolCount"("workshopType", "auditMonth");

-- AddForeignKey
ALTER TABLE "WorkshopJobCard" ADD CONSTRAINT "WorkshopJobCard_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkshopJobCard" ADD CONSTRAINT "WorkshopJobCard_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopMaterialRequisition" ADD CONSTRAINT "WorkshopMaterialRequisition_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "WorkshopJobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkshopMaterialRequisition" ADD CONSTRAINT "WorkshopMaterialRequisition_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopToolIssue" ADD CONSTRAINT "WorkshopToolIssue_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "WorkshopTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkshopToolIssue" ADD CONSTRAINT "WorkshopToolIssue_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "WorkshopJobCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopScrapItem" ADD CONSTRAINT "WorkshopScrapItem_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "WorkshopJobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopStatusLog" ADD CONSTRAINT "WorkshopStatusLog_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "WorkshopJobCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
