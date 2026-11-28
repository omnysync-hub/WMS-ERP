export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { resolveJobsActor, actorHasPermission, type ErpActor } from "@/lib/auth/erpActor";
import { prisma } from "@/lib/prisma";

/**
 * Web notification bell feed ("Field Activity & Alerts").
 *
 * The feed is COMPUTED, not stored — every item is derived live from the
 * system state its audience acts on, and visibility is enforced HERE, on the
 * server, by the caller's effective permissions (role defaults + per-user
 * overrides via actorHasPermission; admin passes everything). The UI never
 * decides who may see what.
 *
 * Type → permission map:
 *   notice-leaves    Pending leave requests   → hrm.manage_employees
 *                    (the people who review/approve leave)
 *   notice-stock     Low inventory warning    → inventory.view_stock
 *                    (store / inventory roles watching stock levels)
 *   notice-jobs      Unassigned field jobs    → dispatch.assign_job OR
 *                    jobs.reassign_tech (the dispatchers who assign work)
 *   notice-discounts Pending discount requests→ jobs.approve_discount
 *                    (only users who can actually approve a discount; the
 *                    RealtimeRequestWatcher's count fallback relies on this
 *                    exact scoping and on the message's leading count)
 *   device-login-*   Blocked second-device    → audit.view_logs
 *                    login alerts               (the same permission that
 *                    guards the Audit & Rollbacks hub these events live in,
 *                    and the /audit page they link to)
 *
 * Technicians receive none of these office notices.
 *
 * Read state is per user (NotificationRead table). Items carry a content
 * `signature`: aggregate notices use "count:<n>" — a notice marked read at
 * count 5 stays read until the count next exceeds 5, so approvals draining
 * the queue never resurrect it, but new arrivals do. Discrete alerts use
 * "evt:<activityLogId>" and stay read once read. If the NotificationRead
 * table has not been applied yet (manual SQL step), the feed still works —
 * everything simply reports unread and mark-read answers stored:false.
 */

interface FeedItem {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "alert";
  createdAt: string;
  link?: string;
  signature: string;
}

const DEVICE_LOGIN_ACTION = "MOBILE_LOGIN_BLOCKED_DIFFERENT_DEVICE";
const DEVICE_ALERT_LIMIT = 20;

