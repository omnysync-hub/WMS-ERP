-- Migration: 20260919_geofenced_attendance_phase1
-- Phase 1: Geofenced Attendance Validation & Future Face Embedding Storage

-- Tradeoff Documentation (Option A vs Option B):
-- We chose Option A (Float[] / double precision[] array) for employee face embedding storage.
-- Reason: Provides 100% native Prisma Client TypeScript support (employee.faceEmbedding: number[]),
-- eliminating the need for raw SQL workarounds ($queryRaw / $executeRaw) during regular profile queries.
--
-- Future pgvector upgrade path:
-- When the face-matching ML embedding pipeline is live, run:
--   CREATE EXTENSION IF NOT EXISTS vector;
--   ALTER TABLE "Employee" ALTER COLUMN "faceEmbedding" TYPE vector(512) USING "faceEmbedding"::vector;

-- 1. AlterTable Employee: Add faceEmbedding storage
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "faceEmbedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[];

-- 2. AlterTable GeofenceZone: Add isActive flag for multi-office management
ALTER TABLE "GeofenceZone" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- 3. AlterTable AttendanceLog: Extend with geofence validation and audit review fields
ALTER TABLE "AttendanceLog" ADD COLUMN IF NOT EXISTS "deviceId" TEXT;
ALTER TABLE "AttendanceLog" ADD COLUMN IF NOT EXISTS "withinGeofence" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceLog" ADD COLUMN IF NOT EXISTS "flaggedForReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AttendanceLog" ADD COLUMN IF NOT EXISTS "flagReason" TEXT;
ALTER TABLE "AttendanceLog" ADD COLUMN IF NOT EXISTS "flagResolvedAt" TIMESTAMP(3);
ALTER TABLE "AttendanceLog" ADD COLUMN IF NOT EXISTS "flagResolvedBy" TEXT;
ALTER TABLE "AttendanceLog" ADD COLUMN IF NOT EXISTS "flagResolutionNotes" TEXT;
