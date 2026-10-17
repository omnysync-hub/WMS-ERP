export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobsPermission, requirePermission } from "@/lib/auth/erpActor";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { SubLedgerService } from "@/lib/services/SubLedgerService";
import { AuditService } from "@/lib/services/AuditService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireJobsPermission(req, "jobs.view_directory");
    if (gate.error) return gate.error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        jobs: {
          include: {
            assignedTechnician: {
              select: { id: true, name: true, phone: true },
            },
            items: true,
            feedbackCalls: {
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        projects: {
          orderBy: { createdAt: "desc" },
        },
        customerLedgerEntries: {
          orderBy: { postingDate: "desc" },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Aggregate Customer 360 KPIs
    const totalJobs = customer.jobs.length;
    const completedJobs = customer.jobs.filter((j) =>
      ["CompletedPendingVerification", "Verified", "Closed"].includes(j.status)
    ).length;
    const activeJobs = customer.jobs.filter((j) =>
      ["PendingAssignment", "Assigned", "InProgress", "AwaitingFeedback"].includes(j.status)
    ).length;

    // Financial ledger calculations
    const totalDebits = customer.customerLedgerEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredits = customer.customerLedgerEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
    const ledgerBalance = totalDebits - totalCredits;

    // Collect all complaints / feedback calls across all jobs
    const allFeedbackCalls = customer.jobs.flatMap((j) =>
      (j.feedbackCalls || []).map((call) => ({
        ...call,
        jobNumber: j.jobNumber,
        jobType: j.jobType,
        jobStatus: j.status,
      }))
    ).sort((a, b) => new Date(b.calledAt).getTime() - new Date(a.calledAt).getTime());

    // Extract all serviced equipment history across all jobs
    const equipmentHistory: any[] = [];
    customer.jobs.forEach((job) => {
      if (job.remarks) {
        try {
          const parsed = JSON.parse(job.remarks);
          if (Array.isArray(parsed.equipments)) {
            parsed.equipments.forEach((eq: any) => {
              equipmentHistory.push({
                ...eq,
                jobId: job.id,
                jobNumber: job.jobNumber,
                serviceDate: job.createdAt,
                technicianName: job.assignedTechnician?.name,
              });
            });
          } else if (parsed.equipment) {
            equipmentHistory.push({
              ...parsed.equipment,
              jobId: job.id,
              jobNumber: job.jobNumber,
              serviceDate: job.createdAt,
              technicianName: job.assignedTechnician?.name,
            });
          }
        } catch {
          // remarks wasn't json, skip
        }
      }
    });

    return NextResponse.json({
      ...customer,
      stats: {
        totalJobs,
        completedJobs,
        activeJobs,
        totalProjects: customer.projects.length,
        totalDebits,
        totalCredits,
        ledgerBalance,
        totalFeedbackCalls: allFeedbackCalls.length,
      },
      allFeedbackCalls,
      equipmentHistory,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Add a Customer Ledger Entry (payment receipt, manual debit/credit adjustment).
// Always posts a balanced GL journal and the customer sub-ledger row in ONE transaction,
// so the AR control account and the customer sub-ledger cannot drift apart.
const CUSTOMER_ENTRY_TYPES = new Set(["payment", "invoice", "debit_note", "credit_note"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Financial write: accounts permission (was jobs.create_job).
    const gate = requirePermission(req, "accounts.general_ledger");
    if (gate.error) return gate.error;

    const { id } = await params;
    const body = await req.json();
    const { entryType, documentNumber, notes, receivingAccountCode } = body;
    const actorName = gate.actor.name || "Accounts Officer";
    const amount = Math.round(Number(body.amount) * 100) / 100;

    if (!CUSTOMER_ENTRY_TYPES.has(entryType)) {
      return NextResponse.json(
        { error: "Entry type must be payment, invoice, debit_note or credit_note. Opening balances are entered in Setup." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000) {
      return NextResponse.json({ error: "A positive amount is required." }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const isCredit = entryType === "payment" || entryType === "credit_note";
    const debit = isCredit ? 0 : amount;
    const credit = isCredit ? amount : 0;
    const docNo =
      (typeof documentNumber === "string" && documentNumber.trim().slice(0, 64)) ||
      `${entryType === "payment" ? "REC" : "ADJ"}-${Date.now().toString().slice(-8)}`;

    const entry = await prisma.$transaction(async (tx) => {
      const arAccount = await AccountMappingService.resolveAccount({
        transactionType: "customer_payment_receivable",
        prismaClient: tx,
      });
      let contraAccountId: string;
      if (entryType === "payment") {
        const explicit = typeof receivingAccountCode === "string" && receivingAccountCode.trim()
          ? await tx.account.findFirst({ where: { code: receivingAccountCode.trim(), isActive: true } })
          : null;
        const receiving = explicit || (await AccountMappingService.resolveAccount({
          transactionType: "customer_payment_receiving",
          prismaClient: tx,
        }));
        contraAccountId = receiving.id;
      } else {
        const revenue = await AccountMappingService.resolveAccount({
          transactionType: "job_revenue_sales",
          prismaClient: tx,
        });
        contraAccountId = revenue.id;
      }

      const journal = await AccountsPostingService.post({
        memo: `Customer ${entryType.replace("_", " ")} ${docNo} - ${customer.name}`,
        refType: entryType === "payment" ? "customer_payment" : "customer_adjustment",
        refId: customer.id,
        postedBy: actorName,
        lines: isCredit
          ? [
              { accountId: contraAccountId, debit: amount, credit: 0 },
              { accountId: arAccount.id, debit: 0, credit: amount },
            ]
          : [
              { accountId: arAccount.id, debit: amount, credit: 0 },
              { accountId: contraAccountId, debit: 0, credit: amount },
            ],
        tx,
      });

      return SubLedgerService.recordCustomerEntry({
        customerId: customer.id,
        entryType,
        documentNumber: docNo,
        journalEntryId: journal.id,
        debit,
        credit,
        notes: (typeof notes === "string" && notes.trim().slice(0, 500)) || `Direct customer ${entryType} recorded by ${actorName}`,
        tx,
      });
    });

    await AuditService.recordCrudAction({
      actorName,
      actorRole: gate.actor.role,
      actionType: "FINANCIAL",
      entityType: "CustomerLedgerEntry",
      entityId: entry.id,
      entityNumber: docNo,
      description: `Customer Ledger Entry ${docNo} (${entryType}: PKR ${amount}) for customer ${customer.name}`,
      stateAfter: entry,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
