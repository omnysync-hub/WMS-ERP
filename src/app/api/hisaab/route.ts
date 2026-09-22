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
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(pendingJobs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { JobsService } from "@/lib/services/JobsService";

export async function POST(req: NextRequest) {
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
      disbursingAccountCode = "1000",
      partialPayoutAmount,
      adhocExpenses = [], // Verbal expenses written down by accountant [{ amount, note }]
      paymentMeans = "cash",
      finalizeAndLock = false,
    } = body;

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

    // 2. Create HisaabSettlement record
    const settlement = await prisma.hisaabSettlement.create({
      data: {
        jobId,
        technicianId,
        amountExpected: expected,
        amountCollected: collected,
        isFull,
        balanceDue,
        nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null,
        settledBy,
      },
    });

    // 3. Post Customer Collection to Accounts Posting Engine
    if (collected > 0) {
      // Receiving account based on collection means via AccountMappingService
      const cashAccount = await AccountMappingService.resolveAccount({ transactionType: "settlement_collection_vault" });
      const arAccount = await AccountMappingService.resolveAccount({ transactionType: "settlement_collection_receivable" });

      const meansLabel = paymentMeans ? `via ${paymentMeans.toUpperCase()}` : "in cash";
      await AccountsPostingService.post({
        memo: `Field collection ${meansLabel} from customer on Job (Settled by ${settledBy})`,
        refType: "settlement_collection",
        refId: settlement.id,
        lines: [
          { accountId: cashAccount.id, debit: collected, credit: 0 },
          { accountId: arAccount.id, debit: 0, credit: collected },
        ],
      });
    }

    // 4. Handle Expense Reimbursements & Partial Payouts
    if (allClaimsToPay.length > 0) {
      const claimsToPay = await prisma.jobExpenseClaim.findMany({
        where: { id: { in: allClaimsToPay } },
      });

      const totalApprovedExpenses = claimsToPay.reduce((sum, c) => sum + c.amount, 0);

      if (totalApprovedExpenses > 0) {
        // Determine partial or full payout
        // If partialPayoutAmount is provided, accountant disburses whatever cash is available now
        const amountDisbursed =
          partialPayoutAmount !== undefined && partialPayoutAmount !== null && partialPayoutAmount !== ""
            ? Math.min(Number(partialPayoutAmount), totalApprovedExpenses)
            : totalApprovedExpenses;

        const remainingUnpaid = Math.max(0, totalApprovedExpenses - amountDisbursed);

        // Mark claims as paid/processed
        await prisma.jobExpenseClaim.updateMany({
          where: { id: { in: allClaimsToPay } },
          data: { status: "paid", paidAt: new Date() },
        });

        // Accounts lookup via AccountMappingService
        const expenseCostingAccount = await AccountMappingService.resolveAccount({ transactionType: "tech_expense_settlement_expense" });
        const disbursingAccount = disbursingAccountCode && disbursingAccountCode !== "1000"
          ? await AccountsPostingService.getAccountByCode(disbursingAccountCode)
          : await AccountMappingService.resolveAccount({ transactionType: "tech_expense_settlement_vault" });
        const techPayableAccount = await AccountMappingService.resolveAccount({ transactionType: "tech_expense_settlement_payable" });

        // Journal Lines
        const postingLines = [
          { accountId: expenseCostingAccount.id, debit: totalApprovedExpenses, credit: 0 },
        ];

        // If some cash was paid out now:
        if (amountDisbursed > 0) {
          postingLines.push({
            accountId: disbursingAccount.id,
            debit: 0,
            credit: amountDisbursed,
          });

          // Record paid amount on technician ledger
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

        // If accountant didn't have enough resources and remainder is unpaid:
        if (remainingUnpaid > 0) {
          postingLines.push({
            accountId: techPayableAccount.id,
            debit: 0,
            credit: remainingUnpaid,
          });

          // Record unpaid balance on technician running ledger (company owes technician)
          await prisma.technicianLedgerEntry.create({
            data: {
              technicianId,
              type: "expense_owed",
              amount: remainingUnpaid,
              refJobId: jobId,
              notes: `Unpaid expense balance carried forward (insufficient cash on hand; to be settled later). Disbursed: $${amountDisbursed}, Pending: $${remainingUnpaid}`,
            },
          });
        }

        // Post balanced journal entry to general ledger
        await AccountsPostingService.post({
          memo: `Technician expense settlement: $${amountDisbursed} disbursed via ${disbursingAccount.name}, $${remainingUnpaid} carried to Tech Payable`,
          refType: "tech_expense_settlement",
          refId: settlement.id,
          lines: postingLines,
        });
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
