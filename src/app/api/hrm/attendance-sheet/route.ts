export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/erpActor";

/**
 * GET /api/hrm/attendance-sheet
 * Returns a comprehensive, daily attendance sheet for all employees/technicians,
 * showing exact check-in time, check-out time, hours logged, duty status
 * (Available & Ready, On Job, Checked Out, Absent), geofence verification, and flags.
 */
export async function GET(req: NextRequest) {
  try {
    const gate = requirePermission(req, "hrm.attendance");
    if (gate.error) return gate.error;

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date"); // YYYY-MM-DD
    const department = searchParams.get("department") || undefined;
    const role = searchParams.get("role") || undefined;
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    // Parse target date boundaries (00:00:00.000 to 23:59:59.999 in local / UTC)
    let startDate: Date;
    let endDate: Date;

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      const [year, month, day] = dateParam.split("-").map(Number);
      startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    const isToday =
      new Date().toDateString() === startDate.toDateString();

    // Query all active employees
    const employeeWhere: any = {
      active: true,
    };
    if (department && department !== "all") {
      employeeWhere.department = { equals: department, mode: "insensitive" };
    }
    if (role && role !== "all") {
      employeeWhere.role = { equals: role, mode: "insensitive" };
    }
    if (search) {
      employeeWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { designation: { contains: search, mode: "insensitive" } },
      ];
    }

    const [employees, rawLogs, activeJobs] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          department: true,
          designation: true,
          status: true,
          faceEnrolled: true,
          lat: true,
          lng: true,
          lastPingAt: true,
        },
        orderBy: [{ department: "asc" }, { name: "asc" }],
      }),
      prisma.attendanceLog.findMany({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          geofenceZone: true,
        },
        orderBy: { timestamp: "asc" },
      }),
      prisma.job.findMany({
        where: {
          status: { in: ["Assigned", "Accepted", "InProgress", "Paused"] },
        },
        select: {
          id: true,
          jobNumber: true,
          status: true,
          assignedTechnicianId: true,
          jobType: true,
        },
      }),
    ]);

    // Map logs by employeeId
    const logsByEmployee: Record<string, typeof rawLogs> = {};
    for (const log of rawLogs) {
      if (!logsByEmployee[log.employeeId]) logsByEmployee[log.employeeId] = [];
      logsByEmployee[log.employeeId].push(log);
    }

    // Map active jobs by technicianId
    const activeJobsByTech: Record<string, typeof activeJobs[0]> = {};
    for (const job of activeJobs) {
      if (job.assignedTechnicianId) {
        if (!activeJobsByTech[job.assignedTechnicianId] || job.status === "InProgress") {
          activeJobsByTech[job.assignedTechnicianId] = job;
        }
      }
    }

    let summaryAvailable = 0;
    let summaryOnJob = 0;
    let summaryCheckedOut = 0;
    let summaryAbsent = 0;
    let summaryFlagged = 0;

    const records = employees.map((emp) => {
      const logs = logsByEmployee[emp.id] || [];

      // Categorize punches
      const punches = logs.map((l) => {
        const isOut = l.notes?.includes("[CHECK_OUT]");
        if (l.flaggedForReview) summaryFlagged++;
        return {
          id: l.id,
          timestamp: l.timestamp.toISOString(),
          timeStr: l.timestamp.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          type: isOut ? ("CHECK_OUT" as const) : ("CHECK_IN" as const),
          zoneName: l.geofenceZone?.name || (l.withinGeofence ? "Authorized Site" : "Outside Zone"),
          withinGeofence: l.withinGeofence,
          faceMatchScore: l.faceMatchScore,
          livenessScore: l.livenessScore,
          flaggedForReview: l.flaggedForReview,
          flagReason: l.flagReason,
          notes: l.notes,
        };
      });

      const firstCheckIn = punches.find((p) => p.type === "CHECK_IN");
      const lastCheckOut = [...punches].reverse().find((p) => p.type === "CHECK_OUT");
      const latestPunch = punches[punches.length - 1];

      // Calculate working hours
      let minutesWorked = 0;
      if (firstCheckIn) {
        const inTime = new Date(firstCheckIn.timestamp).getTime();
        const outTime = lastCheckOut
          ? new Date(lastCheckOut.timestamp).getTime()
          : isToday
          ? Date.now()
          : inTime;
        minutesWorked = Math.max(0, Math.floor((outTime - inTime) / (1000 * 60)));
      }

      const hours = Math.floor(minutesWorked / 60);
      const mins = minutesWorked % 60;
      const hoursWorkedStr = firstCheckIn ? `${hours}h ${mins}m` : "—";

      // Determine duty status
      let dutyStatus: "Available & Ready" | "On Job" | "Checked Out" | "Absent" | "On Leave" =
        "Absent";

      if (emp.status === "On Leave") {
        dutyStatus = "On Leave";
      } else if (punches.length === 0) {
        dutyStatus = "Absent";
        summaryAbsent++;
      } else if (latestPunch?.type === "CHECK_OUT") {
        dutyStatus = "Checked Out";
        summaryCheckedOut++;
      } else {
        // Currently checked in
        const activeJob = activeJobsByTech[emp.id];
        if (activeJob && activeJob.status === "InProgress") {
          dutyStatus = "On Job";
          summaryOnJob++;
        } else {
          dutyStatus = "Available & Ready";
          summaryAvailable++;
        }
      }

      return {
        employee: {
          id: emp.id,
          name: emp.name,
          phone: emp.phone,
          email: emp.email,
          role: emp.role,
          department: emp.department,
          designation: emp.designation || emp.role,
          faceEnrolled: emp.faceEnrolled,
        },
        dutyStatus,
        isCheckedIn: dutyStatus === "Available & Ready" || dutyStatus === "On Job",
        firstCheckIn: firstCheckIn || null,
        lastCheckOut: lastCheckOut || null,
        hoursWorkedMinutes: minutesWorked,
        hoursWorkedFormatted: hoursWorkedStr,
        punchesCount: punches.length,
        punches,
        hasFlag: punches.some((p) => p.flaggedForReview),
        activeJob: activeJobsByTech[emp.id]
          ? {
              id: activeJobsByTech[emp.id].id,
              jobNumber: activeJobsByTech[emp.id].jobNumber,
              title: activeJobsByTech[emp.id].jobType,
            }
          : null,
      };
    });

    const summary = {
      date: startDate.toISOString().split("T")[0],
      isToday,
      totalEmployees: employees.length,
      availableAndReady: summaryAvailable,
      onJob: summaryOnJob,
      checkedOut: summaryCheckedOut,
      absent: summaryAbsent,
      flaggedCount: summaryFlagged,
    };

    return NextResponse.json({
      success: true,
      summary,
      records,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
