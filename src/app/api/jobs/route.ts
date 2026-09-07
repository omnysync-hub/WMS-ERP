import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { JobsService } from "@/lib/services/JobsService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const technicianId = searchParams.get("technicianId");
    const search = searchParams.get("search");

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (technicianId) where.assignedTechnicianId = technicianId;
    if (search) {
      where.OR = [
        { jobNumber: { contains: search } },
        { remarks: { contains: search } },
        { customer: { name: { contains: search } } },
      ];
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: true,
        careOfParty: true,
        assignedTechnician: true,
        items: true,
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
    const {
      customerId,
      careOfPartyId,
      manualJobNumber,
      jobType,
      remarks,
      items,
      assignedTechnicianId,
    } = body;

    if (!customerId || !jobType) {
      return NextResponse.json(
        { error: "Customer and job type are required." },
        { status: 400 }
      );
    }

    const count = await prisma.job.count();
    const jobNumber = `JOB-2026-${String(count + 1).padStart(4, "0")}`;

    const job = await prisma.job.create({
      data: {
        jobNumber,
        customerId,
        careOfPartyId: careOfPartyId || null,
        manualJobNumber: manualJobNumber || null,
        jobType,
        remarks: remarks || "",
        status: assignedTechnicianId ? "Assigned" : "Created",
        assignedTechnicianId: assignedTechnicianId || null,
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

    return NextResponse.json(job, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
