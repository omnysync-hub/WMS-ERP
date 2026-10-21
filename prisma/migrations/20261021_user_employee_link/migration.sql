-- Link Settings › User Accounts (ErpUser) to HR (Employee). Additive only.
ALTER TABLE "ErpUser" ADD COLUMN IF NOT EXISTS "phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "erpUserId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_erpUserId_key" ON "Employee"("erpUserId");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_erpUserId_fkey" FOREIGN KEY ("erpUserId") REFERENCES "ErpUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
