export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { technicianId, item, qtyReturned } = body;

    const returnRecord = await prisma.stockReturn.create({
      data: {
        jobId: params.id,
        technicianId,
        item,
        qtyReturned: Number(qtyReturned) || 1,
      },
    });

    return NextResponse.json(returnRecord, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
