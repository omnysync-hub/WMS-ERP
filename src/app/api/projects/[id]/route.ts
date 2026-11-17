export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireJobsPermission, type ErpActor } from "@/lib/auth/erpActor";

/**
 * Employee id behind an actor. Mobile actors carry the Employee id directly;
 * web actors carry the ErpUser id, which Employee.erpUserId links back to.
 */
async function resolveActorEmployeeId(actor: ErpActor): Promise<string | null> {
  if (!actor || !actor.id || actor.role === "anonymous") return null;
  const byId = await prisma.employee.findUnique({ where: { id: actor.id }, select: { id: true } });
  if (byId) return byId.id;
  const byUser = await prisma.employee.findUnique({ where: { erpUserId: actor.id }, select: { id: true } });
  return byUser?.id ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // projects.view only (see the note on the list route): no jobs-directory fallback.
  const gate = await requireJobsPermission(req, "projects.view");
  try {
    const { id } = await params;

    // Actors without projects.view fall back to PM / team membership on this project.
    const canViewAll = !gate.error;
    let memberEmployeeId: string | null = null;
    if (!canViewAll) {
      // Auth failures (401/503 from token verification) are not curable by membership.
      if (!gate.error || gate.error.status !== 403) return gate.error;
      memberEmployeeId = await resolveActorEmployeeId(gate.actor);
      if (!memberEmployeeId) return gate.error;
    }

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
        teamMembers: {
          include: { employee: { select: { id: true, name: true, designation: true } } },
          orderBy: { createdAt: "asc" },
        },
        documents: {
          orderBy: { createdAt: "desc" },
        },
        expenses: {
          orderBy: { createdAt: "desc" },
        },
        deliveryOrders: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!canViewAll) {
      const isMember =
        project.managerId === memberEmployeeId ||
        (project.teamMembers || []).some((m) => m.employeeId === memberEmployeeId);
      if (!isMember) return gate.error;
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

    const expenses = (project as any).expenses as Array<{ kind: string; amount: number }>;
    const expensesTotal = expenses.filter((e) => e.kind === "expense").reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const pettyTopups = expenses.filter((e) => e.kind === "petty_topup").reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const pettySpends = expenses.filter((e) => e.kind === "petty_spend").reduce((s, e) => s + (Number(e.amount) || 0), 0);

    return NextResponse.json({
      ...project,
      invoices,
      requisitions,
      expensesTotal,
      pettyBalance: pettyTopups - pettySpends,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireJobsPermission(req, "projects.manage");
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
  const gate = await requireJobsPermission(req, "projects.manage");
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
