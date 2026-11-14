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
    const workshopType = searchParams.get("workshopType") || "all";
    const view = searchParams.get("view");

    if (view === "audits") {
      const audits = await prisma.workshopToolCount.findMany({
        where: workshopType !== "all" ? { workshopType } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ success: true, data: audits });
    }

    if (view === "issues") {
      const issues = await prisma.workshopToolIssue.findMany({
        where: {
          status: "issued",
          tool: workshopType !== "all" ? { workshopType: { in: [workshopType, "general"] } } : undefined,
        },
        include: {
          tool: true,
          jobCard: true,
        },
        orderBy: { issuedAt: "desc" },
      });
      return NextResponse.json({ success: true, data: issues });
    }

    const tools = await WorkshopService.listTools(workshopType);
    return NextResponse.json({ success: true, count: tools.length, data: tools });
  } catch (err: any) {
    console.error("GET /api/workshops/tools error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch tools" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { actor } = await resolveJobsActor(req);
    const actorName = actor?.name || "Workshop Supervisor";

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const { toolCode, name, category, workshopType, totalQuantity, location } = body;
        if (!toolCode || !name || !category) {
          return NextResponse.json(
            { error: "toolCode, name, and category are required" },
            { status: 400 }
          );
        }
        const tool = await WorkshopService.createTool({
          toolCode,
          name,
          category,
          workshopType: workshopType || "general",
          totalQuantity: Number(totalQuantity) || 1,
          location,
        });
        return NextResponse.json({ success: true, message: "Tool added to register", data: tool });
      }

      case "issue": {
        const { toolId, staffId, staffName, jobCardId, quantity, expectedReturnDate, notes } = body;
        if (!toolId || !staffName) {
          return NextResponse.json(
            { error: "toolId and staffName are required" },
            { status: 400 }
          );
        }
        const issue = await WorkshopService.issueTool({
          toolId,
          staffId,
          staffName,
          jobCardId,
          quantity: Number(quantity) || 1,
          expectedReturnDate: expectedReturnDate ? new Date(expectedReturnDate) : undefined,
          notes,
          issuedBy: actorName,
        });
        return NextResponse.json({ success: true, message: "Tool issued successfully", data: issue });
      }

      case "return": {
        const { issueId, returnCondition, notes } = body;
        if (!issueId || !returnCondition) {
          return NextResponse.json(
            { error: "issueId and returnCondition are required" },
            { status: 400 }
          );
        }
        const returned = await WorkshopService.returnTool(issueId, {
          returnCondition,
          notes,
          returnedBy: actorName,
        });
        return NextResponse.json({ success: true, message: "Tool returned to register", data: returned });
      }

      case "audit": {
        const { workshopType, auditMonth, totalToolsCounted, discrepancyCount, verifiedBy, notes } = body;
        if (!workshopType || !auditMonth) {
          return NextResponse.json(
            { error: "workshopType and auditMonth are required" },
            { status: 400 }
          );
        }
        const audit = await WorkshopService.recordToolAudit({
          workshopType,
          auditMonth,
          countedBy: actorName,
          verifiedBy,
          totalToolsCounted: Number(totalToolsCounted) || 0,
          discrepancyCount: Number(discrepancyCount) || 0,
          notes,
        });
        return NextResponse.json({ success: true, message: "Tool audit recorded", data: audit });
      }

      default:
        return NextResponse.json({ error: `Invalid action '${action}'` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("POST /api/workshops/tools error:", err);
    return NextResponse.json({ error: err.message || "Failed to process tool action" }, { status: 400 });
  }
}
