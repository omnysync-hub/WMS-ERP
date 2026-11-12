-- Accounts Linking: per-rate tax lines on invoices (services PRA/SRB vs goods GST). Additive only.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "taxBreakdown" JSONB;
