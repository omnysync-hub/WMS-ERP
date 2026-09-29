export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";

export async function GET() {
  try {
    // Jobs awaiting hisaab settlement: Paused or CompletedPendingVerification
    const pendingJobs = await prisma.job.findMany({
      where: {
        status: { in: ["Paused", "CompletedPendingVerification"] },
      },
      include: {
        customer: true,
        assignedTechnician: true,
        items: true,
        expenseClaims: {
          where: { status: "pending" },
        },
        stockReturns: {
          orderBy: { createdAt: "desc" },
        },
        // Technician field reports awaiting accountant confirmation (no GL yet)
        hisaabSettlements: {
          orderBy: { settledAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(pendingJobs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { JobsService, isFieldReportedSettlement } from "@/lib/services/JobsService";
import { requireJobsPermission } from "@/lib/auth/erpActor";

export async function POST(req: NextRequest) {
  const gate = await requireJobsPermission(req, "jobs.collect_payment");
  if (gate.error) return gate.error;
  try {
    const body = await req.json();
    const {
      jobId,
      technicianId,
      amountExpected,
      amountCollected,
      settledBy = "Accountant",
      nextVisitDate,
      paidExpenseClaimIds = [],
      pendingExpenseClaimIds = [],
      disbursingAccountCode,
      partialPayoutAmount,
      adhocExpenses = [], // Verbal expenses written down by accountant [{ amount, note }]
      paymentMeans = "cash",
      finalizeAndLock = false,
    } = body;

    if (finalizeAndLock) {
      // Check before any mutation so a denied finalize doesn't leave a half-done hisaab
      const finGate = await requireJobsPermission(req, "jobs.finalize");
      if (finGate.error) return finGate.error;
    }
    if (!jobId) {
      return NextResponse.json({ error: "jobId required" }, { status: 400 });
    }

    const collected = Number(amountCollected) || 0;
    const expected = Number(amountExpected) || 0;
    const isFull = collected >= expected;
    const balanceDue = Math.max(0, expected - collected);

    // 1. If verbal/adhoc expenses were told to the accountant, create them immediately
    const createdAdhocClaimIds: string[] = [];
    if (Array.isArray(adhocExpenses) && adhocExpenses.length > 0) {
      for (const adhoc of adhocExpenses) {
        if (Number(adhoc.amount) > 0) {
          const claim = await prisma.jobExpenseClaim.create({
            data: {
              jobId,
              technicianId,
              amount: Number(adhoc.amount),
              note: `[Verbal Field Expense] ${adhoc.note || "Ad-hoc expense reported at settlement"}`,
              status: "pending",
            },
          });
          createdAdhocClaimIds.push(claim.id);
        }
      }
    }

    // Combine any paid claims + adhoc claims selected for payment
    const allClaimsToPay = [...paidExpenseClaimIds, ...createdAdhocClaimIds];

    // 2+3. Settlement + customer-collection GL, in ONE transaction.
    // If the technician already reported a field collection at completeJob, that row is
    // CONFIRMED/CONSUMED here (updated in place, status -> posted) instead of creating a
    // second settlement, and GL is synced to the confirmed amount exactly once (delta-only).
    const [cashAccount, arAccount] = collected > 0
      ? await Promise.all([
          AccountMappingService.resolveAccount({ transactionType: "settlement_collection_vault" }),
          AccountMappingService.resolveAccount({ transactionType: "settlement_collection_receivable" }),
        ])
      : [null, null];
    const meansLabel = paymentMeans ? `via ${String(paymentMeans).toUpperCase()}` : "in cash";

    const settlement = await prisma.$transaction(async (tx) => {
      const fieldReports = (
        await tx.hisaabSettlement.findMany({
          where: { jobId, ...(technicianId ? { technicianId } : {}) },
          orderBy: { settledAt: "desc" },
        })
      ).filter(isFieldReportedSettlement);

      let saved;
      if (fieldReports.length > 0) {
        const [primary, ...extra] = fieldReports;
        saved = await tx.hisaabSettlement.update({
          where: { id: primary.id },
          data: {
            amountExpected: expected,
            amountCollected: collected,
            isFull,
            balanceDue,
            nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null,
            settledBy: `${settledBy} (confirmed field report)`,
            accountantNotes: [
              primary.accountantNotes,
              `Field-reported PKR ${primary.amountCollected.toLocaleString()} by technician; accountant confirmed PKR ${collected.toLocaleString()} ${meansLabel}.`,
            ]
              .filter(Boolean)
              .join(" | "),
            status: "posted",
          },
        });
        // Any further duplicate field reports are folded in (excluded from totals)
        if (extra.length > 0) {
          await tx.hisaabSettlement.updateMany({
            where: { id: { in: extra.map((e) => e.id) } },
            data: { status: "superseded", accountantNotes: `Superseded by settlement ${primary.id}` },
          });
        }
      } else {
        saved = await tx.hisaabSettlement.create({
          data: {
            jobId,
            technicianId,
            amountExpected: expected,
            amountCollected: collected,
            isFull,
            balanceDue,
            nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null,
            settledBy,
            status: "posted",
          },
        });
      }

      if (cashAccount && arAccount) {
        await JobsService.syncSettlementCollectionGL(tx, {
          settlementId: saved.id,
          targetAmount: collected,
          vaultAccountId: cashAccount.id,
          receivableAccountId: arAccount.id,
          memo: `Field collection ${meansLabel} from customer on Job (Settled by ${settledBy})`,
          postedBy: settledBy,
          refType: "settlement_collection",
        });
      }
      return saved;
    }, { maxWait: 10000, timeout: 30000 });

    // 4. Handle Expense Reimbursements & Partial Payouts
    // Allocate funds across selected claims (clearExpense / clearJobExpenses split pattern):
    // fully covered -> paid; partially covered -> split paid portion vs remaining pending claim;
    // uncovered -> stay pending. Never mark all claims paid on a partial payout.
    if (allClaimsToPay.length > 0) {
      const claimsToPay = await prisma.jobExpenseClaim.findMany({
        where: { id: { in: allClaimsToPay } },
        orderBy: { createdAt: "asc" },
      });

      const totalApprovedExpenses = claimsToPay.reduce((sum, c) => sum + c.amount, 0);

      if (totalApprovedExpenses > 0) {
        const amountDisbursed =
          partialPayoutAmount !== undefined && partialPayoutAmount !== null && partialPayoutAmount !== ""
            ? Math.min(Number(partialPayoutAmount), totalApprovedExpenses)
            : totalApprovedExpenses;

        const remainingUnpaid = Math.max(0, Math.round((totalApprovedExpenses - amountDisbursed) * 100) / 100);
        const isPartial = amountDisbursed < totalApprovedExpenses;

        // Accounts lookup via AccountMappingService
        const expenseCostingAccount = await AccountMappingService.resolveAccount({ transactionType: "tech_expense_settlement_expense" });
        const disbursingAccount = disbursingAccountCode
          ? await AccountsPostingService.getAccountByCode(disbursingAccountCode)
          : await AccountMappingService.resolveAccount({ transactionType: "tech_expense_settlement_vault" });

        // Allocate disbursement across claims in creation order (same as clearJobExpenses)
        let remainingToAllocate = amountDisbursed;
        for (const claim of claimsToPay) {
          if (remainingToAllocate <= 0) {
            // No more funds - claim stays pending for a later clearance
            break;
          }

          if (remainingToAllocate >= claim.amount) {
            await prisma.jobExpenseClaim.update({
              where: { id: claim.id },
              data: { status: "paid", paidAt: new Date() },
            });
            remainingToAllocate = Math.round((remainingToAllocate - claim.amount) * 100) / 100;
          } else {
            // Partial cover: paid portion vs remaining unpaid claim
            const partialPaid = remainingToAllocate;
            const claimRemainder = Math.round((claim.amount - partialPaid) * 100) / 100;
            const originalNote = claim.note;

            await prisma.jobExpenseClaim.update({
              where: { id: claim.id },
              data: {
                amount: partialPaid,
                status: "paid",
                paidAt: new Date(),
                note: `${originalNote} [Partially Cleared: PKR ${partialPaid.toLocaleString()} via ${disbursingAccount.name} (${disbursingAccount.code}) at hisaab]`,
              },
            });

            await prisma.jobExpenseClaim.create({
              data: {
                jobId: claim.jobId,
                technicianId: claim.technicianId,
                amount: claimRemainder,
                note: `${originalNote} [Remaining Balance after PKR ${partialPaid.toLocaleString()} partial payout at hisaab]`,
                receiptUrl: claim.receiptUrl,
                status: "pending",
              },
            });

            remainingToAllocate = 0;
          }
        }

        // GL + ledger only for the amount actually disbursed now (remainder stays as pending claims)
        if (amountDisbursed > 0) {
          await AccountsPostingService.post({
            memo: `Technician expense settlement: $${amountDisbursed} disbursed via ${disbursingAccount.name}${isPartial ? ` ($${remainingUnpaid} remains as pending claims)` : ""}`,
            refType: "tech_expense_settlement",
            refId: settlement.id,
            lines: [
              { accountId: expenseCostingAccount.id, debit: amountDisbursed, credit: 0 },
              { accountId: disbursingAccount.id, debit: 0, credit: amountDisbursed },
            ],
          });

          await prisma.technicianLedgerEntry.create({
            data: {
              technicianId,
              type: "expense_paid",
              amount: amountDisbursed,
              refJobId: jobId,
              notes: `Expense reimbursement paid via ${disbursingAccount.name} (${disbursingAccount.code}) at settlement`,
            },
          });
        }
      }
    }

    // 5. Handle deferred pending expenses (carried into technician running balance)
    if (pendingExpenseClaimIds.length > 0) {
      const pendingClaims = await prisma.jobExpenseClaim.findMany({
        where: { id: { in: pendingExpenseClaimIds } },
      });

      for (const claim of pendingClaims) {
        await prisma.technicianLedgerEntry.create({
          data: {
            technicianId,
            type: "expense_owed",
            amount: claim.amount,
            refJobId: jobId,
            notes: `Pending expense voucher carried forward: ${claim.note}`,
          },
        });
      }
    }

    // 6. Sync & Lock Record (if requested by accountant)
    let finalizedJob = null;
    if (finalizeAndLock) {
      finalizedJob = await JobsService.finalizeJob(jobId, settledBy);
    }

    return NextResponse.json({
      success: true,
      settlement,
      finalized: !!finalizeAndLock,
      job: finalizedJob,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
