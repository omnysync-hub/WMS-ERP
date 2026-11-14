export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WorkshopService } from "@/lib/services/WorkshopService";
import { resolveJobsActor } from "@/lib/auth/erpActor";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-actor-role, x-actor-name, x-actor-id, *",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workshopType = searchParams.get("workshopType");
    const status = searchParams.get("status");
    const jobCardId = searchParams.get("jobCardId");

    const where: any = {};
    if (workshopType && workshopType !== "all") where.workshopType = workshopType;
    if (status && status !== "ALL") where.status = status;
    if (jobCardId) where.jobCardId = jobCardId;

    const items = await prisma.workshopScrapItem.findMany({
      where,
      include: {
        jobCard: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, count: items.length, data: items });
  } catch (err: any) {
    console.error("GET /api/workshops/scrap error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch scrap items" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { actor } = await resolveJobsActor(req);
    const actorName = actor?.name || "Workshop Manager";

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "record": {
        const { jobCardId, itemDescription, quantity, unit, customerKept } = body;
        if (!jobCardId || !itemDescription) {
          return NextResponse.json(
            { error: "jobCardId and itemDescription are required" },
            { status: 400 }
          );
        }
        const scrap = await WorkshopService.recordScrapItem(
          jobCardId,
          { itemDescription, quantity, unit, customerKept },
          actorName
        );
        return NextResponse.json({ success: true, message: "Scrap item recorded", data: scrap });
      }

      case "return_to_store": {
        const { scrapId } = body;
        if (!scrapId) return NextResponse.json({ error: "scrapId is required" }, { status: 400 });
        const updated = await WorkshopService.returnScrapToStore(scrapId, actorName);
        return NextResponse.json({
          success: true,
          message: "Scrap received at store and recorded in scrap register",
          data: updated,
        });
      }

      case "dispose_or_sell": {
        const { scrapId, saleAmount, disposalNotes, actionType } = body;
        if (!scrapId || !actionType) {
          return NextResponse.json(
            { error: "scrapId and actionType ('sold' | 'disposed') are required" },
            { status: 400 }
          );
        }
        const updated = await WorkshopService.disposeOrSellScrap(
          scrapId,
          { saleAmount, disposalNotes, actionType },
          actorName
        );
        return NextResponse.json({
          success: true,
          message:
            actionType === "sold"
              ? "Scrap sold, revenue approved, and GL journal entry posted to Other Income"
              : "Scrap disposed with manager approval",
          data: updated,
        });
      }

      default:
        return NextResponse.json({ error: `Invalid action '${action}'` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("POST /api/workshops/scrap error:", err);
    return NextResponse.json({ error: err.message || "Failed to process scrap action" }, { status: 400 });
  }
}
