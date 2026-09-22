-- Migration: 20260922_mobile_login_lifecycle
-- Mobile Login Lifecycle: Credential provisioning, PIN hashing, forced reset on first login, and brute-force lockout

-- 1. AlterTable Employee: Add mobile login lifecycle fields
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mobileLoginActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mobilePinHash" TEXT;
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mobilePinSetAt" TIMESTAMP(3);
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "mustResetPinOnNextLogin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "workman"."Employee" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
