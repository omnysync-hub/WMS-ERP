export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";
import { InventoryService } from "@/lib/services/InventoryService";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
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
    const qty = qtyReturned === undefined || qtyReturned === null || qtyReturned === "" ? 1 : Number(qtyReturned);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) {
      return NextResponse.json({ error: "Return quantity must be a positive number." }, { status: 400 });
    }
    // The returning technician must be on this job (mobile = self; web = the named technician).
    const assigned = await prisma.job.findFirst({
      where: {
        id: params.id,
        OR: [
          { assignedTechnicianId: techId },
          { assignments: { some: { technicianId: techId, status: { not: "Removed" } } } },
        ],
      },
      select: { id: true },
    });
    if (!assigned) {
      return NextResponse.json(
        { error: "Forbidden: this technician is not assigned to this job.", code: "PERMISSION_DENIED" },
        { status: 403 }
      );
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

    if (resolvedProductId) {
      const cap = await InventoryService.getReturnableQty(prisma, params.id, resolvedProductId);
      if (qty > cap.returnable + 1e-9) {
        return NextResponse.json(
          { error: `Only ${cap.returnable} unit(s) of this item can be returned for this job (issued ${cap.issuedQty}, already returned ${cap.returnedQty}).` },
          { status: 400 }
        );
      }
    }

    const returnRecord = await prisma.stockReturn.create({
      data: {
        jobId: params.id,
        technicianId: techId,
        item,
        productId: resolvedProductId,
        qtyReturned: qty,
      },
    });

    return NextResponse.json(returnRecord, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
