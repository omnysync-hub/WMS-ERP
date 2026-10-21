import { Prisma, PrismaClient } from "@prisma/client";

/**
 * Settings › User Accounts ↔ HR link.
 * One ErpUser (web login) ⇄ one Employee (HR record) via Employee.erpUserId.
 * Only identity fields (name, email, phone) and active/inactive status are kept in sync.
 * Passwords are never copied: the ERP password lives on ErpUser, the mobile password on Employee.
 */
type Db = Prisma.TransactionClient | PrismaClient;

const ROLE_HR_DEFAULTS: Record<string, { department: string; designation: string }> = {
  admin: { department: "Management", designation: "Administrator" },
  dispatcher: { department: "Operations", designation: "Dispatcher" },
  accountant: { department: "Accounts", designation: "Accountant" },
  storekeeper: { department: "Operations", designation: "Storekeeper" },
  call_center: { department: "Operations", designation: "Call Center Agent" },
  hr: { department: "HR", designation: "HR Officer" },
  technician: { department: "Maintenance", designation: "Technician" },
  sales: { department: "Sales", designation: "Sales Executive" },
};

export function hrDefaultsForRole(role: string, designation?: string | null, department?: string | null) {
  const key = String(role || "").toLowerCase();
  const base = ROLE_HR_DEFAULTS[key] || {
    department: "Operations",
    designation: key ? key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Staff",
  };
  return {
    department: String(department || "").trim() || base.department,
    designation: String(designation || "").trim() || base.designation,
  };
}

export const normPhone = (p?: string | null) => String(p || "").replace(/[^\d+]/g, "");

const INACTIVE_EMPLOYEE_STATUSES = ["inactive", "terminated"];
export function employeeIsInactive(e: { active?: boolean | null; status?: string | null }) {
  return e.active === false || INACTIVE_EMPLOYEE_STATUSES.includes(String(e.status || "").toLowerCase());
}

type UserLike = {
  id: string; name: string; email: string; phone?: string | null; role: string;
  designation?: string | null; department?: string | null; status: string;
};

/**
 * Link the user to an existing HR employee (already linked, or unlinked match by email/phone),
 * or create one. Idempotent. Returns { employee, action }.
 */
export async function linkOrCreateEmployeeForUser(db: Db, user: UserLike) {
  const existingLinked = await db.employee.findUnique({ where: { erpUserId: user.id } });
  if (existingLinked) return { employee: existingLinked, action: "already_linked" as const };

  const phone = normPhone(user.phone);
  const or: Prisma.EmployeeWhereInput[] = [];
  if (user.email) or.push({ email: { equals: user.email, mode: "insensitive" } });
  if (phone.length >= 7) or.push({ phone: { contains: phone.slice(-10) } });
  const candidates = or.length
    ? await db.employee.findMany({ where: { erpUserId: null, OR: or }, orderBy: [{ active: "desc" }, { createdAt: "asc" }] })
    : [];
  // Prefer an email match over a phone match.
  const match =
    candidates.find((c) => user.email && String(c.email || "").toLowerCase() === user.email.toLowerCase()) ||
    candidates.find((c) => phone.length >= 7 && normPhone(c.phone).slice(-10) === phone.slice(-10));

  const active = user.status === "active";
  if (match) {
    const employee = await db.employee.update({
      where: { id: match.id },
      data: {
        erpUserId: user.id,
        // Fill gaps only; HR stays the source of truth for fields it already has.
        email: match.email || user.email || null,
        phone: match.phone || user.phone || "",
      },
    });
    return { employee, action: "linked_existing" as const };
  }

  const hr = hrDefaultsForRole(user.role, user.designation, user.department);
  const employee = await db.employee.create({
    data: {
      name: user.name || user.email,
      email: user.email || null,
      phone: user.phone || "",
      role: user.role,
      department: hr.department,
      designation: hr.designation,
      status: active ? "Active" : "Inactive",
      active,
      erpUserId: user.id,
    },
  });
  return { employee, action: "created" as const };
}

/** Push ERP-user identity/status changes onto the linked employee (inside the caller's transaction). */
export async function syncEmployeeFromUser(
  db: Db,
  userId: string,
  changes: { name?: string; email?: string; phone?: string; status?: string }
) {
  const emp = await db.employee.findUnique({ where: { erpUserId: userId } });
  if (!emp) return null;
  const data: Prisma.EmployeeUpdateInput = {};
  if (changes.name !== undefined && changes.name && changes.name !== emp.name) data.name = changes.name;
  if (changes.email !== undefined && changes.email !== (emp.email || "")) data.email = changes.email || null;
  if (changes.phone !== undefined && changes.phone !== emp.phone) data.phone = changes.phone;
  if (changes.status === "suspended" && !employeeIsInactive(emp)) { data.active = false; data.status = "Inactive"; }
  if (changes.status === "active" && employeeIsInactive(emp)) { data.active = true; data.status = "Active"; }
  if (!Object.keys(data).length) return emp;
  return db.employee.update({ where: { id: emp.id }, data });
}

export class LinkedUserSyncError extends Error {}

/** Push HR identity/status changes onto the linked ERP user (inside the caller's transaction). */
export async function syncUserFromEmployee(
  db: Db,
  employee: { erpUserId: string | null; name: string; email: string | null; phone: string; active: boolean; status: string }
) {
  if (!employee.erpUserId) return null;
  const user = await db.erpUser.findUnique({ where: { id: employee.erpUserId } });
  if (!user) return null;
  const data: Prisma.ErpUserUpdateInput = {};
  if (employee.name && employee.name !== user.name) data.name = employee.name;
  const email = String(employee.email || "").trim().toLowerCase();
  if (email && email !== user.email) {
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new LinkedUserSyncError("Enter a valid email address (it is also the linked ERP login's email).");
    const clash = await db.erpUser.findFirst({ where: { id: { not: user.id }, email: { equals: email, mode: "insensitive" } } });
    if (clash) throw new LinkedUserSyncError("That email is already used by another ERP login.");
    data.email = email;
  }
  if (employee.phone !== user.phone) data.phone = employee.phone || "";
  const inactive = employeeIsInactive(employee);
  if (inactive && user.status === "active") {
    if (user.role === "admin") {
      const admins = await db.erpUser.count({ where: { role: "admin", status: "active" } });
      if (admins <= 1) throw new LinkedUserSyncError("This employee's ERP login is the last active administrator, so it cannot be deactivated.");
    }
    data.status = "suspended";
  }
  if (!inactive && user.status === "suspended") data.status = "active";
  if (!Object.keys(data).length) return user;
  const updated = await db.erpUser.update({ where: { id: user.id }, data });
  if (data.status === "suspended") {
    await db.erpSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
  }
  return updated;
}

/** Fields the Users list shows for the linked employee. */
export const LINKED_EMPLOYEE_SELECT = {
  id: true, name: true, designation: true, department: true, status: true, active: true,
  reportingManager: { select: { id: true, name: true, designation: true } },
} satisfies Prisma.EmployeeSelect;
