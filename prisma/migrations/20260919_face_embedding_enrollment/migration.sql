-- Migration: 20260919_face_embedding_enrollment
-- Phase 2 Mobile Attendance Support: Face embedding enrollment tracking and optional liveness score

-- 1. AlterTable Employee: Add enrollment timestamp and counter for re-enrollment audits
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "faceEnrolledAt" TIMESTAMP(3);
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "faceEnrollmentCount" INTEGER NOT NULL DEFAULT 0;

-- 2. AlterTable AttendanceLog: Add anti-spoofing livenessScore captured during mobile check-in
ALTER TABLE "AttendanceLog" ADD COLUMN IF NOT EXISTS "livenessScore" DOUBLE PRECISION;
