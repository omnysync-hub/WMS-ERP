export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { MobilePushService } from "@/lib/services/MobilePushService";
import { prisma } from "@/lib/prisma";
import { resolveCaller } from "@/lib/auth/mobileAuth";

async function authorizeEmployee(req: NextRequest, employeeId: string) {
  const caller = await resolveCaller(req);
  if (!caller) {
    return { error: NextResponse.json({ error: "Valid session required." }, { status: 401 }) };
  }
  if (caller.id !== employeeId && !caller.isAdminOrHr) {
    return { error: NextResponse.json({ error: "You can only manage your own device." }, { status: 403 }) };
  }
  return { caller };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, token, platform, deviceModel, osVersion, appVersion } = body;

    if (!employeeId || !token || !platform) {
      return NextResponse.json(
        { error: "employeeId, token, and platform ('ios' | 'android' | 'web') are required." },
        { status: 400 }
      );
    }

    const auth = await authorizeEmployee(req, String(employeeId));
    if (auth.error) return auth.error;

    const deviceToken = await MobilePushService.registerPushToken({
      employeeId,
      token,
      platform,
      deviceModel,
      osVersion,
      appVersion,
    });

    return NextResponse.json({ success: true, deviceToken }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "token parameter is required." }, { status: 400 });
    }


    const existing = await prisma.devicePushToken.findUnique({
      where: { token },
      select: { employeeId: true },
    });
    if (!existing) return NextResponse.json({ success: true });
    const auth = await authorizeEmployee(req, existing.employeeId);
    if (auth.error) return auth.error;

    const result = await MobilePushService.unregisterPushToken(token);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");

    if (!employeeId) {
      return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
    }


    const auth = await authorizeEmployee(req, employeeId);
    if (auth.error) return auth.error;

    const tokens = await prisma.devicePushToken.findMany({
      where: { employeeId },
      orderBy: { lastActiveAt: "desc" },
      select: {
        id: true,
        platform: true,
        deviceModel: true,
        osVersion: true,
        appVersion: true,
        isActive: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ tokens });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
