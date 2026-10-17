ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mobileDeviceId" TEXT;
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mobileDeviceLabel" TEXT;
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mobileSessionId" TEXT;
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mobileSessionStartedAt" TIMESTAMP(3);
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "lastMobileSessionAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Employee_mobileSessionId_key"
  ON "workman"."Employee"("mobileSessionId");
