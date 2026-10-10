export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";
import { requirePermission } from "@/lib/auth/erpActor";

/**
 * Geofence / attendance sites API
 * GET  ?activeOnly=&employeeId=&includeStaff=
 * POST create site { name, lat, lng, radiusMeters, address?, notes?, isActive? }
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") !== "false";
    let employeeId = searchParams.get("employeeId") || undefined;
    let includeStaff = searchParams.get("includeStaff") === "true";
    const isMobile = (req.headers.get("authorization") || "").startsWith("Bearer ");
    if (isMobile) {
      const caller = await resolveCaller(req);
      if (!caller) return NextResponse.json({ error: "Valid session required." }, { status: 401 });
      if (!caller.isAdminOrHr) {
        if (employeeId && employeeId !== caller.id) {
          return NextResponse.json({ error: "You can only view your own assigned sites." }, { status: 403 });
        }
        employeeId = caller.id;
        includeStaff = false;
      }
    } else {
      const gate = requirePermission(req, "hrm.attendance");
      if (gate.error) return gate.error;
    }

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
    const gate = requirePermission(req, "hrm.attendance");
    if (gate.error) return gate.error;

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

    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    const parsedRadius = Number(radiusMeters);
    if (typeof name !== "string" || !name.trim() || name.trim().length > 160 || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: "name, lat, and lng are required to create a geofence zone." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90 || !Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      return NextResponse.json({ error: "Enter valid latitude and longitude coordinates." }, { status: 400 });
    }
    if (!Number.isFinite(parsedRadius) || parsedRadius < 20 || parsedRadius > 10_000) {
      return NextResponse.json({ error: "Geofence radius must be between 20 and 10,000 metres." }, { status: 400 });
    }

    const zone = await prisma.geofenceZone.create({
      data: {
        name: String(name).trim(),
        lat: parsedLat,
        lng: parsedLng,
        radiusMeters: parsedRadius,
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
