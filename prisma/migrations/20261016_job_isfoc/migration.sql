-- Adds Job.isFoc (was added to schema.prisma without a migration).
-- IF NOT EXISTS: safe even if a previous `db push` already created it.
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "isFoc" BOOLEAN NOT NULL DEFAULT false;
