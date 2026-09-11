-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_complaintId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_doId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_poId_fkey";

-- DropForeignKey
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT "Attendance_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "Complaint" DROP CONSTRAINT "Complaint_assignedTechnicianId_fkey";

-- DropForeignKey
ALTER TABLE "Complaint" DROP CONSTRAINT "Complaint_customerId_fkey";

-- DropForeignKey
ALTER TABLE "ComplaintTimeline" DROP CONSTRAINT "ComplaintTimeline_changedById_fkey";

-- DropForeignKey
ALTER TABLE "ComplaintTimeline" DROP CONSTRAINT "ComplaintTimeline_complaintId_fkey";

-- DropForeignKey
ALTER TABLE "DOLineItem" DROP CONSTRAINT "DOLineItem_doId_fkey";

-- DropForeignKey
ALTER TABLE "DOLineItem" DROP CONSTRAINT "DOLineItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "DeliveryOrder" DROP CONSTRAINT "DeliveryOrder_customerId_fkey";

-- DropForeignKey
ALTER TABLE "GRNLineItem" DROP CONSTRAINT "GRNLineItem_grnId_fkey";

-- DropForeignKey
ALTER TABLE "GRNLineItem" DROP CONSTRAINT "GRNLineItem_poPendingItemId_fkey";

-- DropForeignKey
ALTER TABLE "GRNLineItem" DROP CONSTRAINT "GRNLineItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "GoodsReceivedNote" DROP CONSTRAINT "GoodsReceivedNote_poId_fkey";

-- DropForeignKey
ALTER TABLE "GoodsReceivedNote" DROP CONSTRAINT "GoodsReceivedNote_receivedById_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_complaintId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_doId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceLineItem" DROP CONSTRAINT "InvoiceLineItem_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "InvoiceLineItem" DROP CONSTRAINT "InvoiceLineItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "LoginActivityLog" DROP CONSTRAINT "LoginActivityLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "POLineItem" DROP CONSTRAINT "POLineItem_poId_fkey";

-- DropForeignKey
ALTER TABLE "POLineItem" DROP CONSTRAINT "POLineItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "POPendingItem" DROP CONSTRAINT "POPendingItem_poId_fkey";

-- DropForeignKey
ALTER TABLE "POPendingItem" DROP CONSTRAINT "POPendingItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "PayrollRun" DROP CONSTRAINT "PayrollRun_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "Quotation" DROP CONSTRAINT "Quotation_customerId_fkey";

-- DropForeignKey
ALTER TABLE "QuotationLineItem" DROP CONSTRAINT "QuotationLineItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "QuotationLineItem" DROP CONSTRAINT "QuotationLineItem_quotationId_fkey";

-- DropForeignKey
ALTER TABLE "Refund" DROP CONSTRAINT "Refund_returnId_fkey";

-- DropForeignKey
ALTER TABLE "Return" DROP CONSTRAINT "Return_invoiceId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnLineItem" DROP CONSTRAINT "ReturnLineItem_invoiceLineItemId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnLineItem" DROP CONSTRAINT "ReturnLineItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnLineItem" DROP CONSTRAINT "ReturnLineItem_returnId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "ScheduledReport" DROP CONSTRAINT "ScheduledReport_templateId_fkey";

-- DropForeignKey
ALTER TABLE "StockAdjustment" DROP CONSTRAINT "StockAdjustment_productId_fkey";

-- DropForeignKey
ALTER TABLE "StockAdjustment" DROP CONSTRAINT "StockAdjustment_userId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";

-- DropForeignKey
ALTER TABLE "VendorReturn" DROP CONSTRAINT "VendorReturn_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "VendorReturnLineItem" DROP CONSTRAINT "VendorReturnLineItem_grnLineItemId_fkey";

-- DropForeignKey
ALTER TABLE "VendorReturnLineItem" DROP CONSTRAINT "VendorReturnLineItem_productId_fkey";

-- DropForeignKey
ALTER TABLE "VendorReturnLineItem" DROP CONSTRAINT "VendorReturnLineItem_vendorReturnId_fkey";

-- DropIndex
DROP INDEX "Account_isPartyControl_idx";

-- DropIndex
DROP INDEX "Account_name_key";

-- DropIndex
DROP INDEX "Account_partyType_partyId_idx";

-- DropIndex
DROP INDEX "Customer_phone_key";

-- DropIndex
DROP INDEX "Employee_cnic_key";

-- DropIndex
DROP INDEX "Employee_employeeNo_key";

