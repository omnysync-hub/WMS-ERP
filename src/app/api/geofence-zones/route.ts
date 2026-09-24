export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";

/**
 * Geofence / attendance sites API
 * GET  ?activeOnly=&employeeId=&includeStaff=
 * POST create site { name, lat, lng, radiusMeters, address?, notes?, isActive? }
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") !== "false";
    const employeeId = searchParams.get("employeeId") || undefined;
    const includeStaff = searchParams.get("includeStaff") === "true";

    // Mobile / scoped: only zones assigned to this employee (if any assignments exist)
    if (employeeId) {
      const assignments = await prisma.employeeGeofenceAssignment.findMany({
        where: {
          employeeId,
          ...(activeOnly ? { zone: { isActive: true } } : {}),
        },
        include: {
          zone: true,
        },
        orderBy: { createdAt: "asc" },
      });

      if (assignments.length > 0) {
        return NextResponse.json({
          zones: assignments.map((a) => a.zone),
          count: assignments.length,
          scoped: true,
          scope: "assigned",
        });
      }

      // No assignment yet — fall back to all active (legacy) but mark unscoped
      const zones = await prisma.geofenceZone.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: { name: "asc" },
      });
      return NextResponse.json({
        zones,
        count: zones.length,
        scoped: false,
        scope: "all_active_fallback",
      });
    }

    const zones = await prisma.geofenceZone.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
      include: includeStaff
        ? {
            assignments: {
              include: {
                employee: {
                  select: {
                    id: true,
                    name: true,
                    role: true,
                    department: true,
                    designation: true,
                    faceEnrolled: true,
                    active: true,
                  },
                },
              },
            },
            _count: { select: { assignments: true } },
          }
        : undefined,
    });

    return NextResponse.json({
      zones,
      count: zones.length,
      scoped: false,
      scope: "all",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    // Allow unauthenticated ERP browser session for now (HRM page has no mobile token);
    // if a mobile token is present, require admin/HR.
    if (caller && !caller.isAdminOrHr) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      name,
      lat,
      lng,
      radiusMeters = 150,
      isActive = true,
      address,
      notes,
      employeeIds,
    } = body;

    if (!name || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: "name, lat, and lng are required to create a geofence zone." },
        { status: 400 }
      );
    }

    const zone = await prisma.geofenceZone.create({
      data: {
        name: String(name).trim(),
        lat: Number(lat),
        lng: Number(lng),
        radiusMeters: Math.max(20, Number(radiusMeters) || 150),
        isActive: Boolean(isActive),
        address: address ? String(address).trim() : null,
        notes: notes ? String(notes).trim() : null,
      },
    });

    if (Array.isArray(employeeIds) && employeeIds.length > 0) {
      const ids = Array.from(new Set(employeeIds.map(String)));
      await prisma.employeeGeofenceAssignment.createMany({
        data: ids.map((employeeId) => ({
          id: crypto.randomUUID(),
          employeeId,
          zoneId: zone.id,
        })),
        skipDuplicates: true,
      });
    }

    const full = await prisma.geofenceZone.findUnique({
      where: { id: zone.id },
      include: {
        assignments: {
          include: {
            employee: {
              select: { id: true, name: true, role: true, department: true },
            },
          },
        },
        _count: { select: { assignments: true } },
      },
    });

    return NextResponse.json({ success: true, zone: full }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
