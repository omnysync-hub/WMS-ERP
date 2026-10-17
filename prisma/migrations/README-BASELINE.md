# Migration baseline (2026-10-16)

The build used to run `prisma db push --accept-data-loss`, which could silently drop columns.
It now runs `prisma migrate deploy`, which only applies the checked-in SQL in this folder.

* `0_init/` – the full schema as of commit 6a28395 (what production already has from db push).
* `20261016_job_isfoc/` – adds `Job.isFoc` (idempotent `IF NOT EXISTS`).
* `20261016_journal_idempotency_key/` – nullable unique `JournalEntry.idempotencyKey` (legacy rows stay NULL).
* The old partial migration folders were moved to `prisma/migrations_legacy/` (history only, not applied).

## ONE-TIME steps before the next deploy (run from a machine with the PRODUCTION DATABASE_URL)

1. Back up the database (Neon/Supabase snapshot or `pg_dump`).
2. Check for drift between production and the baseline (read-only):
   `npx prisma migrate diff --from-url "$DATABASE_URL" --to-migrations prisma/migrations --shadow-database-url "$SHADOW_DATABASE_URL" --script`
   (needs an empty scratch Postgres for the shadow URL). Expected output: only the isFoc / idempotencyKey
   statements, or nothing if they already exist. Anything else = production differs; stop and review.
3. If a `_prisma_migrations` table already exists with rows from the old folders, clear those rows:
   `DELETE FROM "_prisma_migrations";`  (it is only bookkeeping, no data).
4. Mark the baseline as already applied (does NOT run SQL):
   `npx prisma migrate resolve --applied 0_init`
5. Apply the two new migrations:
   `npx prisma migrate deploy`
6. Deploy (git push). From now on the Vercel build runs `prisma migrate deploy`.

Future schema changes: `npx prisma migrate dev --name <change>` locally against a dev DB, commit the folder.

## Duplicate check (only if you later want a unique index on JournalEntry(refType, refId))
```sql
SELECT "refType", "refId", COUNT(*) FROM "JournalEntry"
WHERE status = 'posted' AND "refType" <> 'reversal' AND "refId" IS NOT NULL
GROUP BY 1, 2 HAVING COUNT(*) > 1 ORDER BY 3 DESC;
```
Legitimate repeats exist by design (e.g. `expense_reimbursement` per job for batch payouts,
`opening_balance`/`GO_LIVE` after a reversal), which is why the separate `idempotencyKey` column was used.