-- DropIndex
DROP INDEX "Invoice_complaintId_key";

-- DropIndex
DROP INDEX "JournalEntry_entryDate_idx";

-- DropIndex
DROP INDEX "JournalEntry_idempotencyKey_key";

-- DropIndex
DROP INDEX "JournalEntry_sourceType_sourceId_idx";

-- DropIndex
DROP INDEX "JournalLine_accountId_idx";

-- DropIndex
DROP INDEX "JournalLine_journalEntryId_idx";

-- DropIndex
DROP INDEX "JournalLine_partyId_idx";

-- DropIndex
DROP INDEX "PayrollRun_employeeId_month_year_key";

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "isPartyControl",
DROP COLUMN "legacyAliases",
DROP COLUMN "partyId",
DROP COLUMN "partyType",
DROP COLUMN "updatedAt",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "address",
DROP COLUMN "cnic",
DROP COLUMN "notes",
DROP COLUMN "ntn",
DROP COLUMN "updatedAt",
ADD COLUMN     "addressText" TEXT NOT NULL,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "address",
DROP COLUMN "bankDetails",
DROP COLUMN "baseSalary",
DROP COLUMN "cnic",
DROP COLUMN "employeeNo",
DROP COLUMN "fatherName",
DROP COLUMN "fatherPhone",
DROP COLUMN "joiningDate",
DROP COLUMN "position",
DROP COLUMN "refPhone",
DROP COLUMN "responsiblePerson",
DROP COLUMN "updatedAt",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "employmentType" TEXT NOT NULL DEFAULT 'Full-time',
ADD COLUMN     "faceEnrolled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "faceTemplateUrl" TEXT,
ADD COLUMN     "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lastPingAt" TIMESTAMP(3),
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "probationEndDate" TIMESTAMP(3),
ADD COLUMN     "probationStatus" TEXT DEFAULT 'Confirmed',
ADD COLUMN     "reportingManagerId" TEXT,
ADD COLUMN     "role" TEXT NOT NULL,
ADD COLUMN     "salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'Active';

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "amountPaid",
DROP COLUMN "clientAddress",
DROP COLUMN "clientName",
DROP COLUMN "clientPhone",
DROP COLUMN "complaintId",
DROP COLUMN "date",
DROP COLUMN "dispatchStatus",
DROP COLUMN "doId",
DROP COLUMN "isAdvance",
DROP COLUMN "isGst",
DROP COLUMN "notes",
DROP COLUMN "subjectDescription",
DROP COLUMN "subjectHeading",
DROP COLUMN "totalAmount",
DROP COLUMN "updatedAt",
ADD COLUMN     "amount" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "customerName" TEXT NOT NULL,
ADD COLUMN     "jobId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'unpaid';

-- AlterTable
ALTER TABLE "JournalEntry" DROP COLUMN "entryDate",
DROP COLUMN "idempotencyKey",
DROP COLUMN "narration",
DROP COLUMN "sourceId",
DROP COLUMN "sourceType",
DROP COLUMN "updatedAt",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fiscalPeriodId" TEXT,
ADD COLUMN     "memo" TEXT NOT NULL,
ADD COLUMN     "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "postedBy" TEXT NOT NULL DEFAULT 'System',
ADD COLUMN     "refId" TEXT,
ADD COLUMN     "refType" TEXT NOT NULL,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversalOfId" TEXT,
ADD COLUMN     "reversedById" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'posted';

