export const dynamic = "force-dynamic";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";

const EXPENSE_CATEGORIES = [
  "Food",
  "Fuel",
  "Parking & Tolls",
  "Transport",
  "Materials",
  "Lodging",
  "Communication",
  "Other",
] as const;

function pakistanDayRange(dateText?: unknown) {
  const value = typeof dateText === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateText)
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

export async function POST(req: NextRequest) {
  const gate = await requireJobsPermission(req, "jobs.expense_claim");
  if (gate.error) return gate.error;

  try {
    const body = await req.json();
    const isMobileTechnician =
      (req.headers.get("authorization") || "").startsWith("Bearer ") &&
      gate.actor.role === "technician";
    const technicianId = isMobileTechnician ? gate.actor.id : body.technicianId;
    if (!technicianId) {
      return NextResponse.json({ error: "technicianId required" }, { status: 400 });
    }

    const amount = Number(body.amount);
    const amountInCents = Math.round(amount * 100);
    const note = typeof body.note === "string" ? body.note.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json(
        { error: "Expense amount must be between PKR 0.01 and PKR 1,000,000" },
        { status: 400 }
      );
    }
    if (Math.abs(amount * 100 - amountInCents) > 1e-8) {
      return NextResponse.json(
        { error: "Expense amount can have at most two decimal places" },
        { status: 400 }
      );
    }
    if (!EXPENSE_CATEGORIES.includes(category as (typeof EXPENSE_CATEGORIES)[number])) {
      return NextResponse.json({ error: "Choose a valid expense category" }, { status: 400 });
    }
    if (note.length > 180) {
      return NextResponse.json({ error: "Expense note cannot exceed 180 characters" }, { status: 400 });
    }
    if (category === "Other" && note.length < 3) {
      return NextResponse.json({ error: "Describe the other expense in at least 3 characters" }, { status: 400 });
    }

    const day = pakistanDayRange(body.expenseDate);
    const assignedToTechnician = {
      OR: [
        { assignedTechnicianId: technicianId },
        { assignments: { some: { technicianId, status: { not: "Removed" } } } },
      ],
    };
    const jobs = await prisma.job.findMany({
      where: {
        AND: [
          assignedToTechnician,
          { status: { notIn: ["Cancelled", "Canceled", "TechnicianReassigned"] } },
          {
            OR: [
              { createdAt: { gte: day.start, lt: day.end } },
              { finalizedAt: { gte: day.start, lt: day.end } },
              { statusHistory: { some: { changedAt: { gte: day.start, lt: day.end } } } },
              {
                assignments: {
                  some: {
                    technicianId,
                    status: { not: "Removed" },
                    assignedAt: { gte: day.start, lt: day.end },
                  },
                },
              },
            ],
          },
        ],
      },
      select: { id: true, jobNumber: true },
      orderBy: { createdAt: "asc" },
    });

    if (jobs.length === 0) {
      return NextResponse.json(
        { error: `No eligible jobs were handled on ${day.value}. Record the expense after a job is assigned or updated.` },
        { status: 409 }
      );
    }
    if (amountInCents < jobs.length) {
      return NextResponse.json(
        { error: `Expense is too small to divide across ${jobs.length} jobs` },
        { status: 400 }
      );
    }

    const allocationGroupId = crypto.randomUUID();
    const baseCents = Math.floor(amountInCents / jobs.length);
    const extraCents = amountInCents % jobs.length;
    const cleanNote = note || `${category} expense`;
    const claims = await prisma.$transaction(
      jobs.map((job, index) =>
        prisma.jobExpenseClaim.create({
          data: {
            jobId: job.id,
            technicianId,
            amount: (baseCents + (index < extraCents ? 1 : 0)) / 100,
            category,
            allocationGroupId,
            note: cleanNote,
            receiptUrl: typeof body.receiptUrl === "string" ? body.receiptUrl : null,
            status: "pending",
          },
        })
      )
    );

    return NextResponse.json(
      {
        id: allocationGroupId,
        allocationGroupId,
        amount: amountInCents / 100,
        category,
        note: cleanNote,
        expenseDate: day.value,
        status: "pending",
        allocationCount: claims.length,
        allocations: claims.map((claim, index) => ({
          claimId: claim.id,
          jobId: claim.jobId,
          jobNumber: jobs[index].jobNumber,
          amount: claim.amount,
        })),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not save expense";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
