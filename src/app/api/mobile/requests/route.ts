export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MobilePushService } from "@/lib/services/MobilePushService";
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

    const { searchParams } = new URL(req.url);
    const technicianId = searchParams.get("technicianId");
    const status = searchParams.get("status"); // pending, accepted, rejected, acknowledged
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const type = searchParams.get("type");
    const limit = Number(searchParams.get("limit")) || 50;

    if (!technicianId) {
      return NextResponse.json(
        { error: "technicianId parameter is required." },
        { status: 400 }
      );
    }

    if (caller.id !== technicianId && !caller.isAdminOrHr) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view dispatch requests for another technician." },
        { status: 403 }
      );
    }

    const where: any = { recipientId: technicianId };
    if (status) where.actionStatus = status;
    if (unreadOnly) where.deliveryStatus = { in: ["queued", "sent", "delivered"] };
    if (type) where.type = type;

    const requests = await prisma.mobileAppRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const unreadCount = await prisma.mobileAppRequest.count({
      where: {
        recipientId: technicianId,
        deliveryStatus: { in: ["queued", "sent", "delivered"] },
      },
    });

    return NextResponse.json({
      requests,
      unreadCount,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      recipientId,
      senderId,
      senderName,
      senderRole,
      type,
      title,
      body: messageBody,
      priority,
      payload,
      actionRequired,
    } = body;

    if (!recipientId || !title || !messageBody || !type) {
      return NextResponse.json(
        { error: "Missing required fields: recipientId, title, body, and type are required." },
        { status: 400 }
      );
    }

    const request = await MobilePushService.sendAppRequest({
      recipientId,
      senderId,
      senderName: senderName || "Dispatcher",
      senderRole: senderRole || "dispatcher",
      type,
      title,
      body: messageBody,
      priority: priority || "normal",
      payload: payload || {},
      actionRequired: Boolean(actionRequired),
    });

    return NextResponse.json(request, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
