export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Unauthorized: Missing or invalid authentication credentials." },
        { status: 401 }
      );
    }

    if (!caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: Only administrators and HR personnel can export surveillance telemetry." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const format = searchParams.get("format") || "csv"; // "csv" | "json"

    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId query parameter is required." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, role: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: `Employee with ID "${employeeId}" not found.` },
        { status: 404 }
      );
    }

    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setHours(0, 0, 0, 0);

    const start = startDateParam ? new Date(startDateParam) : defaultStart;
    const end = endDateParam ? new Date(endDateParam) : now;

    const pings = await prisma.technicianLocationPing.findMany({
      where: {
        employeeId,
        timestamp: { gte: start, lte: end },
      },
      include: {
        activeJob: {
          select: {
            jobNumber: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { timestamp: "asc" },
    });

    if (format === "json") {
      return NextResponse.json({
        employee,
        start: start.toISOString(),
        end: end.toISOString(),
        totalPings: pings.length,
        pings,
      });
    }

    // CSV format
    const headers = [
      "timestamp_utc",
      "employee_id",
      "employee_name",
      "latitude",
      "longitude",
      "accuracy_m",
      "speed_kmh",
      "battery_pct",
      "is_moving",
      "is_shift_active",
      "job_number",
      "customer_name",
      "source",
    ];

    const rows = pings.map((p: any) => {
      const escape = (str: string | null | undefined) =>
        `"${String(str || "").replace(/"/g, '""')}"`;

      return [
        p.timestamp.toISOString(),
        p.employeeId,
        escape(employee.name),
        p.lat,
        p.lng,
        p.accuracy ?? "",
        p.speed ?? "",
        p.batteryLevel ?? "",
        p.isMoving ? "YES" : "NO",
        p.isShiftActive ? "YES" : "NO",
        escape(p.activeJob?.jobNumber),
        escape(p.activeJob?.customer?.name),
        escape(p.source),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const filename = `telemetry_${employee.name.toLowerCase().replace(/\s+/g, "_")}_${start.toISOString().slice(0, 10)}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
