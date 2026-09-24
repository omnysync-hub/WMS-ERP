export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";

type Ctx = { params: { id: string } };

async function assertAdminIfAuthed(req: NextRequest) {
  const caller = await resolveCaller(req);
  if (caller && !caller.isAdminOrHr) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  try {
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

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const denied = await assertAdminIfAuthed(req);
    if (denied) return denied;

    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.lat !== undefined) data.lat = Number(body.lat);
    if (body.lng !== undefined) data.lng = Number(body.lng);
    if (body.radiusMeters !== undefined) {
      data.radiusMeters = Math.max(20, Number(body.radiusMeters) || 150);
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

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const denied = await assertAdminIfAuthed(req);
    if (denied) return denied;

    await prisma.employeeGeofenceAssignment.deleteMany({
      where: { zoneId: params.id },
    });
    await prisma.geofenceZone.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
