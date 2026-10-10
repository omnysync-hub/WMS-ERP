export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobsPermission } from "@/lib/auth/erpActor";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireJobsPermission(req, "jobs.view_directory");
  if (gate.error) return gate.error;
  try {
    const { id } = await params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        customer: true,
        boqItems: {
          include: { tasks: { include: { assignedTechnician: true } } },
          orderBy: { itemCode: "asc" },
        },
        tasks: {
          include: { assignedTechnician: true, boqItem: true },
          orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
        },
        changeOrders: {
          orderBy: { createdAt: "desc" },
        },
        milestones: {
          orderBy: { targetDate: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [invoices, requisitions] = await Promise.all([
      prisma.invoice.findMany({
        where: { projectId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.purchaseRequisition.findMany({
        where: { projectId: id },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      ...project,
      invoices,
      requisitions,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireJobsPermission(req, "jobs.manage");
  if (gate.error) return gate.error;
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, customerId, status, totalBudget, startDate, endDate } = body;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (customerId !== undefined) updateData.customerId = customerId;
    if (status !== undefined) updateData.status = status;
    if (totalBudget !== undefined) updateData.totalBudget = Number(totalBudget) || 0;
    if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        boqItems: { include: { tasks: true }, orderBy: { itemCode: "asc" } },
        tasks: { include: { assignedTechnician: true, boqItem: true }, orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json(project);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireJobsPermission(req, "jobs.manage");
  if (gate.error) return gate.error;
  try {
    const { id } = await params;
    await prisma.project.delete({
      where: { id },
    });
    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
