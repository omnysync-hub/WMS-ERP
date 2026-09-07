import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/lib/services/AuditService";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "all";
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const actor = searchParams.get("actor");
    const entityType = searchParams.get("entityType");

    // Check if we need to seed initial demonstration audit & rollback records
    const [actCount, rollCount] = await Promise.all([
      prisma.activityLog.count(),
      prisma.rollbackLog.count(),
    ]);

    if (actCount === 0 || rollCount === 0) {
      await seedInitialAuditData();
    }

    // Fetch Activities
    const activityWhere: any = {};
    if (category && category !== "ALL") activityWhere.category = category;
    if (actor && actor !== "ALL") activityWhere.actorName = { contains: actor };
    if (search) {
      activityWhere.OR = [
        { action: { contains: search } },
        { actorName: { contains: search } },
        { target: { contains: search } },
      ];
    }

    const activities = await prisma.activityLog.findMany({
      where: activityWhere,
      orderBy: { timestamp: "desc" },
      take: 100,
    });

    // Fetch Rollbacks
    const rollbackWhere: any = {};
    if (entityType && entityType !== "ALL") rollbackWhere.entityType = entityType;
    if (actor && actor !== "ALL") rollbackWhere.actorName = { contains: actor };
    if (search) {
      rollbackWhere.OR = [
        { action: { contains: search } },
        { entityNumber: { contains: search } },
        { actorName: { contains: search } },
      ];
    }

    const rollbacks = await prisma.rollbackLog.findMany({
      where: rollbackWhere,
      orderBy: { timestamp: "desc" },
      take: 100,
    });

    // Summary Stats
    const totalActivities = await prisma.activityLog.count();
    const totalRollbacks = await prisma.rollbackLog.count();
    const availableForRollback = await prisma.rollbackLog.count({
      where: { status: "ACTIVE", canRollback: true },
    });
    const executedRollbacks = await prisma.rollbackLog.count({
      where: { status: "ROLLED_BACK" },
    });

    return NextResponse.json({
      success: true,
      activities,
      rollbacks,
      stats: {
        totalActivities,
        totalRollbacks,
        availableForRollback,
        executedRollbacks,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...payload } = body;

    switch (action) {
      case "log_activity": {
        const activityPayload = (payload as any).activity || payload;
        const log = await AuditService.logActivity({
          actorName: activityPayload.actorName || "Haris Qureshi",
          actorRole: activityPayload.actorRole || "admin",
          actorId: activityPayload.actorId,
          category: activityPayload.category || "UI_CLICK",
          action: activityPayload.actionText || activityPayload.action || "User interaction",
          target: activityPayload.target || "System Interface",
          metadata: activityPayload.metadata,
          ipAddress: activityPayload.ipAddress || req.headers.get("x-forwarded-for") || "127.0.0.1 (Local Session)",
        });
        return NextResponse.json({ success: true, log }, { status: 201 });
      }

      case "rollback": {
        const { rollbackLogId, rolledBackBy, reason } = payload;
        if (!rollbackLogId) {
          return NextResponse.json({ error: "Missing rollbackLogId" }, { status: 400 });
        }
        const result = await AuditService.executeRollback(
          rollbackLogId,
          rolledBackBy || "Haris Qureshi (Admin)",
          reason || "User triggered instant state rollback"
        );
        return NextResponse.json({ success: true, rollback: result });
      }

      case "clear_activities": {
        await prisma.activityLog.deleteMany();
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function seedInitialAuditData() {
  const jobs = await prisma.job.findMany({ take: 3, include: { items: true, customer: true } });

  // Seed sample reversible rollback snapshots
  if (jobs.length > 0) {
    const j1 = jobs[0];
    await prisma.rollbackLog.create({
      data: {
        entityType: "Job",
        entityId: j1.id,
        entityNumber: j1.jobNumber,
        action: "Status transitioned: Created → Assigned to Ali Hassan",
        actorName: "Zeeshan Ahmed",
        actorRole: "dispatcher",
        stateBefore: JSON.stringify({ status: "Created", assignedTechnicianId: null }),
        stateAfter: JSON.stringify({ status: "Assigned", assignedTechnicianId: j1.assignedTechnicianId }),
        status: "ACTIVE",
        canRollback: true,
        reason: "Dispatched to technician Ali Hassan based on proximity",
        timestamp: new Date(Date.now() - 3600000 * 3),
      },
    });

    await prisma.rollbackLog.create({
      data: {
        entityType: "Discount",
        entityId: j1.id,
        entityNumber: j1.jobNumber,
        action: "Discount applied: PKR 4,500 on 2-Ton Inverter Compressor",
        actorName: "Fatima Noor",
        actorRole: "accountant",
        stateBefore: JSON.stringify({ discountAmount: 0, discountReason: null }),
        stateAfter: JSON.stringify({ discountAmount: 4500, discountReason: "Mid-job distributor price-match" }),
        status: "ACTIVE",
        canRollback: true,
        reason: "Customer price-match approval",
        timestamp: new Date(Date.now() - 3600000 * 2),
      },
    });

    if (jobs.length > 1) {
      const j2 = jobs[1];
      await prisma.rollbackLog.create({
        data: {
          entityType: "Job",
          entityId: j2.id,
          entityNumber: j2.jobNumber,
          action: "Status paused: 3 AC units fitted, 2 remaining tomorrow",
          actorName: "Tariq Mehmood",
          actorRole: "technician",
          stateBefore: JSON.stringify({ status: "InProgress" }),
          stateAfter: JSON.stringify({ status: "Paused", note: "Working hours finished" }),
          status: "ACTIVE",
          canRollback: true,
          reason: "Overnight pause",
          timestamp: new Date(Date.now() - 3600000 * 5),
        },
      });
    }
  } else {
    // Fallback demonstration rollback records
    await prisma.rollbackLog.create({
      data: {
        entityType: "Job",
        entityId: "demo-job-001",
        entityNumber: "JOB-2026-0001",
        action: "Status transitioned: Created → Assigned to Ali Raza",
        actorName: "Zeeshan Ahmed",
        actorRole: "dispatcher",
        stateBefore: JSON.stringify({ status: "Created", assignedTechnicianId: null }),
        stateAfter: JSON.stringify({ status: "Assigned", assignedTechnicianId: "tech-ali-raza" }),
        status: "ACTIVE",
        canRollback: true,
        reason: "Dispatched to technician Ali Raza based on proximity",
        timestamp: new Date(Date.now() - 3600000 * 3),
      },
    });
    await prisma.rollbackLog.create({
      data: {
        entityType: "Discount",
        entityId: "demo-job-002",
        entityNumber: "JOB-2026-0002",
        action: "Discount applied: PKR 4,500 on 2-Ton Inverter Compressor",
        actorName: "Fatima Noor",
        actorRole: "accountant",
        stateBefore: JSON.stringify({ discountAmount: 0, discountReason: null }),
        stateAfter: JSON.stringify({ discountAmount: 4500, discountReason: "Mid-job distributor price-match" }),
        status: "ACTIVE",
        canRollback: true,
        reason: "Customer price-match approval",
        timestamp: new Date(Date.now() - 3600000 * 2),
      },
    });
  }

  // Seed sample real-time click and telemetry events
  const sampleActivities = [
    {
      actorName: "Haris Qureshi",
      actorRole: "admin",
      category: "ROLE_SWITCH",
      action: "Switched active persona to Administrator (Haris Qureshi)",
      target: "Topbar: UserProfileMenu",
      metadata: { department: "Executive Management", permissions: "Full Access" },
      timestamp: new Date(Date.now() - 3600000 * 4),
    },
    {
      actorName: "Zeeshan Ahmed",
      actorRole: "dispatcher",
      category: "UI_CLICK",
      action: "Clicked 'Dispatch Technician' drawer button on proximity map",
      target: "button#dispatch-tech-btn",
      metadata: { coordinates: "25.2048, 55.2708", tech: "Ali Hassan" },
      timestamp: new Date(Date.now() - 3600000 * 3.5),
    },
    {
      actorName: "Fatima Noor",
      actorRole: "accountant",
      category: "NAVIGATION",
      action: "Navigated to Accounts & Ledgers screen",
      target: "/accounts?tab=general-ledger",
      metadata: { previousRoute: "/jobs" },
      timestamp: new Date(Date.now() - 3600000 * 2.8),
    },
    {
      actorName: "Bilal Sheikh",
      actorRole: "storekeeper",
      category: "DATA_MUTATION",
      action: "Issued 2x R410A Refrigerant Cylinders to Technician Ali Hassan",
      target: "InventoryRequest:REQ-2026-0012",
      metadata: { warehouseStockBefore: 57, warehouseStockAfter: 55 },
      timestamp: new Date(Date.now() - 3600000 * 2.1),
    },
    {
      actorName: "Fatima Noor",
      actorRole: "accountant",
      category: "UI_CLICK",
      action: "Clicked 'Approve Discount' on Job #JOB-2026-0001",
      target: "button#approve-discount-confirm",
      metadata: { discountApproved: 45, currency: "AED" },
      timestamp: new Date(Date.now() - 3600000 * 1.5),
    },
    {
      actorName: "Ali Hassan",
      actorRole: "technician",
      category: "UI_CLICK",
      action: "Clicked 'Send Request to Store' in Mobile Companion App",
      target: "MobileApp: RequestStoreMaterialsModal",
      metadata: { item: "2-Ton Inverter Compressor", qty: 1 },
      timestamp: new Date(Date.now() - 3600000 * 0.8),
    },
    {
      actorName: "Sara Bilal",
      actorRole: "hr",
      category: "UI_CLICK",
      action: "Approved Leave Request for Tariq Mahmood (Annual Leave 3 days)",
      target: "HRM: LeaveApprovalDrawer",
      metadata: { daysApproved: 3, leaveType: "Annual Leave" },
      timestamp: new Date(Date.now() - 3600000 * 0.4),
    },
    {
      actorName: "Haris Qureshi",
      actorRole: "admin",
      category: "SEARCH",
      action: "Queried Universal Search for 'Ali Hassan'",
      target: "input#universal-search",
      metadata: { query: "Ali Hassan", resultsCount: 4 },
      timestamp: new Date(Date.now() - 60000 * 10),
    },
  ];

  for (const act of sampleActivities) {
    await prisma.activityLog.create({
      data: {
        actorName: act.actorName,
        actorRole: act.actorRole,
        category: act.category as any,
        action: act.action,
        target: act.target,
        metadata: JSON.stringify(act.metadata),
        ipAddress: "192.168.1.104 (Dubai HQ)",
        timestamp: act.timestamp,
      },
    });
  }
}
