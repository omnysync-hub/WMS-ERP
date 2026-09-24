export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";

type Ctx = { params: { id: string } };

/**
 * PUT /api/geofence-zones/[id]/staff
 * Body: { employeeIds: string[] } — replaces the site roster.
 */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const caller = await resolveCaller(req);
    if (caller && !caller.isAdminOrHr) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const zone = await prisma.geofenceZone.findUnique({ where: { id: params.id } });
    if (!zone) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 });
    }

    const body = await req.json();
    const employeeIds: string[] = Array.isArray(body.employeeIds)
      ? Array.from(new Set(body.employeeIds.map(String)))
      : [];

    await prisma.$transaction(async (tx) => {
      await tx.employeeGeofenceAssignment.deleteMany({ where: { zoneId: params.id } });
      if (employeeIds.length) {
        await tx.employeeGeofenceAssignment.createMany({
          data: employeeIds.map((employeeId) => ({
            id: crypto.randomUUID(),
            employeeId,
            zoneId: params.id,
          })),
          skipDuplicates: true,
        });
      }
    });

    const updated = await prisma.geofenceZone.findUnique({
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

    return NextResponse.json({ success: true, zone: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
