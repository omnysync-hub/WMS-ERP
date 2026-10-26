export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { resolveJobsActor } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;

    // Fetch system event notices (pending approvals, low stock alerts, unassigned jobs)
    const [pendingLeaves, lowStockProducts, unassignedJobs] = await Promise.all([
      prisma.leaveRequest.count({ where: { status: "Pending" } }),
      prisma.product.count({
        where: {
          reorderLevel: { gt: 0 },
          stockQuantity: { lte: 5 },
        },
      }),
      prisma.job.count({
        where: {
          status: "Pending",
          assignedTechnicianId: null,
        },
      }),
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
