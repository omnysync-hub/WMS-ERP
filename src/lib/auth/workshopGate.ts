/**
 * Workshop role gates — client role-spec enforcement for /api/workshops.
 *
 * The workshop apps (Bikes / HVAC) gate SOP steps by a "workshop role" that is
 * derived from the person's ERP role + designation, not from the ERP role
 * alone:
 *   - ERP role admin OR designation containing "manager"    -> manager
 *   - designation containing "supervisor"                   -> supervisor
 *   - ERP role storekeeper OR designation containing "store" -> storekeeper
 *   - otherwise                                             -> mechanic
 *
 * Until now the API only role-gated a few high-value steps (approve / close /
 * issue material) and left the rest auth-only. These helpers close that gap
 * server-side so the spec holds no matter which client calls the API.
 *
 * Safety rule: a caller's workshop identity is the HIGHEST role supported by
 * either signal (signed ERP role, or the linked Employee record's role +
 * designation), so nobody who legitimately works today loses access. The
 * mechanic default only counts for genuine workshop staff (field roles or a
 * workshop designation) — an unrelated office role (accountant, cashier, ...)
 * never silently becomes a "mechanic".
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { actorHasPermission, type ErpActor } from "@/lib/auth/erpActor";

export type WorkshopRole = "manager" | "supervisor" | "storekeeper" | "mechanic";

const ROLE_RANK: Record<WorkshopRole, number> = {
  mechanic: 0,
  storekeeper: 1,
  supervisor: 2,
  manager: 3,
};

/** Derive the workshop role from a single (ERP role, designation) pair. */
export function workshopRoleFor(role: string | undefined, designation?: string | null): WorkshopRole {
  const r = (role || "").toLowerCase();
  const d = (designation || "").toLowerCase();
  if (r === "admin" || d.includes("manager")) return "manager";
  if (d.includes("supervisor")) return "supervisor";
  if (r === "storekeeper" || d.includes("store")) return "storekeeper";
  return "mechanic";
}

export interface WorkshopIdentity {
  workshopRole: WorkshopRole;
  /**
   * True when the actor is genuinely workshop staff: a field ERP role
   * (technician / storekeeper / manager / admin) or a workshop designation.
   * Office roles without such a signal are NOT workshop staff even though
   * their fallback workshop role computes to "mechanic".
   */
  isWorkshopStaff: boolean;
}

const FIELD_ERP_ROLES = new Set(["technician", "storekeeper", "manager", "admin"]);

function hasWorkshopDesignation(designation?: string | null): boolean {
  const d = (designation || "").toLowerCase();
  return d.includes("manager") || d.includes("supervisor") || d.includes("store");
}

/**
 * Resolve the actor's workshop identity. The actor id is the Employee id for
 * mobile sessions; for web sessions the Employee is found via its unique
 * `erpUserId` link. Falls back to the signed ERP role alone when no employee
 * record is linked.
 */
export async function resolveWorkshopIdentity(actor: ErpActor): Promise<WorkshopIdentity> {
  const actorRole = (actor?.role || "").toLowerCase();

  // Signal 1: the signed ERP role on its own.
  let best = workshopRoleFor(actorRole, null);
  let isStaff = FIELD_ERP_ROLES.has(actorRole);

  // Signal 2: the linked Employee record (authoritative role + designation).
  if (actor?.id && actor.id !== "anonymous") {
    try {
      const select = { role: true, designation: true } as const;
      const emp =
        (await prisma.employee.findUnique({ where: { id: actor.id }, select })) ||
        (await prisma.employee.findUnique({ where: { erpUserId: actor.id }, select }));
      if (emp) {
        const fromEmployee = workshopRoleFor(emp.role, emp.designation);
        if (ROLE_RANK[fromEmployee] > ROLE_RANK[best]) best = fromEmployee;
        if (FIELD_ERP_ROLES.has((emp.role || "").toLowerCase()) || hasWorkshopDesignation(emp.designation)) {
          isStaff = true;
        }
      }
    } catch {
      // DB lookup failed: fall back to the signed role alone.
    }
  }

  return { workshopRole: best, isWorkshopStaff: isStaff };
}

function denied(actor: ErpActor, requirement: string): NextResponse {
  return NextResponse.json(
    {
      error: `Forbidden: this workshop action requires ${requirement}; your role is '${actor?.role}'.`,
      code: "PERMISSION_DENIED",
      role: actor?.role,
    },
    { status: 403 }
  );
}

export interface WorkshopActionAllowance {
  /** Workshop roles allowed to perform the action (workshop staff only). */
  workshopRoles?: WorkshopRole[];
  /** ERP roles allowed regardless of workshop role (office-side actors). */
  erpRoles?: string[];
}

/**
 * Gate a workshop POST action by workshop role and/or ERP role.
 * Returns a 403 response when denied, or null when allowed.
 */
export async function workshopActionGate(
  actor: ErpActor,
  allowance: WorkshopActionAllowance
): Promise<NextResponse | null> {
  const erpRole = (actor?.role || "").toLowerCase();
  if (allowance.erpRoles?.some((r) => r.toLowerCase() === erpRole)) return null;

  if (allowance.workshopRoles?.length) {
    const identity = await resolveWorkshopIdentity(actor);
    if (identity.isWorkshopStaff && allowance.workshopRoles.includes(identity.workshopRole)) {
      return null;
    }
  }

  const parts: string[] = [];
  if (allowance.workshopRoles?.length) parts.push(`workshop role ${allowance.workshopRoles.join(" or ")}`);
  if (allowance.erpRoles?.length) parts.push(`role ${allowance.erpRoles.join(" or ")}`);
  return denied(actor, parts.join(", or ") || "a workshop role");
}

/** ERP roles that participate in the workshops module at all. */
const WORKSHOP_PARTICIPANT_ERP_ROLES = ["admin", "manager", "storekeeper", "technician", "dispatcher", "hr"];

/**
 * Gate the workshop read endpoints (job / tool / scrap lists and details,
 * options). Participants are the workshop ERP roles, plus anyone whose
 * linked employee record carries a real workshop designation (supervisor /
 * store / manager). Everyone else — accountant, cashier, call_center,
 * purchasing, auditor, creator, anonymous — is refused.
 */
export async function workshopParticipantGate(actor: ErpActor): Promise<NextResponse | null> {
  const erpRole = (actor?.role || "").toLowerCase();
  if (WORKSHOP_PARTICIPANT_ERP_ROLES.includes(erpRole)) return null;

  const identity = await resolveWorkshopIdentity(actor);
  if (identity.isWorkshopStaff && identity.workshopRole !== "mechanic") return null;

  return denied(actor, "a workshop participant role");
}

/**
 * Gate the workshop reports endpoint: ERP admin / manager, or any actor
 * holding the jobs.reports permission.
 */
export function workshopReportsGate(actor: ErpActor): NextResponse | null {
  const erpRole = (actor?.role || "").toLowerCase();
  if (erpRole === "admin" || erpRole === "manager" || actorHasPermission(actor, "jobs.reports")) {
    return null;
  }
  return denied(actor, "role admin or manager, or the jobs.reports permission");
}
