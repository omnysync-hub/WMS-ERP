ALTER TABLE "CompanySettings"
  ADD COLUMN "invoicePrefix" TEXT NOT NULL DEFAULT 'INV',
  ADD COLUMN "invoiceNextNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "invoiceNumberPadding" INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "taxRules" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "paymentMethods" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "agingBuckets" JSONB NOT NULL DEFAULT '[30,60,90]',
  ADD COLUMN "expenseCategories" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "accountingPoliciesCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "financialAccountsCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "careOfSetupCompleted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "partyBalancesCompleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CareOfParty" ADD COLUMN "ledgerAccountId" TEXT;

CREATE TABLE "FinancialAccount" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "ledgerAccountId" TEXT NOT NULL,
  "bankName" TEXT,
  "accountTitle" TEXT,
  "accountNumberMasked" TEXT,
  "iban" TEXT,
  "branchCode" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartyOpeningBalance" (
  "id" TEXT NOT NULL,
  "partyType" TEXT NOT NULL,
  "partyId" TEXT NOT NULL,
  "partyName" TEXT NOT NULL,
  "postingDate" TIMESTAMP(3) NOT NULL,
  "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP(3),
  "documentNumber" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PartyOpeningBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialAccount_ledgerAccountId_key" ON "FinancialAccount"("ledgerAccountId");
CREATE INDEX "FinancialAccount_kind_isActive_idx" ON "FinancialAccount"("kind", "isActive");
CREATE UNIQUE INDEX "PartyOpeningBalance_partyType_partyId_key" ON "PartyOpeningBalance"("partyType", "partyId");
CREATE INDEX "PartyOpeningBalance_partyType_postingDate_idx" ON "PartyOpeningBalance"("partyType", "postingDate");
CREATE INDEX "CareOfParty_ledgerAccountId_idx" ON "CareOfParty"("ledgerAccountId");

ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_ledgerAccountId_fkey"
  FOREIGN KEY ("ledgerAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CareOfParty" ADD CONSTRAINT "CareOfParty_ledgerAccountId_fkey"
  FOREIGN KEY ("ledgerAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
