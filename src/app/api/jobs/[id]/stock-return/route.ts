export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";
import { InventoryService } from "@/lib/services/InventoryService";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const gate = await requireJobsPermission(req, "jobs.stock_return_request");
  if (gate.error) return gate.error;
  try {
    const body = await req.json();
    const { technicianId, item, qtyReturned, productId, jobItemId } = body;
    // Verified mobile technician: file strictly as self
    const techId =
      (req.headers.get("authorization") || "").startsWith("Bearer ") && gate.actor.role === "technician"
        ? gate.actor.id
        : technicianId;
    if (!techId || !item || !String(item).trim()) {
      return NextResponse.json({ error: "technicianId and item are required" }, { status: 400 });
    }
    // Link the warehouse product now when resolvable (storekeeper acknowledge requires it).
    // Pause/resume never waits on this: filing a return request is optional and non-blocking.
    let resolvedProductId: string | null = null;
    try {
      const product = await InventoryService.resolveReturnProduct(prisma, {
        productId: productId || null,
        jobItemId: jobItemId || null,
        item,
      });
      resolvedProductId = product?.id ?? null;
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const returnRecord = await prisma.stockReturn.create({
      data: {
        jobId: params.id,
        technicianId: techId,
        item,
        productId: resolvedProductId,
        qtyReturned: Number(qtyReturned) || 1,
      },
    });

    return NextResponse.json(returnRecord, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
