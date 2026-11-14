/**
 * Repairs mismatches left in the data by bugs that are now fixed in the code.
 *
 *   npx tsx scripts/repair-legacy-mismatches.ts --dry-run   # report only (everything rolled back)
 *   npx tsx scripts/repair-legacy-mismatches.ts             # apply (one transaction)
 *
 * 1. HRM advances still "approved" although their GL voucher (Dr 11202) was voided
 *    -> advance marked "cancelled" (HRM = GL 11202).
 * 2. Job invoices that never got their invoice voucher (old generateCustomInvoice bug: the receipt
 *    posted, the invoice did not -> Revenue 0, AR negative) -> the voucher Dr AR / Cr Revenue / Cr tax
 *    is posted on the invoice's own date, plus the missing customer sub-ledger "invoice" line.
 *    Only when the job's current figures reproduce the invoice amount exactly; otherwise reported.
 * Safe to run again: fixed items are no longer picked up.
 */
import { prisma } from "../src/lib/prisma";
import { JobsService } from "../src/lib/services/JobsService";
import { SubLedgerService } from "../src/lib/services/SubLedgerService";

const DRY = process.argv.includes("--dry-run");
const ACTOR = "Data repair (accounts linking)";
class DryRunRollback extends Error {}

async function main() {
  const log: string[] = [];
  const skipped: string[] = [];

  // Read-only preparation outside the transaction.
  const invoices = await prisma.invoice.findMany({
    where: { jobId: { not: null }, status: { not: "cancelled" }, amount: { gt: 0 } },
    orderBy: { createdAt: "asc" },
  });
  const plans: Array<{ invoice: (typeof invoices)[number]; job: any; prep: any }> = [];
  for (const invoice of invoices) {
    const posted = await prisma.journalEntry.count({ where: { refType: "job_revenue", refId: invoice.jobId!, status: "posted" } });
    if (posted > 0) continue;
    const job = await prisma.job.findUnique({ where: { id: invoice.jobId! }, include: { items: true, customer: true } });
    if (!job) {
      skipped.push(`${invoice.invoiceNumber}: job not found`);
      continue;
    }
    if (job.isFoc) {
      skipped.push(`${invoice.invoiceNumber}: FOC job (revenue is booked through FOC payments)`);
      continue;
    }
    const prep = await JobsService.prepareJobRevenuePosting(job);
    if (Math.abs(prep.finalAmount - invoice.amount) >= 0.01) {
      skipped.push(`${invoice.invoiceNumber}: job lines now total PKR ${prep.finalAmount} but the invoice says PKR ${invoice.amount} - review by hand`);
      continue;
    }
    plans.push({ invoice, job, prep });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // 1. Advances whose voucher was voided.
        const approved = await tx.employeeAdvance.findMany({ where: { status: "approved" }, include: { employee: { select: { name: true } } } });
        for (const adv of approved) {
          const vouchers = await tx.journalEntry.findMany({ where: { refType: "advance_granted", refId: adv.id }, select: { status: true } });
          if (vouchers.length > 0 && !vouchers.some((v) => v.status === "posted")) {
            await tx.employeeAdvance.update({
              where: { id: adv.id },
              data: { status: "cancelled", notes: `${adv.notes || ""} [Cancelled: its GL voucher was reversed]`.trim() },
            });
            log.push(`advance  ${adv.employee?.name}: PKR ${adv.amount} -> cancelled (GL voucher was reversed)`);
          }
        }

        // 2. Missing invoice vouchers.
        for (const { invoice, job, prep } of plans) {
          const gl = await JobsService.syncJobRevenueGL(tx, job, prep, ACTOR, { date: invoice.createdAt });
          const hasSubledgerInvoice = invoice.customerId
            ? await tx.customerLedgerEntry.count({
                where: { customerId: invoice.customerId, entryType: "invoice", documentNumber: invoice.invoiceNumber },
              })
            : 1;
          if (!hasSubledgerInvoice && invoice.customerId) {
            await SubLedgerService.recordCustomerEntry({
              customerId: invoice.customerId,
              entryType: "invoice",
              documentNumber: invoice.invoiceNumber,
              journalEntryId: gl.revenueEntryId || undefined,
              debit: invoice.amount,
              credit: 0,
              notes: `Invoice ${invoice.invoiceNumber} for Job ${job.jobNumber} (missing entry restored)`,
              tx,
            });
          }
          log.push(
            `invoice  ${invoice.invoiceNumber} (${job.customer.name}) PKR ${invoice.amount}: voucher posted on ${invoice.createdAt.toISOString().slice(0, 10)}` +
              (hasSubledgerInvoice ? "" : " + customer sub-ledger line")
          );
        }

        if (DRY) throw new DryRunRollback();
      },
      { maxWait: 20000, timeout: 300000 }
    );
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }

  console.log(log.join("\n") || "(nothing to repair)");
  if (skipped.length) console.log("\nSkipped (need a person to look at them):\n" + skipped.map((s) => "  - " + s).join("\n"));
  console.log(`\n${log.length} repair(s) ${DRY ? "would be made (DRY RUN, rolled back)" : "applied"}.`);
}

main()
  .catch((e) => {
    console.error("Repair failed, nothing was changed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
