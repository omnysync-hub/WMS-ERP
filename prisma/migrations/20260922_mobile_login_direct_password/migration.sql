-- Migration: 20260922_mobile_login_direct_password
-- Transition from one-time temp PIN to direct admin-managed mobile credentials

-- 1. Rename mobilePinHash to mobilePasswordHash if exists, else add
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'workman' AND table_name = 'Employee' AND column_name = 'mobilePinHash'
  ) THEN
    ALTER TABLE "workman"."Employee" RENAME COLUMN "mobilePinHash" TO "mobilePasswordHash";
  ELSE
    ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mobilePasswordHash" TEXT;
  END IF;
END $$;

-- 2. Rename mobilePinSetAt to mobilePasswordSetAt if exists, else add
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'workman' AND table_name = 'Employee' AND column_name = 'mobilePinSetAt'
  ) THEN
    ALTER TABLE "workman"."Employee" RENAME COLUMN "mobilePinSetAt" TO "mobilePasswordSetAt";
  ELSE
    ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mobilePasswordSetAt" TIMESTAMP(3);
  END IF;
END $$;

-- 3. Add mobileUsername column and unique index
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mobileUsername" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_mobileUsername_key" ON "workman"."Employee"("mobileUsername");

-- 4. Drop mustResetPinOnNextLogin
ALTER TABLE "workman"."Employee" DROP COLUMN IF EXISTS "mustResetPinOnNextLogin";