async function buildVisibleNotifications(actor: ErpActor): Promise<FeedItem[]> {
  // Office notices only go to people whose role/permissions cover them (never to technicians).
  const isTech = (actor.role || "").toLowerCase() === "technician";
  const can = (key: string) => !isTech && actorHasPermission(actor, key);
  const seeLeaves = can("hrm.manage_employees");
  const seeStock = can("inventory.view_stock");
  const seeDispatch = can("dispatch.assign_job") || can("jobs.reassign_tech");
  const seeDiscounts = can("jobs.approve_discount");
  const seeDeviceAlerts = can("audit.view_logs");

  const [pendingLeaves, lowStockProducts, unassignedJobs, pendingDiscountRequests, deviceAlerts] =
    await Promise.all([
      seeLeaves ? prisma.leaveRequest.count({ where: { status: "Pending" } }) : Promise.resolve(0),
      // Low stock = at or below each item's own reorder level.
      seeStock
        ? prisma.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*)::bigint AS n FROM "Product" WHERE "reorderLevel" > 0 AND "stockQuantity" <= "reorderLevel"`
            .then((r) => Number(r[0]?.n || 0))
        : Promise.resolve(0),
      seeDispatch
        ? prisma.job.count({ where: { status: "Pending", assignedTechnicianId: null } })
        : Promise.resolve(0),
      // Discount requests awaiting a jobs.approve_discount holder's decision.
      seeDiscounts
        ? prisma.jobDiscountRequest.count({ where: { status: "pending", job: { finalizedAt: null } } })
        : Promise.resolve(0),
      seeDeviceAlerts
        ? prisma.activityLog.findMany({
            where: { action: DEVICE_LOGIN_ACTION },
            orderBy: { timestamp: "desc" },
            take: DEVICE_ALERT_LIMIT,
            select: { id: true, actorName: true, timestamp: true, metadata: true },
          })
        : Promise.resolve([]),
    ]);

  const notifications: FeedItem[] = [];
  const now = new Date().toISOString();

  if (pendingLeaves > 0) {
    notifications.push({
      id: "notice-leaves",
      title: "Pending Leave Requests",
      message: `${pendingLeaves} employee leave request(s) awaiting HR review.`,
      type: "info",
      createdAt: now,
      link: "/hrm",
      signature: `count:${pendingLeaves}`,
    });
  }

  if (lowStockProducts > 0) {
    notifications.push({
      id: "notice-stock",
      title: "Low Inventory Warning",
      message: `${lowStockProducts} item(s) are below reorder threshold.`,
      type: "warning",
      createdAt: now,
      link: "/inventory",
      signature: `count:${lowStockProducts}`,
    });
  }

  if (unassignedJobs > 0) {
    notifications.push({
      id: "notice-jobs",
      title: "Unassigned Field Jobs",
      message: `${unassignedJobs} customer job(s) ready for technician dispatch.`,
      type: "alert",
      createdAt: now,
      link: "/dispatch",
      signature: `count:${unassignedJobs}`,
    });
  }

  if (pendingDiscountRequests > 0) {
    notifications.push({
      id: "notice-discounts",
      title: "Pending Discount Requests",
      message: `${pendingDiscountRequests} job discount request(s) awaiting your approval.`,
      type: "warning",
      createdAt: now,
      link: "/accounts?tab=discounts",
      signature: `count:${pendingDiscountRequests}`,
    });
  }

  // Discrete security alerts, newest first — same title/message the Topbar
  // used to build from /api/audit, now served (and gated) from this feed.
  for (const activity of deviceAlerts) {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = activity.metadata ? JSON.parse(activity.metadata) : {};
    } catch {
      metadata = {};
    }
    const attemptedDevice =
      typeof metadata.attemptedDeviceName === "string" && metadata.attemptedDeviceName
        ? metadata.attemptedDeviceName
        : "another device";
    notifications.push({
      id: `device-login-${activity.id}`,
      title: "Blocked second-device login",
      message: `${activity.actorName || "A technician"} tried to sign in from ${attemptedDevice}. The existing device session was kept active.`,
      type: "alert",
      createdAt: activity.timestamp.toISOString(),
      link: "/audit",
      signature: `evt:${activity.id}`,
    });
  }

  return notifications;
}

/** True when a stored read signature still covers the item's current state. */
function isCoveredByRead(item: FeedItem, storedSignature: string | undefined): boolean {
  if (storedSignature === undefined) return false;
  if (storedSignature === item.signature) return true;
  // Aggregate notices: read at a HIGHER count still covers a drained queue.
  const stored = /^count:(\d+)$/.exec(storedSignature);
  const current = /^count:(\d+)$/.exec(item.signature);
  if (stored && current) return Number(stored[1]) >= Number(current[1]);
  return false;
}

type ReadMap = Map<string, string>;

/** Read signatures for this user; empty map when the table is not applied yet. */
async function loadReads(userId: string): Promise<ReadMap> {
  try {
    const rows = await prisma.notificationRead.findMany({
      where: { userId },
      select: { notificationId: true, signature: true },
    });
    return new Map(rows.map((r) => [r.notificationId, r.signature]));
  } catch {
    // Table missing (SQL not applied yet) or transient DB error — degrade to
    // "everything unread" instead of failing the whole feed.
    return new Map();
  }
}

async function presentFeed(actor: ErpActor) {
  const items = await buildVisibleNotifications(actor);
  const reads = await loadReads(actor.id);
  const notifications = items.map((item) => ({
    id: item.id,
    title: item.title,
    message: item.message,
    type: item.type,
    createdAt: item.createdAt,
    link: item.link,
    signature: item.signature,
    read: isCoveredByRead(item, reads.get(item.id)),
  }));
  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
  };
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;

    const { notifications, unreadCount } = await presentFeed(resolved.actor);
    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Mark-as-read actions. The server recomputes the caller's OWN visible feed
 * and only ever marks items in it, storing the server's current signature —
 * a client cannot mark (or probe) notifications it cannot see.
 *
 *   POST { action: "mark_read", id }   → mark one visible item read
 *   POST { action: "mark_all_read" }   → mark every visible item read
 *
 * Answers 200 with { success, stored, unreadCount }; stored:false means the
 * NotificationRead table is not applied yet (see notification-read.sql).
 */
export async function POST(req: NextRequest) {
  try {
    const resolved = await resolveJobsActor(req);
    if (resolved.error) return resolved.error;
    const actor = resolved.actor;

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    if (action !== "mark_read" && action !== "mark_all_read") {
      return NextResponse.json({ error: "Unknown notifications action." }, { status: 400 });
    }

    const items = await buildVisibleNotifications(actor);
    let targets = items;
    if (action === "mark_read") {
      const id = typeof body?.id === "string" ? body.id : "";
      const target = items.find((item) => item.id === id);
      if (!target) {
        return NextResponse.json(
          { error: "Notification not found in your feed." },
          { status: 404 }
        );
      }
      targets = [target];
    }

    let stored = true;
    try {
      await Promise.all(
        targets.map((item) =>
          prisma.notificationRead.upsert({
            where: {
              userId_notificationId: { userId: actor.id, notificationId: item.id },
            },
            create: {
              userId: actor.id,
              notificationId: item.id,
              signature: item.signature,
              readAt: new Date(),
            },
            update: { signature: item.signature, readAt: new Date() },
          })
        )
      );
    } catch {
      // Table not applied yet — report a soft no-op instead of a 500.
      stored = false;
    }

    const { unreadCount } = await presentFeed(actor);
    return NextResponse.json({ success: true, stored, unreadCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
