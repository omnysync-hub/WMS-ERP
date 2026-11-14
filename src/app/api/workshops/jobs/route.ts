export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WorkshopService, WorkshopType } from "@/lib/services/WorkshopService";
import { resolveJobsActor } from "@/lib/auth/erpActor";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workshopType = searchParams.get("workshopType") as WorkshopType | null;
    const status = searchParams.get("status");
    const assignedStaffId = searchParams.get("assignedStaffId");
    const customerId = searchParams.get("customerId");
    const search = searchParams.get("search");
    const id = searchParams.get("id");

    if (id) {
      const single = await prisma.workshopJobCard.findUnique({
        where: { id },
        include: {
          customer: true,
          assignedEmployee: true,
          requisitions: {
            include: { product: true },
            orderBy: { createdAt: "desc" },
          },
          scrapItems: {
            orderBy: { createdAt: "desc" },
          },
          toolIssues: {
            include: { tool: true },
            orderBy: { createdAt: "desc" },
          },
          statusLogs: {
            orderBy: { changedAt: "desc" },
          },
        },
      });

      if (!single) {
        return NextResponse.json({ error: "Workshop Job Card not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: single });
    }

    const where: any = {};
    if (workshopType) where.workshopType = workshopType;
    if (status && status !== "ALL") where.status = status;
    if (assignedStaffId) where.assignedStaffId = assignedStaffId;
    if (customerId) where.customerId = customerId;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { jobNumber: { contains: q, mode: "insensitive" } },
        { bikeRegNo: { contains: q, mode: "insensitive" } },
        { chassisNumber: { contains: q, mode: "insensitive" } },
        { engineNumber: { contains: q, mode: "insensitive" } },
        { bikeMakeModel: { contains: q, mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { brandModel: { contains: q, mode: "insensitive" } },
        { unitType: { contains: q, mode: "insensitive" } },
        { customerName: { contains: q, mode: "insensitive" } },
        { customerPhone: { contains: q, mode: "insensitive" } },
        { complaint: { contains: q, mode: "insensitive" } },
      ];
    }

    const jobs = await prisma.workshopJobCard.findMany({
      where,
      include: {
        customer: true,
        assignedEmployee: true,
        requisitions: true,
        scrapItems: true,
        toolIssues: {
          where: { status: "issued" },
        },
        statusLogs: {
          take: 3,
          orderBy: { changedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, count: jobs.length, data: jobs });
  } catch (err: any) {
    console.error("GET /api/workshops/jobs error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch workshop jobs" }, { status: 500 });
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
        const job = await WorkshopService.createJobCard(body, actorName);
        return NextResponse.json({ success: true, message: "Job card created successfully", data: job });
      }

      case "assign": {
        const { jobCardId, staffId, staffName } = body;
        if (!jobCardId || !staffId || !staffName) {
          return NextResponse.json(
            { error: "jobCardId, staffId, and staffName are required" },
            { status: 400 }
          );
        }
        const updated = await WorkshopService.assignStaff(jobCardId, staffId, staffName, actorName);
        return NextResponse.json({ success: true, message: "Staff assigned successfully", data: updated });
      }

      case "diagnose": {
        const { jobCardId, inspectionFindings, workRequired, estimatedHours, estimatedCost } = body;
        if (!jobCardId || !inspectionFindings || !workRequired) {
          return NextResponse.json(
            { error: "jobCardId, inspectionFindings, and workRequired are required" },
            { status: 400 }
          );
        }
        const updated = await WorkshopService.saveDiagnosis(
          jobCardId,
          { inspectionFindings, workRequired, estimatedHours, estimatedCost },
          actorName
        );
        return NextResponse.json({
          success: true,
          message: "Diagnosis submitted for manager approval",
          data: updated,
        });
      }

      case "approve_diagnosis":
      case "approve": {
        const { jobCardId, reason } = body;
        if (!jobCardId) return NextResponse.json({ error: "jobCardId is required" }, { status: 400 });
        const updated = await WorkshopService.approveOrRejectDiagnosis(
          jobCardId,
          "approve",
          reason,
          actorName
        );
        return NextResponse.json({
          success: true,
          message: "Diagnosis approved. Work can now commence.",
          data: updated,
        });
      }

      case "reject_diagnosis":
      case "reject": {
        const { jobCardId, reason } = body;
        if (!jobCardId) return NextResponse.json({ error: "jobCardId is required" }, { status: 400 });
        const updated = await WorkshopService.approveOrRejectDiagnosis(
          jobCardId,
          "reject",
          reason,
          actorName
        );
        return NextResponse.json({
          success: true,
          message: "Diagnosis rejected.",
          data: updated,
        });
      }

      case "request_material": {
        const { jobCardId, items } = body;
        if (!jobCardId || !Array.isArray(items) || items.length === 0) {
          return NextResponse.json(
            { error: "jobCardId and an array of items are required" },
            { status: 400 }
          );
        }
        const requisitions = await WorkshopService.requestMaterial(jobCardId, items, actorName);
        return NextResponse.json({
          success: true,
          message: "Material requisition submitted to Store Keeper",
          data: requisitions,
        });
      }

      case "issue_material": {
        const { requisitionId, issuedQty } = body;
        if (!requisitionId || issuedQty == null) {
          return NextResponse.json(
            { error: "requisitionId and issuedQty are required" },
            { status: 400 }
          );
        }
        const updated = await WorkshopService.issueMaterial(
          requisitionId,
          Number(issuedQty),
          actorName
        );
        return NextResponse.json({
          success: true,
          message: "Material issued against job card and ERP stock updated",
          data: updated,
        });
      }

      case "return_material": {
        const { requisitionId, returnedQty, returnReason } = body;
        if (!requisitionId || returnedQty == null || !returnReason) {
          return NextResponse.json(
            { error: "requisitionId, returnedQty, and returnReason are required" },
            { status: 400 }
          );
        }
        const updated = await WorkshopService.returnMaterial(
          requisitionId,
          Number(returnedQty),
          returnReason,
          actorName
        );
        return NextResponse.json({
          success: true,
          message: "Unused material returned to store and inventory adjusted",
          data: updated,
        });
      }

      case "record_testing":
      case "test": {
        const { jobCardId, testingPressurePsi, testingLeakTest, testingRunTestAmps, testingNotes } = body;
        if (!jobCardId) return NextResponse.json({ error: "jobCardId is required" }, { status: 400 });
        const updated = await WorkshopService.recordTesting(
          jobCardId,
          { testingPressurePsi, testingLeakTest, testingRunTestAmps, testingNotes },
          actorName
        );
        return NextResponse.json({
          success: true,
          message: "Testing results logged successfully",
          data: updated,
        });
      }

      case "complete_job":
      case "complete": {
        const { jobCardId, workDoneSummary } = body;
        if (!jobCardId || !workDoneSummary) {
          return NextResponse.json(
            { error: "jobCardId and workDoneSummary are required" },
            { status: 400 }
          );
        }
        const updated = await WorkshopService.completeJob(jobCardId, workDoneSummary, actorName);
        return NextResponse.json({
          success: true,
          message: "Job marked Completed. Handover for returnable items & final close.",
          data: updated,
        });
      }

      case "record_scrap": {
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
        return NextResponse.json({
          success: true,
          message: "Scrap item recorded against job card",
          data: scrap,
        });
      }

      case "close_job":
      case "close": {
        const { jobCardId, closeNotes, deliveryStatus, deliveredTo } = body;
        if (!jobCardId) return NextResponse.json({ error: "jobCardId is required" }, { status: 400 });
        const updated = await WorkshopService.closeJobCard(
          jobCardId,
          { closeNotes, deliveryStatus, deliveredTo },
          actorName
        );
        return NextResponse.json({
          success: true,
          message: "Job card closed and unit ready for delivery",
          data: updated,
        });
      }

      default:
        return NextResponse.json(
          { error: `Invalid or unrecognized action: '${action}'` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error("POST /api/workshops/jobs error:", err);
    return NextResponse.json({ error: err.message || "Failed to process workshop action" }, { status: 400 });
  }
}
