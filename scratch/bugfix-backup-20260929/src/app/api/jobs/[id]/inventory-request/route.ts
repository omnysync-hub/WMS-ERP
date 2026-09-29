export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const { technicianId, item, qtyRequested } = body;

    const request = await prisma.inventoryRequest.create({
      data: {
        jobId: params.id,
        technicianId,
        item,
        qtyRequested: Number(qtyRequested) || 1,
        status: "pending",
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
