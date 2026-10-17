-- Staff ↔ attendance site assignments + optional zone metadata

ALTER TABLE "GeofenceZone" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "GeofenceZone" ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "EmployeeGeofenceAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeGeofenceAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeGeofenceAssignment_employeeId_zoneId_key"
  ON "EmployeeGeofenceAssignment"("employeeId", "zoneId");

CREATE INDEX IF NOT EXISTS "EmployeeGeofenceAssignment_employeeId_idx"
  ON "EmployeeGeofenceAssignment"("employeeId");

CREATE INDEX IF NOT EXISTS "EmployeeGeofenceAssignment_zoneId_idx"
  ON "EmployeeGeofenceAssignment"("zoneId");

DO $$ BEGIN
  ALTER TABLE "EmployeeGeofenceAssignment"
    ADD CONSTRAINT "EmployeeGeofenceAssignment_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "EmployeeGeofenceAssignment"
    ADD CONSTRAINT "EmployeeGeofenceAssignment_zoneId_fkey"
    FOREIGN KEY ("zoneId") REFERENCES "GeofenceZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
