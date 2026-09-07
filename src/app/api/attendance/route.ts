import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AttendanceService } from "@/lib/services/AttendanceService";

export async function GET() {
  try {
    const logs = await prisma.attendanceLog.findMany({
      include: {
        employee: true,
        geofenceZone: true,
      },
      orderBy: { timestamp: "desc" },
      take: 40,
    });

    const zones = await prisma.geofenceZone.findMany();
    const employees = await prisma.employee.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true, department: true, faceEnrolled: true },
    });

    return NextResponse.json({ logs, zones, employees });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, faceMatchScore, lat, lng, notes } = body;

    const result = await AttendanceService.recordAttendance({
      employeeId,
      faceMatchScore: Number(faceMatchScore),
      lat: Number(lat),
      lng: Number(lng),
      notes,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
