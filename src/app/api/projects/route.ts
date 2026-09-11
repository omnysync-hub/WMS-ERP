export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        customer: true,
        boqItems: {
          include: { tasks: true },
        },
        tasks: {
          include: { assignedTechnician: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(projects);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    if (action === "create_task") {
      const { projectId, boqItemId, title, description, assignedTechnicianId } = payload;
      const task = await prisma.projectTask.create({
        data: {
          projectId,
          boqItemId: boqItemId || null,
          title,
          description: description || "",
          assignedTechnicianId: assignedTechnicianId || null,
          status: "Created",
        },
      });
      return NextResponse.json(task, { status: 201 });
    }

    if (action === "update_task_status") {
      const { taskId, status } = payload;
      const task = await prisma.projectTask.update({
        where: { id: taskId },
        data: { status },
      });
      return NextResponse.json(task);
    }

    // Default: create Project with BOQ items
    const { name, customerId, totalBudget, startDate, endDate, boqItems = [] } = payload;
    const count = await prisma.project.count();
    const projectNumber = `PRJ-2026-${String(count + 1).padStart(3, "0")}`;

    const project = await prisma.project.create({
      data: {
        projectNumber,
        name,
        customerId,
        totalBudget: Number(totalBudget) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        boqItems: {
          create: boqItems.map((item: any, idx: number) => ({
            itemCode: item.itemCode || `BOQ-${String(idx + 1).padStart(2, "0")}`,
            description: item.description,
            unit: item.unit || "item",
            plannedQty: Number(item.plannedQty) || 1,
            unitRate: Number(item.unitRate) || 0,
          })),
        },
      },
      include: { boqItems: true, customer: true },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
