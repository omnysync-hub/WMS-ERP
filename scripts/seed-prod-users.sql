-- ==========================================================================
-- Workman Services ERP — Production Staff Accounts SQL Migration
-- Run directly on VPS PostgreSQL:
--   psql -U <postgres_user> -d <database_name> -f scripts/seed-prod-users.sql
-- ==========================================================================

-- 1. Invalidate any stale active sessions
UPDATE "ErpSession" SET "revokedAt" = NOW() WHERE "revokedAt" IS NULL;

-- 2. Upsert real production staff accounts (Names initialized blank for admin/user assignment)
INSERT INTO "ErpUser" (
  "id", "name", "username", "email", "passwordHash", "role", "designation", "department", "status", "avatar", "badgeColor", "isDemo", "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), '', 'admin', 'admin@workmanservices.pk', '$2b$12$vKLo8Ir3KzaBy9.tgxEvhetxpATuqvSykMi/rry6ujDakgBnpiBjy', 'admin', 'Managing Director & System Administrator', 'Executive Management', 'active', 'AD', 'bg-purple-600 text-white', false, false, 0, NOW(), NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "avatar" = EXCLUDED."avatar",
  "status" = 'active',
  "isDemo" = false,
  "mustChangePassword" = false,
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = NOW();

INSERT INTO "ErpUser" (
  "id", "name", "username", "email", "passwordHash", "role", "designation", "department", "status", "avatar", "badgeColor", "isDemo", "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), '', 'manager', 'operations@workmanservices.pk', '$2b$12$ulrE9ZIF6vairb0Suz0Y9eClkAHpuKWuRwMQl7mSwa0hhHjFTKnBO', 'manager', 'Operations Manager', 'Operations', 'active', 'MG', 'bg-violet-600 text-white', false, false, 0, NOW(), NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "avatar" = EXCLUDED."avatar",
  "status" = 'active',
  "isDemo" = false,
  "mustChangePassword" = false,
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = NOW();

INSERT INTO "ErpUser" (
  "id", "name", "username", "email", "passwordHash", "role", "designation", "department", "status", "avatar", "badgeColor", "isDemo", "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), '', 'dispatcher', 'dispatch@workmanservices.pk', '$2b$12$5D8kjUqUaVqt2g9NVnWDF.sB6FPXZSu7RgnI5aBYzcvBfM/fmVeua', 'dispatcher', 'Lead Dispatcher & Coordinator', 'Field Dispatch & Scheduling', 'active', 'DP', 'bg-blue-600 text-white', false, false, 0, NOW(), NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "avatar" = EXCLUDED."avatar",
  "status" = 'active',
  "isDemo" = false,
  "mustChangePassword" = false,
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = NOW();

INSERT INTO "ErpUser" (
  "id", "name", "username", "email", "passwordHash", "role", "designation", "department", "status", "avatar", "badgeColor", "isDemo", "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), '', 'accountant', 'accounts@workmanservices.pk', '$2b$12$4eaHbPyvAhzWJvREWg8hQ.puPxSK6vQtocJRkNC2DFklpsDCXdA76', 'accountant', 'Chief Financial Accountant', 'Finance & Accounts', 'active', 'AC', 'bg-emerald-600 text-white', false, false, 0, NOW(), NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "avatar" = EXCLUDED."avatar",
  "status" = 'active',
  "isDemo" = false,
  "mustChangePassword" = false,
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = NOW();

INSERT INTO "ErpUser" (
  "id", "name", "username", "email", "passwordHash", "role", "designation", "department", "status", "avatar", "badgeColor", "isDemo", "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), '', 'storekeeper', 'warehouse@workmanservices.pk', '$2b$12$OBVP6MCLtGhxQrZ7NAkGYOng./gBGMTl78XebkEWInQ4iPK71r/ry', 'storekeeper', 'Warehouse & Inventory Head', 'Central Warehouse', 'active', 'SK', 'bg-amber-600 text-white', false, false, 0, NOW(), NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "avatar" = EXCLUDED."avatar",
  "status" = 'active',
  "isDemo" = false,
  "mustChangePassword" = false,
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = NOW();

INSERT INTO "ErpUser" (
  "id", "name", "username", "email", "passwordHash", "role", "designation", "department", "status", "avatar", "badgeColor", "isDemo", "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), '', 'procurement', 'procurement@workmanservices.pk', '$2b$12$XuwsgKGXjWo2nqZwgPm1Ke/IigF8iYpKzgtdRwz.ju8CVdh/EK5HK', 'purchasing', 'Procurement & Sourcing Lead', 'Procurement & Sourcing', 'active', 'PR', 'bg-orange-600 text-white', false, false, 0, NOW(), NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "avatar" = EXCLUDED."avatar",
  "status" = 'active',
  "isDemo" = false,
  "mustChangePassword" = false,
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = NOW();

INSERT INTO "ErpUser" (
  "id", "name", "username", "email", "passwordHash", "role", "designation", "department", "status", "avatar", "badgeColor", "isDemo", "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), '', 'hr', 'hr@workmanservices.pk', '$2b$12$E04Rm5XBp1FkRY.X16OYF.PQV990cPryhrB/eU00UB9JnsGgDwNJW', 'hr', 'Human Resources Manager', 'Human Resources', 'active', 'HR', 'bg-pink-600 text-white', false, false, 0, NOW(), NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "avatar" = EXCLUDED."avatar",
  "status" = 'active',
  "isDemo" = false,
  "mustChangePassword" = false,
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = NOW();

INSERT INTO "ErpUser" (
  "id", "name", "username", "email", "passwordHash", "role", "designation", "department", "status", "avatar", "badgeColor", "isDemo", "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), '', 'cashier', 'cashier@workmanservices.pk', '$2b$12$o5Oii2mg3X1Dsah9iqIpRODJSKwyV4ltWT2b8u7AmY5wgwJOteM1e', 'cashier', 'Counter Cashier & POS Controller', 'Cash Desk & Retail', 'active', 'CS', 'bg-cyan-600 text-white', false, false, 0, NOW(), NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "avatar" = EXCLUDED."avatar",
  "status" = 'active',
  "isDemo" = false,
  "mustChangePassword" = false,
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = NOW();

INSERT INTO "ErpUser" (
  "id", "name", "username", "email", "passwordHash", "role", "designation", "department", "status", "avatar", "badgeColor", "isDemo", "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), '', 'callcenter', 'support@workmanservices.pk', '$2b$12$1EYiBJwdIF.dTuiEOSRGhew.9DRuLH7NOjGrR0K17ZNz2ZuQ08rQi', 'call_center', 'Customer Care & Intake Lead', 'Customer Care & Intake', 'active', 'CC', 'bg-teal-600 text-white', false, false, 0, NOW(), NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "avatar" = EXCLUDED."avatar",
  "status" = 'active',
  "isDemo" = false,
  "mustChangePassword" = false,
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = NOW();

INSERT INTO "ErpUser" (
  "id", "name", "username", "email", "passwordHash", "role", "designation", "department", "status", "avatar", "badgeColor", "isDemo", "mustChangePassword", "failedLoginAttempts", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), '', 'auditor', 'audit@workmanservices.pk', '$2b$12$Y/Njt0QsqB9hISqH7hbJuOoUlx8jiBs4.bnQwamMAvFx9fSYEgTuW', 'auditor', 'Internal Compliance Auditor', 'Governance & Audit', 'active', 'AU', 'bg-slate-700 text-white', false, false, 0, NOW(), NOW()
)
ON CONFLICT ("username") DO UPDATE SET
  "name" = EXCLUDED."name",
  "email" = EXCLUDED."email",
  "passwordHash" = EXCLUDED."passwordHash",
  "role" = EXCLUDED."role",
  "designation" = EXCLUDED."designation",
  "department" = EXCLUDED."department",
  "avatar" = EXCLUDED."avatar",
  "status" = 'active',
  "isDemo" = false,
  "mustChangePassword" = false,
  "failedLoginAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = NOW();
