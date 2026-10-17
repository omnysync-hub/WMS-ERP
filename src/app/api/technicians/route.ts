export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireOfficePermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const gate = await requireOfficePermission(req, [
    "jobs.view_directory",
    "jobs.create_job",
    "jobs.create",
    "jobs.assign",
    "dispatch.view_map",
    "hrm.view_employees",
  ]);
  if (gate.error) return gate.error;
  try {
    const technicians = await prisma.employee.findMany({
      where: {
        OR: [
          { role: { equals: "technician", mode: "insensitive" } },
          { designation: { contains: "technician", mode: "insensitive" } },
          { department: { equals: "Operations", mode: "insensitive" } },
        ],
        AND: [
          {
            OR: [
              { active: true },
              { status: { equals: "Active", mode: "insensitive" } },
            ],
          },
        ],
      },
      include: {
        jobs: {
          where: { status: { in: ["Assigned", "Accepted", "InProgress", "Paused"] } },
          include: { customer: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Determine current status: "On Job" if has InProgress, "Assigned" if Accepted/Assigned, else "Available"
    const formatted = technicians.map((tech) => {
      const activeJob = tech.jobs.find((j) => j.status === "InProgress") || tech.jobs[0];
      let currentStatus = "Available";
      if (activeJob) {
        if (activeJob.status === "InProgress") currentStatus = "On Job";
        else if (activeJob.status === "Paused") currentStatus = "Paused";
        else currentStatus = "Assigned";
      }

      return {
        id: tech.id,
        name: tech.name,
        phone: tech.phone,
        email: tech.email,
        lat: tech.lat || 25.2048,
        lng: tech.lng || 55.2708,
        lastPingAt: tech.lastPingAt,
        currentStatus,
        activeJobsCount: tech.jobs.length,
        assignedJobs: tech.jobs.map((j) => ({
          id: j.id,
          jobNumber: j.jobNumber,
          status: j.status,
          customerName: j.customer?.name,
        })),
        activeJob: activeJob
          ? {
              id: activeJob.id,
              jobNumber: activeJob.jobNumber,
              customerName: activeJob.customer.name,
              status: activeJob.status,
            }
          : null,
      };
    });

    const unassignedJobs = await prisma.job.findMany({
      where: { status: "Created", assignedTechnicianId: null },
      include: { customer: true },
    });

    return NextResponse.json({ technicians: formatted, unassignedJobs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
