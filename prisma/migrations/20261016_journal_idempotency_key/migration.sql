-- Business idempotency key for journal entries. Nullable: every existing row stays NULL,
-- so this cannot collide with legacy data. Postgres unique indexes allow many NULLs.
ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_idempotencyKey_key" ON "JournalEntry"("idempotencyKey");
