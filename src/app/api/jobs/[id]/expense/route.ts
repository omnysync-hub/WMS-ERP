export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";
import { validateReceiptUrl } from "@/lib/receiptUrl";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const gate = await requireJobsPermission(req, "jobs.expense_claim");
  if (gate.error) return gate.error;
  try {
    const body = await req.json();
    const { technicianId, amount, note, receiptUrl, category } = body;
    // Verified mobile technician: file strictly as self
    const isMobileTechnician =
      (req.headers.get("authorization") || "").startsWith("Bearer ") &&
      gate.actor.role === "technician";
    const techId =
      isMobileTechnician ? gate.actor.id : technicianId;
    if (!techId) {
      return NextResponse.json({ error: "technicianId required" }, { status: 400 });
    }
    const numericAmount = Number(amount);
    const cleanNote = typeof note === "string" ? note.trim() : "";
    const cleanCategory = typeof category === "string" ? category.trim().toUpperCase() : "";
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: "Expense amount must be greater than zero" }, { status: 400 });
    }
    if (numericAmount > 1_000_000) {
      return NextResponse.json({ error: "Expense amount exceeds the PKR 1,000,000 limit" }, { status: 400 });
    }
    const amountInCents = numericAmount * 100;
    if (Math.abs(amountInCents - Math.round(amountInCents)) > 1e-8) {
      return NextResponse.json({ error: "Expense amount can have at most two decimal places" }, { status: 400 });
    }
    if (cleanNote.length > 200) {
      return NextResponse.json({ error: "Expense note cannot exceed 200 characters" }, { status: 400 });
    }
    const settings = await prisma.companySettings.findFirst({ select: { expenseCategories: true } });
    const configuredCategories = Array.isArray(settings?.expenseCategories) ? settings.expenseCategories as Array<{ code?: string; active?: boolean }> : [];
    if (!cleanCategory || !configuredCategories.some((item) => item.active !== false && String(item.code || "").toUpperCase() === cleanCategory)) {
      return NextResponse.json({ error: "Select an active expense category configured in Accounting Onboarding." }, { status: 400 });
    }

    const receipt = validateReceiptUrl(receiptUrl);
    if (!receipt.ok) {
      return NextResponse.json({ error: receipt.error }, { status: 400 });
    }

    // Every claim (mobile or ERP-entered on a technician's behalf) must be for a job that
    // technician is actually assigned to.
    {
      const assignedJob = await prisma.job.findFirst({
        where: {
          id: params.id,
          OR: [
            { assignedTechnicianId: techId },
            {
              assignments: {
                some: { technicianId: techId, status: { not: "Removed" } },
              },
            },
          ],
        },
        select: { id: true },
      });
      if (!assignedJob) {
        return NextResponse.json(
          {
            error: isMobileTechnician
              ? "You can only log expenses for jobs assigned to you"
              : "This technician is not assigned to this job",
            code: "PERMISSION_DENIED",
          },
          { status: 403 }
        );
      }
    }

    const claim = await prisma.jobExpenseClaim.create({
      data: {
        jobId: params.id,
        technicianId: techId,
        amount: numericAmount,
        note: cleanNote || "Job expense",
        category: cleanCategory,
        receiptUrl: receipt.value,
        status: "pending",
      },
    });

    return NextResponse.json(claim, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
