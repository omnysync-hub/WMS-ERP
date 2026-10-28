export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { resolveJobsActor, actorHasPermission } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;

    // Office notices only go to people whose role/permissions cover them (never to technicians).
    const actor = resolved.actor;
    const isTech = (actor?.role || "").toLowerCase() === "technician";
    const can = (key: string) => !!actor && !isTech && actorHasPermission(actor, key);
    const seeLeaves = can("hrm.manage_employees");
    const seeStock = can("inventory.view_stock");
    const seeDispatch = can("dispatch.assign_job") || can("jobs.reassign_tech");

    const [pendingLeaves, lowStockProducts, unassignedJobs] = await Promise.all([
      seeLeaves ? prisma.leaveRequest.count({ where: { status: "Pending" } }) : Promise.resolve(0),
      // Low stock = at or below each item's own reorder level.
      seeStock
        ? prisma.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*)::bigint AS n FROM "Product" WHERE "reorderLevel" > 0 AND "stockQuantity" <= "reorderLevel"`
            .then((r) => Number(r[0]?.n || 0))
        : Promise.resolve(0),
      seeDispatch
        ? prisma.job.count({ where: { status: "Pending", assignedTechnicianId: null } })
        : Promise.resolve(0),
    ]);

    const notifications: Array<{
      id: string;
      title: string;
      message: string;
      type: "info" | "warning" | "alert";
      createdAt: string;
      link?: string;
    }> = [];

    if (pendingLeaves > 0) {
      notifications.push({
        id: "notice-leaves",
        title: "Pending Leave Requests",
        message: `${pendingLeaves} employee leave request(s) awaiting HR review.`,
        type: "info",
        createdAt: new Date().toISOString(),
        link: "/hrm",
      });
    }

    if (lowStockProducts > 0) {
      notifications.push({
        id: "notice-stock",
        title: "Low Inventory Warning",
        message: `${lowStockProducts} item(s) are below reorder threshold.`,
        type: "warning",
        createdAt: new Date().toISOString(),
        link: "/inventory",
      });
    }

    if (unassignedJobs > 0) {
      notifications.push({
        id: "notice-jobs",
        title: "Unassigned Field Jobs",
        message: `${unassignedJobs} customer job(s) ready for technician dispatch.`,
        type: "alert",
        createdAt: new Date().toISOString(),
        link: "/dispatch",
      });
    }

    return NextResponse.json({ success: true, notifications });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
