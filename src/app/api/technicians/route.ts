import { pktTodayStart } from "@/lib/pktTime";
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
    const startOfToday = pktTodayStart(); // Pakistan calendar day (server clock is UTC)

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
        attendanceLogs: {
          where: { timestamp: { gte: startOfToday } },
          orderBy: { timestamp: "desc" },
          take: 10,
          include: { geofenceZone: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Determine current status based on today's attendance and active jobs
    const formatted = technicians.map((tech) => {
      const activeJob = tech.jobs.find((j) => j.status === "InProgress") || tech.jobs[0];
      const todayLogs = tech.attendanceLogs || [];
      const latestPunch = todayLogs[0] || null;
      const isCheckedIn = latestPunch
        ? !latestPunch.notes?.includes("[CHECK_OUT]")
        : false;
      const firstCheckIn = [...todayLogs].reverse().find((l) => !l.notes?.includes("[CHECK_OUT]"));
      const lastCheckOut = todayLogs.find((l) => l.notes?.includes("[CHECK_OUT]"));

      let currentStatus = "Off Duty";
      if (isCheckedIn) {
        if (activeJob) {
          if (activeJob.status === "InProgress") currentStatus = "On Job";
          else if (activeJob.status === "Paused") currentStatus = "Paused";
          else currentStatus = "Assigned";
        } else {
          currentStatus = "Available & Ready";
        }
      } else if (lastCheckOut) {
        currentStatus = "Checked Out";
      } else {
        currentStatus = "Off Duty";
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
        isCheckedIn,
        checkInTime: firstCheckIn?.timestamp || null,
        checkOutTime: lastCheckOut?.timestamp || null,
        attendanceZone: latestPunch?.geofenceZone?.name || null,
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

    const { searchParams } = new URL(req.url);
    const presentOnly = searchParams.get("presentOnly") === "true";

    const presentTechnicians = formatted.filter((t) => t.isCheckedIn);
    const outputTechnicians = presentOnly ? presentTechnicians : formatted;

    const unassignedJobs = await prisma.job.findMany({
      where: { status: "Created", assignedTechnicianId: null },
      include: { customer: true },
    });

    return NextResponse.json({
      technicians: outputTechnicians,
      presentTechnicians,
      allTechnicians: formatted,
      unassignedJobs,
      totalCount: formatted.length,
      presentCount: presentTechnicians.length,
      offDutyCount: formatted.length - presentTechnicians.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
