export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireJobsPermission, resolveJobsActor } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";
import { JobsService } from "@/lib/services/JobsService";
import { AuditService } from "@/lib/services/AuditService";
import { createCareOfParty } from "@/lib/careOfLedger";
import { generateJobNumber } from "@/lib/sequenceUtils";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    let technicianId = searchParams.get("technicianId");
    const customerId = searchParams.get("customerId");
    const search = searchParams.get("search");
    const hasInventoryRequest = searchParams.get("hasInventoryRequest") === "true";

    const gate = await requireJobsPermission(req, "jobs.view_directory");
    if (gate.error) return gate.error;
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    if (gate.actor.role === "technician") {
      // A field user can only list jobs assigned to their own account, even if
      // a different technicianId is supplied in the URL.
      technicianId = gate.actor.id;
    }

    const where: any = {};
    if (customerId) where.customerId = customerId;
    if (status && status !== "ALL") where.status = status;
    if (technicianId) {
      // Include jobs where tech is primary assignee OR active JobAssignment member
      where.OR = [
        { assignedTechnicianId: technicianId },
        {
          assignments: {
            some: {
              technicianId,
              status: { not: "Removed" },
            },
          },
        },
      ];
    }
    if (hasInventoryRequest) {
      where.inventoryRequests = { some: {} };
    }
    if (search) {
      const searchClause = [
        { jobNumber: { contains: search } },
        { remarks: { contains: search } },
        { customer: { name: { contains: search } } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchClause }];
        delete where.OR;
      } else {
        where.OR = searchClause;
      }
    }

    // Lite list for the field app (?view=mobile): explicit select whitelist
    // instead of the deep include below. Drops the heavy payload — the
    // completionPhotos JSON (base64 proof photos), the full Employee record
    // (incl. the 512-value faceEmbedding) and the unbounded hisaab /
    // inventory-request / stock-return / status-history collections — that
    // list screens never display. The full payload stays available from
    // GET /api/jobs/[id], which the app's detail screen already uses.
    // expenseClaims is deliberately kept: the app's Expenses tab reads
    // claims straight off the list payload and has no other data source.
    // Supports limit + cursor pagination and updatedSince. NOTE: Job has
    // no updatedAt column in the schema, so updatedSince filters on
    // createdAt (the closest durable timestamp) rather than failing.
    if (searchParams.get("view") === "mobile") {
      const rawLimit = parseInt(searchParams.get("limit") || "200", 10);
      const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 200, 1), 500);
      const cursor = searchParams.get("cursor");
      const updatedSince = searchParams.get("updatedSince");
      if (updatedSince) {
        const since = new Date(updatedSince);
        if (!isNaN(since.getTime())) {
          where.createdAt = { gte: since };
        }
      }

      const page = await prisma.job.findMany({
        where,
        select: {
          id: true,
          jobNumber: true,
          customerId: true,
          careOfPartyId: true,
          manualJobNumber: true,
          jobType: true,
          remarks: true,
          status: true,
          assignedTechnicianId: true,
          parentJobId: true,
          reassignedFromJobId: true,
          isFoc: true,
          focReason: true,
          focApprovedBy: true,
          focApprovedAt: true,
          focAmountReceived: true,
          focPaymentReceivedAt: true,
          focPaymentRef: true,
          paymentCollectionMode: true,
          discountAmount: true,
          discountReason: true,
          qualityFlag: true,
          verifiedChecklist: true,
          createdAt: true,
          finalizedAt: true,
          verifiedAt: true,
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              addressText: true,
              lat: true,
              lng: true,
            },
          },
          assignedTechnician: {
            select: { id: true, name: true, phone: true },
          },
          assignments: {
            where: { status: { not: "Removed" } },
            select: {
              id: true,
              jobId: true,
              technicianId: true,
              role: true,
              status: true,
              assignedAt: true,
              assignedBy: true,
              acceptedAt: true,
              notes: true,
              technician: { select: { id: true, name: true, phone: true } },
            },
          },
          items: true,
          expenseClaims: true,
        },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });

      const hasMore = page.length > limit;
      const liteJobs = hasMore ? page.slice(0, limit) : page;
      return NextResponse.json({
        jobs: liteJobs,
        nextCursor: hasMore ? liteJobs[liteJobs.length - 1].id : null,
      });
    }

    const jobs = await prisma.job.findMany({
      where,
      include: {
        customer: true,
        careOfParty: true,
        assignedTechnician: true,
        parentJob: { select: { id: true, jobNumber: true, status: true } },
        childJobs: { select: { id: true, jobNumber: true, status: true } },
        assignments: {
          where: { status: { not: "Removed" } },
          include: { technician: { select: { id: true, name: true, phone: true } } },
        },
        items: true,
        expenseClaims: true,
        hisaabSettlements: {
          orderBy: { settledAt: "desc" },
        },
        inventoryRequests: true,
        stockReturns: true,
        statusHistory: {
          orderBy: { changedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(jobs);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Batch accept (mobile): { action: "batch_accept", jobIds: [], technicianId }
    if (body.action === "batch_accept" || body.action === "accept_jobs") {
      const gate = await requireJobsPermission(req, "jobs.accept");
      if (gate.error) return gate.error;
      const { jobIds } = body;
      // Verified mobile technician: accept strictly as self
      const technicianId =
        (req.headers.get("authorization") || "").startsWith("Bearer ") && gate.actor.role === "technician"
          ? gate.actor.id
          : body.technicianId;
      if (!technicianId) {
        return NextResponse.json({ error: "technicianId required" }, { status: 400 });
      }
      const result = await JobsService.acceptJobs(jobIds || [], technicianId);
      return NextResponse.json(result);
    }

    const createGate = await requireJobsPermission(req, "jobs.create_job");
    if (createGate.error) return createGate.error;

    const {
      customerId,
      careOfPartyId,
      careOfCompanyName,
      careOfPersonName,
      manualJobNumber,
      isFoc,
      focReason,
      paymentCollectionMode,
      jobType,
      remarks,
      items,
      assignedTechnicianId,
      technicianIds,
    } = body;

    if (!customerId || !jobType) {
      return NextResponse.json(
        { error: "Customer and job type are required." },
        { status: 400 }
      );
    }

    // FOC = referred by an external company: must be linked to that company (Care-Of party).
    const wantsFoc = Boolean(isFoc);
    const focReasonText = typeof focReason === "string" ? focReason.trim() : "";
    if (wantsFoc && !careOfPartyId && !(typeof careOfCompanyName === "string" && careOfCompanyName.trim())) {
      return NextResponse.json(
        { error: "An FOC job must name the referring company (Care-Of party)." },
        { status: 400 }
      );
    }
    const collectionMode = paymentCollectionMode === "office" ? "office" : "technician";

    // Qty is mandatory on every job item: reject missing / non-numeric / <= 0
    // quantities instead of silently defaulting them to 1.
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const qty = Number(items[i]?.quantityPlanned);
        if (!Number.isFinite(qty) || qty <= 0) {
          return NextResponse.json(
            { error: `Qty is required and must be greater than zero for job item ${i + 1}.` },
            { status: 400 }
          );
        }
      }
    }

    let effectiveCareOfId = careOfPartyId || null;
    if (!effectiveCareOfId && careOfCompanyName && typeof careOfCompanyName === "string" && careOfCompanyName.trim()) {
      let existingParty = await prisma.careOfParty.findFirst({
        where: {
          companyName: {
            equals: careOfCompanyName.trim(),
            mode: "insensitive",
          },
        },
      });
      if (!existingParty) {
        existingParty = await createCareOfParty(prisma, {
          companyName: careOfCompanyName.trim(),
          personName: careOfPersonName?.trim() || "",
        });
      }
      effectiveCareOfId = existingParty.id;
    }

    const jobNumber = await generateJobNumber();

    const effectivePrimaryId =
      assignedTechnicianId ||
      (Array.isArray(technicianIds) && technicianIds.length > 0 ? technicianIds[0] : null);

    const allAssignees = Array.from(
      new Set(
        [
          ...(Array.isArray(technicianIds) ? technicianIds : []),
          effectivePrimaryId,
        ].filter(Boolean)
      )
    ) as string[];

    if (allAssignees.length > 0) {
      try {
        await JobsService.assertTechniciansCheckedIn(allAssignees);
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    const job = await prisma.job.create({
      data: {
        jobNumber,
        customerId,
        careOfPartyId: effectiveCareOfId,
        manualJobNumber: manualJobNumber || null,
        isFoc: wantsFoc,
        focReason: wantsFoc ? focReasonText || null : null,
        focApprovedBy: wantsFoc ? createGate.actor.name || null : null,
        focApprovedAt: wantsFoc ? new Date() : null,
        paymentCollectionMode: collectionMode,
        jobType,
        remarks: remarks || "",
        status: effectivePrimaryId ? "Assigned" : "Created",
        assignedTechnicianId: effectivePrimaryId || null,
        ...(items && items.length > 0
          ? {
              items: {
                create: items.map((it: any) => ({
                  description: it.description,
                  quantityPlanned: Number(it.quantityPlanned),
                  unitRate: Number(it.unitRate) || 0,
                })),
              },
            }
          : {}),
      },
      include: {
        customer: true,
        items: true,
      },
    });

    await JobsService.logStatusChange(
      job.id,
      "None",
      job.status,
      createGate.actor.name || "Dispatcher",
      { initialItems: items }
    );

    await AuditService.recordCrudAction({
      actorName: createGate.actor.name || "Dispatcher",
      actorRole: createGate.actor.role || "dispatcher",
      actorId: createGate.actor.id,
      entityType: "Job",
      entityId: job.id,
      entityNumber: job.jobNumber,
      actionType: "CREATE",
      description: `Created Work Order ${job.jobNumber} for ${job.customer?.name} (${job.jobType})`,
      stateBefore: null,
      stateAfter: {
        id: job.id,
        jobNumber: job.jobNumber,
        customerId: job.customerId,
        jobType: job.jobType,
        status: job.status,
        remarks: job.remarks,
        assignedTechnicianId: job.assignedTechnicianId,
        items: job.items,
      },
      canRollback: true,
    });

    // If any items are linked to inventory products, register pending inventory requests for the warehouse
    if (items && items.length > 0) {
      for (const it of items) {
        if (it.productId) {
          try {
            await prisma.inventoryRequest.create({
              data: {
                jobId: job.id,
                technicianId: assignedTechnicianId || "warehouse_dispatch",
                item: it.description,
                productId: it.productId,
                qtyRequested: Number(it.quantityPlanned),
                qtyIssued: 0,
                status: "pending",
              },
            });
          } catch (e) {
            console.error("Failed to create inventory request for job item:", e);
          }
        }
      }
    }

    const multiIds: string[] = Array.isArray(technicianIds)
      ? technicianIds.filter(Boolean)
      : assignedTechnicianId
        ? [assignedTechnicianId]
        : [];

    if (multiIds.length > 0) {
      try {
        await JobsService.assignTechnicians(
          job.id,
          multiIds,
          "Dispatcher",
          assignedTechnicianId || multiIds[0]
        );
      } catch (e) {
        console.error("Failed to sync JobAssignment on create:", e);
        if (assignedTechnicianId) {
          await JobsService.notifyJobAssignedIfNeeded(job, "Dispatcher");
        }
      }
    }

    const fresh = await prisma.job.findUnique({
      where: { id: job.id },
      include: {
        customer: true,
        items: true,
        assignedTechnician: true,
        assignments: { where: { status: { not: "Removed" } }, include: { technician: true } },
      },
    });

    return NextResponse.json(fresh || job, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
