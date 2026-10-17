export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { JobsService } from "@/lib/services/JobsService";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import { realtimeSync } from "@/lib/realtimeSync";

function pakistanDayRange(dateText?: unknown) {
  const value =
    typeof dateText === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateText)
      ? dateText
      : new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Karachi",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
  const start = new Date(`${value}T00:00:00+05:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { value, start, end };
}

export async function GET(req: NextRequest) {
  const gate = await requireJobsPermission(req, "jobs.view_financials");
  if (gate.error) return gate.error;

  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date") || undefined;
    const isAllDates = dateParam === "all";
    const day = isAllDates ? null : pakistanDayRange(dateParam);
    const technicianFilter = searchParams.get("technicianId");

    // Retrieve active technicians
    const technicians = await prisma.employee.findMany({
      where: {
        role: "technician",
        active: true,
        ...(technicianFilter ? { id: technicianFilter } : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    // Build claim date filter
    const claimDateFilter = day
      ? { createdAt: { gte: day.start, lt: day.end } }
      : {};

    // Retrieve all claims
    const claims = await prisma.jobExpenseClaim.findMany({
      where: {
        ...claimDateFilter,
        ...(technicianFilter ? { technicianId: technicianFilter } : {}),
      },
      include: {
        job: {
          include: {
            customer: true,
            assignedTechnician: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Find jobs handled by each technician on this date (or currently active)
    const technicianData = await Promise.all(
      technicians.map(async (tech) => {
        const techClaims = claims.filter((c) => c.technicianId === tech.id);

        // Find jobs assigned to or worked by this technician on the given day
        const jobsWhere: any = {
          OR: [
            { assignedTechnicianId: tech.id },
            { assignments: { some: { technicianId: tech.id, status: { not: "Removed" } } } },
          ],
          status: { notIn: ["Cancelled", "Canceled", "TechnicianReassigned"] },
        };

        if (day) {
          jobsWhere.AND = [
            {
              OR: [
                { createdAt: { gte: day.start, lt: day.end } },
                { finalizedAt: { gte: day.start, lt: day.end } },
                { statusHistory: { some: { changedAt: { gte: day.start, lt: day.end } } } },
                { status: { in: ["InProgress", "Assigned", "Accepted", "Paused", "CompletedPendingVerification"] } },
                { expenseClaims: { some: { technicianId: tech.id, createdAt: { gte: day.start, lt: day.end } } } },
              ],
            },
          ];
        }

        const handledJobs = await prisma.job.findMany({
          where: jobsWhere,
          include: {
            customer: true,
            expenseClaims: {
              where: {
                technicianId: tech.id,
                ...(day ? { createdAt: { gte: day.start, lt: day.end } } : {}),
              },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        const totalClaimed = techClaims.reduce((s, c) => s + c.amount, 0);
        const totalPending = techClaims
          .filter((c) => c.status === "pending")
          .reduce((s, c) => s + c.amount, 0);
        const totalPaid = techClaims
          .filter((c) => c.status === "paid")
          .reduce((s, c) => s + c.amount, 0);

        const hasPartial = techClaims.some(
          (c) =>
            c.note?.includes("[Partially Cleared") ||
            c.note?.includes("[Remaining Balance")
        );

        return {
          id: tech.id,
          name: tech.name,
          phone: tech.phone,
          email: tech.email,
          role: tech.role,
          totalClaimed,
          totalPending,
          totalPaid,
          hasPending: totalPending > 0,
          hasPartial,
          isAllCleared: totalPending === 0 && totalClaimed > 0,
          claimsCount: techClaims.length,
          claims: techClaims.map((c) => ({
            id: c.id,
            jobId: c.jobId,
            jobNumber: c.job?.jobNumber || "—",
            customerName: c.job?.customer?.name || "Customer",
            amount: c.amount,
            note: c.note,
            category: c.category || "General",
            receiptUrl: c.receiptUrl,
            status: c.status,
            paidAt: c.paidAt,
            createdAt: c.createdAt,
            allocationGroupId: c.allocationGroupId,
            isPartial:
              c.note?.includes("[Partially Cleared") ||
              c.note?.includes("[Remaining Balance"),
          })),
          jobs: handledJobs.map((j) => ({
            id: j.id,
            jobNumber: j.jobNumber,
            jobType: j.jobType,
            status: j.status,
            customer: {
              name: j.customer?.name || "Customer",
              phone: j.customer?.phone || "",
              addressText: j.customer?.addressText || "",
            },
            claims: (j.expenseClaims || []).map((c) => ({
              id: c.id,
              amount: c.amount,
              note: c.note,
              category: c.category || "General",
              receiptUrl: c.receiptUrl,
              status: c.status,
              paidAt: c.paidAt,
              createdAt: c.createdAt,
              isPartial:
                c.note?.includes("[Partially Cleared") ||
                c.note?.includes("[Remaining Balance"),
            })),
          })),
        };
      })
    );

    // Filter to technicians that have claims or active jobs on this date (unless filtered explicitly)
    const activeTechnicians = technicianFilter
      ? technicianData
      : technicianData.filter((t) => t.claimsCount > 0 || t.jobs.length > 0);

    const grandClaimed = activeTechnicians.reduce((s, t) => s + t.totalClaimed, 0);
    const grandPending = activeTechnicians.reduce((s, t) => s + t.totalPending, 0);
    const grandPaid = activeTechnicians.reduce((s, t) => s + t.totalPaid, 0);
    const techniciansWithPending = activeTechnicians.filter((t) => t.totalPending > 0).length;

    return NextResponse.json({
      date: day ? day.value : "all",
      isAllDates,
      summary: {
        totalClaimed: grandClaimed,
        totalPending: grandPending,
        totalPaid: grandPaid,
        activeTechniciansCount: activeTechnicians.length,
        pendingTechniciansCount: techniciansWithPending,
        totalClaimsCount: claims.length,
      },
      technicians: activeTechnicians,
    });
  } catch (err: any) {
    console.error("[GET /api/jobs/expenses] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function POST(req: NextRequest) {
  // Paying out money: same permission as the job-level clear_expense action (jobs.collect_payment).
  const gate = await requireJobsPermission(req, "jobs.collect_payment");
  if (gate.error) return gate.error;

  try {
    const body = await req.json();
    const { action, claimId, jobId, technicianId, amountToPay, disbursingAccountCode, paymentNotes } = body;
    const actorName = gate.actor.name || "Accountant";

    if (action === "clear_claim" && claimId && jobId) {
      const result = await JobsService.clearExpense(
        jobId,
        claimId,
        actorName,
        disbursingAccountCode,
        amountToPay !== undefined && amountToPay !== null && amountToPay !== ""
          ? Number(amountToPay)
          : undefined,
        paymentNotes
      );

      realtimeSync.publish("EXPENSE_CLEARED", {
        jobId,
        claimId,
        actor: actorName,
        message: `Expense claim cleared by ${actorName}.`,
      });

      return NextResponse.json({ success: true, result });
    }

    if (action === "clear_job" && jobId) {
      const result = await JobsService.clearJobExpenses(
        jobId,
        actorName,
        disbursingAccountCode,
        amountToPay !== undefined && amountToPay !== null && amountToPay !== ""
          ? Number(amountToPay)
          : undefined,
        paymentNotes
      );

      realtimeSync.publish("EXPENSE_CLEARED", {
        jobId,
        actor: actorName,
        message: `Job expense claims cleared by ${actorName}.`,
      });

      return NextResponse.json({ success: true, result });
    }

    if (action === "clear_technician" && technicianId) {
      // Find all pending claims for this technician (filtered optionally by date)
      const day = body.date && body.date !== "all" ? pakistanDayRange(body.date) : null;
      const pendingClaims = await prisma.jobExpenseClaim.findMany({
        where: {
          technicianId,
          status: "pending",
          ...(day ? { createdAt: { gte: day.start, lt: day.end } } : {}),
        },
        orderBy: { createdAt: "asc" },
      });

      if (pendingClaims.length === 0) {
        return NextResponse.json(
          { error: "No pending expense claims to clear for this technician" },
          { status: 400 }
        );
      }

      const totalPending = pendingClaims.reduce((sum, c) => sum + c.amount, 0);
      let remainingFund =
        amountToPay !== undefined && amountToPay !== null && Number(amountToPay) > 0
          ? Math.min(Number(amountToPay), totalPending)
          : totalPending;

      if (remainingFund <= 0) {
        return NextResponse.json(
          { error: "Disbursement amount must be greater than zero" },
          { status: 400 }
        );
      }

      // Disburse across technician's pending claims in sequence
      const clearedClaims = [];
      for (const claim of pendingClaims) {
        if (remainingFund <= 0) break;
        const payThis = Math.min(remainingFund, claim.amount);
        const updated = await JobsService.clearExpense(
          claim.jobId,
          claim.id,
          actorName,
          disbursingAccountCode,
          payThis,
          paymentNotes
        );
        clearedClaims.push(updated);
        remainingFund = Math.round((remainingFund - payThis) * 100) / 100;
      }

      realtimeSync.publish("EXPENSE_CLEARED", {
        technicianId,
        actor: actorName,
        message: `Technician daily expenses cleared by ${actorName}.`,
      });

      return NextResponse.json({
        success: true,
        clearedCount: clearedClaims.length,
        disbursed: amountToPay || totalPending,
      });
    }

    return NextResponse.json(
      { error: "Invalid action or missing required parameters" },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[POST /api/jobs/expenses] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
