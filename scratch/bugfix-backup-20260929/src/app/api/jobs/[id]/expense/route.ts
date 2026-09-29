export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { technicianId, amount, note, receiptUrl } = body;

    const claim = await prisma.jobExpenseClaim.create({
      data: {
        jobId: params.id,
        technicianId,
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
