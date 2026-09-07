import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const technicians = await prisma.employee.findMany({
      where: { role: "technician", active: true },
      include: {
        jobs: {
          where: { status: { in: ["Assigned", "Accepted", "InProgress", "Paused"] } },
          include: { customer: true },
        },
      },
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
