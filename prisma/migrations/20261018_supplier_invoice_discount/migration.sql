-- Feature: supplier bill discount (bill-level percent/amount + optional line-level percent).
-- Existing bills: discount 0, grossAmount backfilled from subtotal (no discount existed before).

ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "discountType" TEXT;
ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "lineDiscountTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SupplierInvoice" ADD COLUMN IF NOT EXISTS "grossAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
UPDATE "SupplierInvoice" SET "grossAmount" = "subtotal" WHERE "grossAmount" = 0 AND "subtotal" <> 0;

ALTER TABLE "SupplierInvoiceItem" ADD COLUMN IF NOT EXISTS "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "SupplierInvoiceItem" ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
