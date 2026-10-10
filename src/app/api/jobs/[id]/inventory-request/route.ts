export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const gate = await requireJobsPermission(req, "jobs.inventory_request");
  if (gate.error) return gate.error;
  try {
    const body = await req.json();
    const { technicianId, item, qtyRequested } = body;
    // Verified mobile technician: file strictly as self
    const techId =
      (req.headers.get("authorization") || "").startsWith("Bearer ") && gate.actor.role === "technician"
        ? gate.actor.id
        : technicianId;
    if (!techId || !item || !String(item).trim()) {
      return NextResponse.json({ error: "technicianId and item are required" }, { status: 400 });
    }

    const request = await prisma.inventoryRequest.create({
      data: {
        jobId: params.id,
        technicianId: techId,
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
