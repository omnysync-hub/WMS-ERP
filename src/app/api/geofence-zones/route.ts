export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Geofence Zones API (Multi-Office & Customer Site Support)
 * GET /api/geofence-zones
 * Query parameters:
 *  - activeOnly=true (default: true)
 * Response shape:
 *  {
 *    zones: [
 *      {
 *        id: "uuid",
 *        name: "Headquarters - Gulberg",
 *        lat: 25.2048,
 *        lng: 55.2708,
 *        radiusMeters: 150,
 *        isActive: true,
 *        createdAt: "2026-09-18T10:00:00.000Z"
 *      }
 *    ],
 *    count: 1
 *  }
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") !== "false"; // default true

    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }

    const zones = await prisma.geofenceZone.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        lat: true,
        lng: true,
        radiusMeters: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      zones,
      count: zones.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, lat, lng, radiusMeters = 150, isActive = true } = body;

    if (!name || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: "name, lat, and lng are required to create a geofence zone." },
        { status: 400 }
      );
    }

    const zone = await prisma.geofenceZone.create({
      data: {
        name,
        lat: Number(lat),
        lng: Number(lng),
        radiusMeters: Number(radiusMeters),
        isActive: Boolean(isActive),
      },
    });

    return NextResponse.json({ success: true, zone }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
