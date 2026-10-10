export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const gate = await requireJobsPermission(req, "jobs.expense_claim");
  if (gate.error) return gate.error;
  try {
    const body = await req.json();
    const { technicianId, amount, note, receiptUrl } = body;
    // Verified mobile technician: file strictly as self
    const techId =
      (req.headers.get("authorization") || "").startsWith("Bearer ") && gate.actor.role === "technician"
        ? gate.actor.id
        : technicianId;
    if (!techId) {
      return NextResponse.json({ error: "technicianId required" }, { status: 400 });
    }
    if (!(Number(amount) > 0)) {
      return NextResponse.json({ error: "Expense amount must be greater than zero" }, { status: 400 });
    }

    const claim = await prisma.jobExpenseClaim.create({
      data: {
        jobId: params.id,
        technicianId: techId,
        amount: Number(amount) || 0,
        note: note || "Job expense",
        receiptUrl: receiptUrl || null,
        status: "pending",
      },
    });

    return NextResponse.json(claim, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
