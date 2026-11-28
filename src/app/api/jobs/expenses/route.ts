export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { JobsService } from "@/lib/services/JobsService";
import { AccountsPostingService } from "@/lib/services/AccountsPostingService";
import { AccountMappingService } from "@/lib/services/AccountMappingService";
import { realtimeSync } from "@/lib/realtimeSync";
import { isJobCompleted } from "@/lib/jobStatus";

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

    // Receipt-on-demand: the queue/list payloads never inline receipt photo bodies
    // (data URLs up to ~2.7M chars each); the client fetches a claim's photos only
    // when a thumbnail/lightbox is actually opened.
    const receiptFor = searchParams.get("receiptFor");
    if (receiptFor) {
      const claim = await prisma.jobExpenseClaim.findUnique({
        where: { id: receiptFor },
        select: { id: true, receiptUrl: true, receiptUrls: true },
      });
      if (!claim) {
        return NextResponse.json({ error: "Expense claim not found" }, { status: 404 });
      }
      const receiptUrls =
        claim.receiptUrls && claim.receiptUrls.length > 0
          ? claim.receiptUrls
          : claim.receiptUrl
            ? [claim.receiptUrl]
            : [];
      return NextResponse.json({ claimId: claim.id, receiptUrl: claim.receiptUrl, receiptUrls });
    }

    // Slim clearance queue: one flat row per PENDING claim across all technicians,
    // oldest first (peak-load fairness). No receipt bodies, no full job/customer
    // includes — just what the accountant needs to decide. Capped so an "all dates"
    // backlog can't produce an unbounded payload; `truncated` flags the cap.
    if (searchParams.get("queue") === "1") {
      const QUEUE_CAP = 500;
      const technicianFilter = searchParams.get("technicianId") || undefined;
      const rows = await prisma.jobExpenseClaim.findMany({
        where: {
          status: "pending",
          ...(technicianFilter ? { technicianId: technicianFilter } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: QUEUE_CAP + 1,
        select: {
          id: true,
          jobId: true,
          technicianId: true,
          amount: true,
          note: true,
          category: true,
          createdAt: true,
          accruedAt: true,
          receiptUrl: true,
          receiptUrls: true,
          job: {
            select: {
              jobNumber: true,
              status: true,
              finalizedAt: true,
              verifiedAt: true,
              customer: { select: { name: true } },
            },
          },
        },
      });
      const truncated = rows.length > QUEUE_CAP;
      const pageRows = truncated ? rows.slice(0, QUEUE_CAP) : rows;

      const techIds = [...new Set(pageRows.map((c) => c.technicianId))];
      const techs = techIds.length
        ? await prisma.employee.findMany({
            where: { id: { in: techIds } },
            select: { id: true, name: true },
          })
        : [];
      const techNameById = new Map(techs.map((t) => [t.id, t.name]));

      const claims = pageRows.map((c) => {
        const receiptCount =
          c.receiptUrls && c.receiptUrls.length > 0
            ? c.receiptUrls.length
            : c.receiptUrl
              ? 1
              : 0;
        return {
          id: c.id,
          jobId: c.jobId,
          jobNumber: c.job?.jobNumber || "—",
          customerName: c.job?.customer?.name || "Customer",
          technicianId: c.technicianId,
          technicianName: techNameById.get(c.technicianId) || "Technician",
          amount: c.amount,
          note: c.note,
          category: c.category || "General",
          createdAt: c.createdAt,
          accruedAt: c.accruedAt,
          hasReceipt: receiptCount > 0,
          receiptCount,
          isJobCompleted: c.job ? isJobCompleted(c.job) : false,
          jobStatus: c.job?.status,
          isPartial:
            c.note?.includes("[Partially Cleared") ||
            c.note?.includes("[Remaining Balance"),
        };
      });

      return NextResponse.json({
        queue: claims,
        summary: {
          pendingCount: claims.length,
          pendingTotal: Math.round(claims.reduce((s, c) => s + c.amount, 0) * 100) / 100,
          truncated,
        },
      });
    }

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
            receiptUrls: c.receiptUrls && c.receiptUrls.length > 0 ? c.receiptUrls : (c.receiptUrl ? [c.receiptUrl] : []),
            status: c.status,
            paidAt: c.paidAt,
            createdAt: c.createdAt,
            allocationGroupId: c.allocationGroupId,
            isPartial:
              c.note?.includes("[Partially Cleared") ||
              c.note?.includes("[Remaining Balance"),
            isJobCompleted: isJobCompleted(c.job),
            jobStatus: c.job?.status,
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
            // Per-job claim copies are used by the page for counts/totals only —
            // receipt photo bodies are NOT duplicated here (they ship once, on the
            // technician's itemized claims above, and on demand via ?receiptFor=).
            claims: (j.expenseClaims || []).map((c) => ({
              id: c.id,
              amount: c.amount,
              note: c.note,
              category: c.category || "General",
              receiptUrl: null,
              receiptUrls: [] as string[],
              hasReceipt: Boolean(c.receiptUrl) || (c.receiptUrls?.length || 0) > 0,
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
        include: { job: true },
        orderBy: { createdAt: "asc" },
      });

      // Claims can only be cleared if the underlying job is completed
      const eligibleClaims = pendingClaims.filter((c) => isJobCompleted(c.job));

      if (eligibleClaims.length === 0) {
        return NextResponse.json(
          {
            error: pendingClaims.length > 0
              ? "Cannot clear expenses: the associated work order(s) must be completed by the technician first."
              : "No pending expense claims to clear for this technician",
          },
          { status: 400 }
        );
      }

      const totalPending = eligibleClaims.reduce((sum, c) => sum + c.amount, 0);
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

      // Disburse across technician's eligible pending claims in sequence
      const clearedClaims = [];
      for (const claim of eligibleClaims) {
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

    if (action === "clear_claims_bulk") {
      // Bulk clearance for the peak-time queue: ONE request clears/pays many claims
      // across jobs and technicians. Each claim goes through the exact same
      // JobsService.clearExpense path as a single clear (its own transaction, its own
      // GL journal, its own idempotency key), so one bad claim never fails the batch
      // and money behaviour per claim is unchanged.
      const claimIds: string[] = Array.isArray(body.claimIds)
        ? [...new Set<string>(body.claimIds.filter((x: any) => typeof x === "string" && x))]
        : [];
      if (claimIds.length === 0) {
        return NextResponse.json(
          { error: "Select at least one pending claim to clear" },
          { status: 400 }
        );
      }
      if (claimIds.length > 200) {
        return NextResponse.json(
          { error: "At most 200 claims can be cleared in one batch" },
          { status: 400 }
        );
      }

      const claims = await prisma.jobExpenseClaim.findMany({
        where: { id: { in: claimIds } },
        select: { id: true, jobId: true, amount: true, status: true, createdAt: true },
        orderBy: { createdAt: "asc" }, // oldest first, same fairness as the queue
      });
      const foundIds = new Set(claims.map((c) => c.id));

      // Optional partial disbursement: allocate the given amount across the selected
      // claims oldest-first (same split pattern as clear_technician); claims beyond
      // the funded amount are reported back as skipped, untouched.
      const totalSelected = claims
        .filter((c) => c.status === "pending")
        .reduce((s, c) => s + c.amount, 0);
      let remainingFund =
        amountToPay !== undefined && amountToPay !== null && amountToPay !== ""
          ? Math.min(Number(amountToPay), totalSelected)
          : null; // null = pay every selected claim in full
      if (remainingFund !== null && (!Number.isFinite(remainingFund) || remainingFund <= 0)) {
        return NextResponse.json(
          { error: "Disbursement amount must be greater than zero" },
          { status: 400 }
        );
      }

      const results: Array<{
        claimId: string;
        success: boolean;
        paidNow?: number;
        isPartial?: boolean;
        error?: string;
      }> = [];

      for (const claimId of claimIds) {
        if (!foundIds.has(claimId)) {
          results.push({ claimId, success: false, error: "Claim not found" });
        }
      }

      for (const claim of claims) {
        if (claim.status !== "pending") {
          results.push({ claimId: claim.id, success: false, error: "Claim is already cleared/paid" });
          continue;
        }
        let payThis: number | undefined;
        if (remainingFund !== null) {
          if (remainingFund <= 0) {
            results.push({
              claimId: claim.id,
              success: false,
              error: "Not covered by the disbursement amount — left pending",
            });
            continue;
          }
          payThis = Math.min(remainingFund, claim.amount);
        }
        try {
          await JobsService.clearExpense(
            claim.jobId,
            claim.id,
            actorName,
            disbursingAccountCode,
            payThis,
            paymentNotes
          );
          const paidNow = payThis !== undefined ? payThis : claim.amount;
          if (remainingFund !== null) {
            remainingFund = Math.round((remainingFund - paidNow) * 100) / 100;
          }
          results.push({
            claimId: claim.id,
            success: true,
            paidNow,
            isPartial: paidNow < claim.amount,
          });
        } catch (err: any) {
          results.push({ claimId: claim.id, success: false, error: err.message || "Clearance failed" });
        }
      }

      const cleared = results.filter((r) => r.success);
      realtimeSync.publish("EXPENSE_CLEARED", {
        actor: actorName,
        message: `Bulk expense clearance by ${actorName}: ${cleared.length} claim(s) paid.`,
      });

      return NextResponse.json({
        success: true,
        results,
        clearedCount: cleared.length,
        failedCount: results.length - cleared.length,
        totalPaid: Math.round(cleared.reduce((s, r) => s + (r.paidNow || 0), 0) * 100) / 100,
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
