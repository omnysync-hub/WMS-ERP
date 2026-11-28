export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";
import { pktDateString, pktTodayStart } from "@/lib/pktTime";

import { requireOfficePermission } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  try {
    // Export of surveillance telemetry (CSV/JSON download of a technician's
    // historical track). Only the Surveillance page calls this route, so it is
    // gated by dispatch.surveillance — the same key as /api/telemetry/history —
    // not by the live-map permission dispatch.view_map.
    const gate = await requireOfficePermission(req, [
      "dispatch.surveillance",
      "admin",
    ]);

    if (gate.error) {
      const mobileCaller = await resolveCaller(req);
      if (!mobileCaller || !mobileCaller.isAdminOrHr) {
        return gate.error;
      }
    }

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const format = searchParams.get("format") || "csv"; // "csv" | "json"
    const scope = searchParams.get("scope") || "all"; // "all" | "on_job" | "on_shift" — same as history

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
    const defaultStart = pktTodayStart(now); // PKT midnight

    const start = startDateParam ? new Date(startDateParam) : defaultStart;
    const end = endDateParam ? new Date(endDateParam) : now;

    // Apply the exact same scope predicate as /api/telemetry/history so the
    // export always matches what the user sees on screen.
    const pingWhere: any = {
      employeeId,
      timestamp: { gte: start, lte: end },
    };
    if (scope === "on_job") {
      pingWhere.activeJobId = { not: null };
    } else if (scope === "on_shift") {
      pingWhere.isShiftActive = true;
    }

    const pings = await prisma.technicianLocationPing.findMany({
      where: pingWhere,
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
        scope,
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

      // Battery is stored as a fraction (0–1); the CSV column is battery_pct,
      // so convert fractions to a percentage. Values already > 1 are passed
      // through unchanged (they were recorded as percentages).
      const batteryPct =
        p.batteryLevel == null
          ? ""
          : p.batteryLevel <= 1
            ? Math.round(p.batteryLevel * 1000) / 10
            : p.batteryLevel;

      return [
        p.timestamp.toISOString(),
        p.employeeId,
        escape(employee.name),
        p.lat,
        p.lng,
        p.accuracy ?? "",
        p.speed ?? "",
        batteryPct,
        p.isMoving ? "YES" : "NO",
        p.isShiftActive ? "YES" : "NO",
        escape(p.activeJob?.jobNumber),
        escape(p.activeJob?.customer?.name),
        escape(p.source),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const filename = `telemetry_${employee.name.toLowerCase().replace(/\s+/g, "_")}_${pktDateString(start)}.csv`;

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