-- AlterTable
ALTER TABLE "JournalLine" DROP COLUMN "createdAt",
DROP COLUMN "partyId",
DROP COLUMN "updatedAt",
ALTER COLUMN "debit" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "credit" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PayrollRun" DROP COLUMN "absentDays",
DROP COLUMN "advanceDeductions",
DROP COLUMN "allowances",
DROP COLUMN "baseSalary",
DROP COLUMN "deductions",
DROP COLUMN "employeeId",
DROP COLUMN "messDeductions",
DROP COLUMN "month",
DROP COLUMN "netPay",
DROP COLUMN "notes",
DROP COLUMN "otherDeductions",
DROP COLUMN "overtimeAmount",
DROP COLUMN "overtimeHours",
DROP COLUMN "paymentAccount",
DROP COLUMN "paymentDate",
DROP COLUMN "paymentMethod",
DROP COLUMN "presentDays",
DROP COLUMN "totalDays",
DROP COLUMN "updatedAt",
DROP COLUMN "year",
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "period" TEXT NOT NULL,
ADD COLUMN     "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'Draft';

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "averageCost",
DROP COLUMN "category",
DROP COLUMN "incomingQty",
DROP COLUMN "onHandQty",
DROP COLUMN "salesPrice",
DROP COLUMN "updatedAt",
ADD COLUMN     "costPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "stockQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "unitPrice" DOUBLE PRECISION NOT NULL,
ALTER COLUMN "reorderLevel" SET DEFAULT 5,
ALTER COLUMN "reorderLevel" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PurchaseOrder" DROP COLUMN "discount",
DROP COLUMN "notes",
DROP COLUMN "updatedAt",
ADD COLUMN     "netPayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "prId" TEXT,
ADD COLUMN     "supplierEmail" TEXT NOT NULL,
ADD COLUMN     "supplierName" TEXT NOT NULL,
ADD COLUMN     "whtAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "vendorId" DROP NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'issued',
ALTER COLUMN "totalAmount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Quotation" DROP COLUMN "clientAddress",
DROP COLUMN "clientName",
DROP COLUMN "clientPhone",
DROP COLUMN "convertedInvoiceId",
DROP COLUMN "date",
DROP COLUMN "isGst",
DROP COLUMN "notes",
DROP COLUMN "subjectDescription",
DROP COLUMN "subjectHeading",
DROP COLUMN "updatedAt",
DROP COLUMN "validUntil",
ADD COLUMN     "remarks" TEXT,
ALTER COLUMN "customerId" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'draft',
ALTER COLUMN "totalAmount" DROP DEFAULT,
ALTER COLUMN "totalAmount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "StockLedger" DROP COLUMN "quantity",
DROP COLUMN "referenceDoc",
DROP COLUMN "runningBalance",
DROP COLUMN "timestamp",
DROP COLUMN "type",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "direction" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "qty" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "refId" TEXT,
ADD COLUMN     "refType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Vendor" DROP COLUMN "address",
DROP COLUMN "ntn",
DROP COLUMN "paymentTerms",
DROP COLUMN "updatedAt",
ADD COLUMN     "addressText" TEXT,
ADD COLUMN     "ntnNumber" TEXT,
ADD COLUMN     "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "strnNumber" TEXT,
ADD COLUMN     "whtExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whtRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ALTER COLUMN "contactPerson" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL;

-- DropTable
DROP TABLE "Attachment";

-- DropTable
DROP TABLE "Attendance";

-- DropTable
DROP TABLE "AuditLog";

-- DropTable
DROP TABLE "AuditSnapshot";

-- DropTable
DROP TABLE "Complaint";

-- DropTable
DROP TABLE "ComplaintTimeline";

-- DropTable
DROP TABLE "DOLineItem";

-- DropTable
DROP TABLE "DeliveryOrder";

-- DropTable
DROP TABLE "GRNLineItem";

-- DropTable
DROP TABLE "GoodsReceivedNote";

-- DropTable
DROP TABLE "InvoiceLineItem";

-- DropTable
DROP TABLE "LedgerEntry";

-- DropTable
DROP TABLE "LoginActivityLog";

-- DropTable
DROP TABLE "POLineItem";

-- DropTable
DROP TABLE "POPendingItem";

-- DropTable
DROP TABLE "PasswordResetToken";

-- DropTable
DROP TABLE "Payment";

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "ProactiveBriefing";

-- DropTable
DROP TABLE "QuotationLineItem";

-- DropTable
DROP TABLE "Refund";

-- DropTable
DROP TABLE "Return";

-- DropTable
DROP TABLE "ReturnLineItem";

-- DropTable
DROP TABLE "Role";

-- DropTable
DROP TABLE "RolePermission";

-- DropTable
DROP TABLE "SavedReportTemplate";

-- DropTable
DROP TABLE "ScheduledReport";

-- DropTable
DROP TABLE "StockAdjustment";

-- DropTable
DROP TABLE "SystemSetting";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "VendorReturn";

-- DropTable
DROP TABLE "VendorReturnLineItem";

-- DropEnum
DROP TYPE "AccountType";

