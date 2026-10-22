export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";
import { isServiceProduct, skuFromItemLabel } from "@/lib/inventory/physicalStock";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const gate = await requireJobsPermission(req, "jobs.inventory_request");
  if (gate.error) return gate.error;
  try {
    const body = await req.json();
    const { technicianId, item, qtyRequested, productId } = body;
    // Verified mobile technician: file strictly as self
    const techId =
      (req.headers.get("authorization") || "").startsWith("Bearer ") && gate.actor.role === "technician"
        ? gate.actor.id
        : technicianId;
    if (!techId || !item || !String(item).trim()) {
      return NextResponse.json({ error: "technicianId and item are required" }, { status: 400 });
    }

    // Only physical stock can be requested from the warehouse; services are added to the job instead.
    const label = String(item).trim();
    const sku = skuFromItemLabel(label);
    const product = productId
      ? await prisma.product.findUnique({ where: { id: String(productId) } })
      : sku
        ? await prisma.product.findUnique({ where: { sku } })
        : await prisma.product.findFirst({ where: { name: { equals: label, mode: "insensitive" } } });
    if (product && isServiceProduct(product)) {
      return NextResponse.json(
        { error: `${product.name} is a service, not physical stock. Add it from Services instead.`, code: "NOT_PHYSICAL_STOCK" },
        { status: 400 }
      );
    }

    const request = await prisma.inventoryRequest.create({
      data: {
        jobId: params.id,
        technicianId: techId,
        item,
        productId: productId || null,
        qtyRequested: Number(qtyRequested) || 1,
        qtyIssued: 0,
        status: "pending",
      },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
