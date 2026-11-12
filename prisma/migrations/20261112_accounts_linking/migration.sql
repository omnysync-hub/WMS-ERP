-- Accounts Linking: payroll liabilities (Salaries Payable / WHT Sec 149 / EOBI-PESSI). Additive only.
-- Account recode (5-digit COA), new ledgers and mapping changes are data changes:
-- run `npx tsx scripts/recode-coa-5digit.ts` after deploying this migration.
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "monthlyIncomeTax" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "eobiEmployeeShare" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "eobiEmployerShare" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "paidFromAccountCode" TEXT;
ALTER TABLE "PayrollRun" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "taxDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "eobiDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Payslip" ADD COLUMN IF NOT EXISTS "employerEobi" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FixedAsset" ALTER COLUMN "assetAccountCode" SET DEFAULT '15101';
ALTER TABLE "FixedAsset" ALTER COLUMN "accumDeprAccountCode" SET DEFAULT '15190';
ALTER TABLE "FixedAsset" ALTER COLUMN "deprExpenseAccountCode" SET DEFAULT '64101';