-- CreateTable
CREATE TABLE "CareOfParty" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareOfParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "careOfPartyId" TEXT,
    "manualJobNumber" TEXT,
    "jobType" TEXT NOT NULL,
    "remarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Created',
    "assignedTechnicianId" TEXT,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountReason" TEXT,
    "qualityFlag" TEXT,
    "verifiedChecklist" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantityPlanned" DOUBLE PRECISION NOT NULL,
    "quantityActual" DOUBLE PRECISION,
    "unitRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "JobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobStatusHistory" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metaJson" TEXT,

    CONSTRAINT "JobStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryRequest" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "qtyRequested" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReturn" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "qtyReturned" DOUBLE PRECISION NOT NULL,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobExpenseClaim" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL,
    "receiptUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HisaabSettlement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "amountExpected" DOUBLE PRECISION NOT NULL,
    "amountCollected" DOUBLE PRECISION NOT NULL,
    "isFull" BOOLEAN NOT NULL DEFAULT false,
    "balanceDue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nextVisitDate" TIMESTAMP(3),
    "discountAmount" DOUBLE PRECISION,
    "settledBy" TEXT NOT NULL,
    "settledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HisaabSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TechnicianLedgerEntry" (
    "id" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "refJobId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TechnicianLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisition" (
    "id" TEXT NOT NULL,
    "prNumber" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequisitionItem" (
    "id" TEXT NOT NULL,
    "prId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PurchaseRequisitionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "poId" TEXT NOT NULL,
    "receivedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptItem" (
    "id" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityReceived" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "GoodsReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSale" (
    "id" TEXT NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "subtotal" DOUBLE PRECISION,
    "discountAmount" DOUBLE PRECISION DEFAULT 0,
    "taxAmount" DOUBLE PRECISION DEFAULT 0,
    "amountTendered" DOUBLE PRECISION,
    "changeGiven" DOUBLE PRECISION,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "customerName" TEXT DEFAULT 'Walk-in Customer',
    "customerPhone" TEXT,
    "cashierName" TEXT,
    "notes" TEXT,
    "status" TEXT DEFAULT 'completed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PosSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosRegisterSession" (
    "id" TEXT NOT NULL,
    "sessionNumber" TEXT NOT NULL,
    "cashierName" TEXT NOT NULL,
    "openingFloat" DOUBLE PRECISION NOT NULL,
    "closingCash" DOUBLE PRECISION,
    "expectedCash" DOUBLE PRECISION,
    "discrepancy" DOUBLE PRECISION,
    "totalSalesCount" INTEGER NOT NULL DEFAULT 0,
    "totalSalesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashSalesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cardSalesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashInTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashOutTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "PosRegisterSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalPeriod" (
    "id" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerLedgerEntry" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "runningBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "clearedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFullyCleared" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorLedgerEntry" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entryType" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "journalEntryId" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "runningBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "whtWithheld" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cprNumber" TEXT,
    "clearedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFullyCleared" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankStatementLine" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "valueDate" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "runningBalance" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'unreconciled',
    "matchedJournalLineId" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,
    "batchImportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankStatementLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "assetNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hrmAssetId" TEXT,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DOUBLE PRECISION NOT NULL,
    "salvageValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usefulLifeMonths" INTEGER NOT NULL DEFAULT 60,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'straight_line',
    "assetAccountCode" TEXT NOT NULL DEFAULT '1500',
    "accumDeprAccountCode" TEXT NOT NULL DEFAULT '1590',
    "deprExpenseAccountCode" TEXT NOT NULL DEFAULT '6350',
    "accumulatedDepreciation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bookValue" DOUBLE PRECISION NOT NULL,
    "lastDepreciationPeriod" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL DEFAULT 'Workman Services (Pvt) Ltd',
    "tradeName" TEXT DEFAULT 'Workman Services',
    "addressText" TEXT NOT NULL DEFAULT 'Main Boulevard, Gulberg III, Lahore, Pakistan',
    "phone" TEXT NOT NULL DEFAULT '042-111-WORKMAN',
    "email" TEXT NOT NULL DEFAULT 'finance@workmanservices.pk',
    "ntnNumber" TEXT DEFAULT '9482710-3',
    "strnNumber" TEXT DEFAULT '3277876123456',
    "baseCurrency" TEXT NOT NULL DEFAULT 'PKR',
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 7,
    "approvalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "isSetupCompleted" BOOLEAN NOT NULL DEFAULT false,
    "goLiveDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialAuditLog" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeValue" TEXT,
    "afterValue" TEXT,
    "userId" TEXT,
    "userName" TEXT NOT NULL DEFAULT 'System',
    "userRole" TEXT NOT NULL DEFAULT 'accountant',
    "ipAddress" TEXT DEFAULT '127.0.0.1',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeofenceZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusMeters" DOUBLE PRECISION NOT NULL DEFAULT 150,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceLog" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "faceMatchScore" DOUBLE PRECISION NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "geofenceZoneId" TEXT,
    "result" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "AttendanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAdvance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "approvedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossSalary" DOUBLE PRECISION NOT NULL,
    "advanceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expenseAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "projectNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "totalBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "plannedQty" DOUBLE PRECISION NOT NULL,
    "unitRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BOQItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "boqItemId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Created',
    "assignedTechnicianId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackCall" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "calledBy" TEXT NOT NULL,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "outcome" TEXT NOT NULL,
    "remarks" TEXT,
    "followUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRequisition" (
    "id" TEXT NOT NULL,
    "requisitionNumber" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobRequisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'Applied',
    "resumeUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateInterview" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "interviewer" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "salary" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklist" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "owner" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffboardingChecklist" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "owner" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OffboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitInterview" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "rehireEligible" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExitInterview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalSettlement" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "advanceDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expenseAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leaveEncashment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinalSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accrualRule" TEXT NOT NULL,
    "maxDays" DOUBLE PRECISION NOT NULL DEFAULT 22,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "accrued" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taken" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "daysCount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyHoliday" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,

    CONSTRAINT "CompanyHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'In Storage',
    "purchaseDate" TIMESTAMP(3),
    "currentEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAssignment" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedAt" TIMESTAMP(3),
    "conditionNotes" TEXT,
    "assignedBy" TEXT NOT NULL,

    CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrievanceTicket" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrievanceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrievanceComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrievanceComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrievanceStatusHistory" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrievanceStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" TEXT,
    "ipAddress" TEXT DEFAULT '127.0.0.1 (Local Session)',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RollbackLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityNumber" TEXT,
    "action" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "stateBefore" TEXT NOT NULL,
    "stateAfter" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rolledBackAt" TIMESTAMP(3),
    "rolledBackBy" TEXT,
    "canRollback" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RollbackLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequisition_prNumber_key" ON "PurchaseRequisition"("prNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_grnNumber_key" ON "GoodsReceipt"("grnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PosSale_saleNumber_key" ON "PosSale"("saleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PosRegisterSession_sessionNumber_key" ON "PosRegisterSession"("sessionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_assetNumber_key" ON "FixedAsset"("assetNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectNumber_key" ON "Project"("projectNumber");

-- CreateIndex
CREATE UNIQUE INDEX "JobRequisition_requisitionNumber_key" ON "JobRequisition"("requisitionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ExitInterview_employeeId_key" ON "ExitInterview"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_tag_key" ON "Asset"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "GrievanceTicket_ticketNumber_key" ON "GrievanceTicket"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Account_code_key" ON "Account"("code");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_careOfPartyId_fkey" FOREIGN KEY ("careOfPartyId") REFERENCES "CareOfParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobItem" ADD CONSTRAINT "JobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobStatusHistory" ADD CONSTRAINT "JobStatusHistory_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryRequest" ADD CONSTRAINT "InventoryRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReturn" ADD CONSTRAINT "StockReturn_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobExpenseClaim" ADD CONSTRAINT "JobExpenseClaim_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HisaabSettlement" ADD CONSTRAINT "HisaabSettlement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionItem" ADD CONSTRAINT "PurchaseRequisitionItem_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequisitionItem" ADD CONSTRAINT "PurchaseRequisitionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_prId_fkey" FOREIGN KEY ("prId") REFERENCES "PurchaseRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_poId_fkey" FOREIGN KEY ("poId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptItem" ADD CONSTRAINT "GoodsReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSaleItem" ADD CONSTRAINT "PosSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLedgerEntry" ADD CONSTRAINT "CustomerLedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorLedgerEntry" ADD CONSTRAINT "VendorLedgerEntry_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceLog" ADD CONSTRAINT "AttendanceLog_geofenceZoneId_fkey" FOREIGN KEY ("geofenceZoneId") REFERENCES "GeofenceZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAdvance" ADD CONSTRAINT "EmployeeAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assignedTechnicianId_fkey" FOREIGN KEY ("assignedTechnicianId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackCall" ADD CONSTRAINT "FeedbackCall_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "JobRequisition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateInterview" ADD CONSTRAINT "CandidateInterview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingChecklist" ADD CONSTRAINT "OffboardingChecklist_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitInterview" ADD CONSTRAINT "ExitInterview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalSettlement" ADD CONSTRAINT "FinalSettlement_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrievanceTicket" ADD CONSTRAINT "GrievanceTicket_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrievanceComment" ADD CONSTRAINT "GrievanceComment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "GrievanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrievanceStatusHistory" ADD CONSTRAINT "GrievanceStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "GrievanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

