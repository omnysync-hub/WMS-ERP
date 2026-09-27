export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobsService } from "@/lib/services/JobsService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const technicianId = searchParams.get("technicianId");
    const search = searchParams.get("search");
    const hasInventoryRequest = searchParams.get("hasInventoryRequest") === "true";

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (technicianId) {
      // Include jobs where tech is primary assignee OR active JobAssignment member
      where.OR = [
        { assignedTechnicianId: technicianId },
        {
          assignments: {
            some: {
              technicianId,
              status: { not: "Removed" },
            },
          },
        },
      ];
    }
    if (hasInventoryRequest) {
      where.inventoryRequests = { some: {} };
    }
    if (search) {
      const searchClause = [
        { jobNumber: { contains: search } },
        { remarks: { contains: search } },
        { customer: { name: { contains: search } } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchClause }];
        delete where.OR;
      } else {
        where.OR = searchClause;
      }
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: true,
        careOfParty: true,
        assignedTechnician: true,
        parentJob: { select: { id: true, jobNumber: true, status: true } },
        childJobs: { select: { id: true, jobNumber: true, status: true } },
        assignments: {
          where: { status: { not: "Removed" } },
          include: { technician: { select: { id: true, name: true, phone: true } } },
        },
        items: true,
        expenseClaims: true,
        inventoryRequests: true,
        stockReturns: true,
        statusHistory: {
          orderBy: { changedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(jobs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Batch accept (mobile): { action: "batch_accept", jobIds: [], technicianId }
    if (body.action === "batch_accept" || body.action === "accept_jobs") {
      const { jobIds, technicianId } = body;
      if (!technicianId) {
        return NextResponse.json({ error: "technicianId required" }, { status: 400 });
      }
      const result = await JobsService.acceptJobs(jobIds || [], technicianId);
      return NextResponse.json(result);
    }

    const {
      customerId,
      careOfPartyId,
      manualJobNumber,
      jobType,
      remarks,
      items,
      assignedTechnicianId,
      technicianIds,
    } = body;

    if (!customerId || !jobType) {
      return NextResponse.json(
        { error: "Customer and job type are required." },
        { status: 400 }
      );
    }

    const count = await prisma.job.count();
    const jobNumber = `JOB-2026-${String(count + 1).padStart(4, "0")}`;

    const effectivePrimaryId =
      assignedTechnicianId ||
      (Array.isArray(technicianIds) && technicianIds.length > 0 ? technicianIds[0] : null);

    const job = await prisma.job.create({
      data: {
        jobNumber,
        customerId,
        careOfPartyId: careOfPartyId || null,
        manualJobNumber: manualJobNumber || null,
        jobType,
        remarks: remarks || "",
        status: effectivePrimaryId ? "Assigned" : "Created",
        assignedTechnicianId: effectivePrimaryId || null,
        ...(items && items.length > 0
          ? {
              items: {
                create: items.map((it: any) => ({
                  description: it.description,
                  quantityPlanned: Number(it.quantityPlanned) || 1,
                  unitRate: Number(it.unitRate) || 0,
                })),
              },
            }
          : {}),
      },
      include: {
        customer: true,
        items: true,
      },
    });

    await JobsService.logStatusChange(
      job.id,
      "None",
      job.status,
      "Dispatcher",
      { initialItems: items }
    );

    // If any items are linked to inventory products, register pending inventory requests for the warehouse
    if (items && items.length > 0) {
      for (const it of items) {
        if (it.productId) {
          try {
            await prisma.inventoryRequest.create({
              data: {
                jobId: job.id,
                technicianId: assignedTechnicianId || "warehouse_dispatch",
                item: it.description,
                qtyRequested: Number(it.quantityPlanned) || 1,
                status: "pending",
              },
            });
          } catch (e) {
            console.error("Failed to create inventory request for job item:", e);
          }
        }
      }
    }

    const multiIds: string[] = Array.isArray(technicianIds)
      ? technicianIds.filter(Boolean)
      : assignedTechnicianId
        ? [assignedTechnicianId]
        : [];

    if (multiIds.length > 0) {
      try {
        await JobsService.assignTechnicians(
          job.id,
          multiIds,
          "Dispatcher",
          assignedTechnicianId || multiIds[0]
        );
      } catch (e) {
        console.error("Failed to sync JobAssignment on create:", e);
        if (assignedTechnicianId) {
          await JobsService.notifyJobAssignedIfNeeded(job, "Dispatcher");
        }
      }
    }

    const fresh = await prisma.job.findUnique({
      where: { id: job.id },
      include: {
        customer: true,
        items: true,
        assignedTechnician: true,
        assignments: { where: { status: { not: "Removed" } }, include: { technician: true } },
      },
    });

    return NextResponse.json(fresh || job, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
