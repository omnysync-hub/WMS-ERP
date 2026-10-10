export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth/erpActor";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  try {
    const gate = requirePermission(req, "hrm.attendance");
    if (gate.error) return gate.error;
    const params = await context.params;
    const zone = await prisma.geofenceZone.findUnique({
      where: { id: params.id },
      include: {
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
      },
    });
    if (!zone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 });
    }
    return NextResponse.json({ zone });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: Ctx) {
  try {
    const params = await context.params;
    const gate = requirePermission(req, "hrm.attendance");
    if (gate.error) return gate.error;

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.lat !== undefined) data.lat = Number(body.lat);
    if (body.lng !== undefined) data.lng = Number(body.lng);
    if (body.radiusMeters !== undefined) {
      const radius = Number(body.radiusMeters);
      if (!Number.isFinite(radius) || radius < 20 || radius > 10_000) {
        return NextResponse.json({ error: "Geofence radius must be between 20 and 10,000 metres." }, { status: 400 });
      }
      data.radiusMeters = radius;
    }
    if (data.lat !== undefined && (!Number.isFinite(data.lat) || (data.lat as number) < -90 || (data.lat as number) > 90)) {
      return NextResponse.json({ error: "Enter a valid latitude." }, { status: 400 });
    }
    if (data.lng !== undefined && (!Number.isFinite(data.lng) || (data.lng as number) < -180 || (data.lng as number) > 180)) {
      return NextResponse.json({ error: "Enter a valid longitude." }, { status: 400 });
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.address !== undefined) {
      data.address = body.address ? String(body.address).trim() : null;
    }
    if (body.notes !== undefined) {
      data.notes = body.notes ? String(body.notes).trim() : null;
    }

    const zone = await prisma.geofenceZone.update({
      where: { id: params.id },
      data,
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

    return NextResponse.json({ success: true, zone });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, context: Ctx) {
  try {
    const params = await context.params;
    const gate = requirePermission(req, "hrm.attendance");
    if (gate.error) return gate.error;

    await prisma.employeeGeofenceAssignment.deleteMany({
      where: { zoneId: params.id },
    });
    await prisma.geofenceZone.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
