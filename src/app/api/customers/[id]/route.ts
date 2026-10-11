export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobsPermission } from "@/lib/auth/erpActor";
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

// POST: Add a Customer Ledger Entry (Payment receipt, manual debit/credit adjustment)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireJobsPermission(req, "jobs.create_job");
    if (gate.error) return gate.error;

    const { id } = await params;
    const body = await req.json();
    const {
      entryType, // "payment", "invoice", "credit_note", "opening_balance"
      documentNumber,
      amount,
      notes,
      actorName = "Accounts Officer",
    } = body;

    if (!entryType || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "Valid entry type and positive amount are required." },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        customerLedgerEntries: {
          orderBy: { postingDate: "desc" },
          take: 1,
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const isCredit = ["payment", "credit_note"].includes(entryType);
    const debit = isCredit ? 0 : Number(amount);
    const credit = isCredit ? Number(amount) : 0;

    const previousRunningBalance = customer.customerLedgerEntries[0]?.runningBalance || 0;
    const runningBalance = previousRunningBalance + debit - credit;

    const docNo =
      documentNumber ||
      `${entryType === "payment" ? "REC" : "ADJ"}-${Date.now().toString().slice(-6)}`;

    const entry = await prisma.customerLedgerEntry.create({
      data: {
        customerId: id,
        entryType,
        documentNumber: docNo,
        debit,
        credit,
        runningBalance,
        notes: notes || `Direct customer ${entryType} recorded by ${actorName}`,
      },
    });

    await AuditService.recordCrudAction({
      actorName,
      actorRole: "Accountant",
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
