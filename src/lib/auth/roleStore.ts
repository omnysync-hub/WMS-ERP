/**
 * Server-side role & permission store.
 *
 * - Built-in roles keep their defaults in DEFAULT_ROLE_PERMISSIONS; edits made in
 *   Settings > Users & Roles are stored in the ErpRole table and layered on top.
 * - Custom roles live only in ErpRole and start with no permissions except what is stored.
 * - The effective role map is folded into the signed actor "overrides" by middleware, so every
 *   existing server-side gate (actorHasPermission / requireJobsPermission / ...) enforces it
 *   without each route needing a database lookup.
 */
import { prisma } from "@/lib/prisma";
import { ALL_PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions";
import { ERP_ROLE_OPTIONS } from "@/lib/auth/erpRoles";
import { actorHasPermission, type ErpActor } from "@/lib/auth/erpActor";

/** Built-in roles that ship with the product (web ERP roles + the mobile technician role). */
export const SYSTEM_ROLE_KEYS: string[] = Array.from(
  new Set([...ERP_ROLE_OPTIONS.map((r) => r.key as string), ...Object.keys(DEFAULT_ROLE_PERMISSIONS)])
);
/** Roles whose permissions can never be edited (admin always has everything). */
export const LOCKED_ROLE_KEYS = ["admin"];
/** Keys that can never be used for a custom role. */
export const RESERVED_ROLE_KEYS = ["admin", "technician", "anonymous", "system", "root", "superadmin"];
/** Roles that cannot be assigned to an ERP web user (technicians sign in through the mobile app). */
export const NON_WEB_ROLE_KEYS = ["technician"];

const PERMISSION_KEY_SET = new Set(ALL_PERMISSION_KEYS);

export type RoleDefinition = {
  key: string;
  label: string;
  description: string;
  isSystem: boolean;
  isLocked: boolean;
  badgeColor: string;
  /** Full map over ALL_PERMISSION_KEYS (exact keys, no alias expansion). */
  permissions: Record<string, boolean>;
  customized: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

type StoredRole = {
  key: string;
  label: string;
  description: string;
  isSystem: boolean;
  permissions: unknown;
  badgeColor: string;
  updatedAt: Date;
  updatedBy: string | null;
};

/** Keep only known permission keys with boolean values. */
export function sanitizePermissionMap(input: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (PERMISSION_KEY_SET.has(k) && typeof v === "boolean") out[k] = v;
  }
  return out;
}

export function isSystemRole(key: string) {
  return SYSTEM_ROLE_KEYS.includes(String(key || "").toLowerCase());
}

function defaultMap(roleKey: string): Record<string, boolean> {
  const r = roleKey.toLowerCase();
  const base = DEFAULT_ROLE_PERMISSIONS[r] || {};
  const out: Record<string, boolean> = {};
  for (const k of ALL_PERMISSION_KEYS) out[k] = r === "admin" ? true : base[k] === true;
  return out;
}

// Short cache so middleware does not hit the DB for the role row on every request.
// Writes through this module clear it; other server instances pick up edits within CACHE_MS.
const CACHE_MS = 5000;
const cache = new Map<string, { at: number; row: StoredRole | null }>();

export function invalidateRoleCache() {
  cache.clear();
}

async function loadStoredRole(roleKey: string): Promise<StoredRole | null> {
  const key = roleKey.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.row;
  let row: StoredRole | null = null;
  try {
    row = (await prisma.erpRole.findUnique({ where: { key } })) as StoredRole | null;
  } catch {
    // Table not migrated yet: behave exactly like the built-in defaults.
    row = null;
  }
  cache.set(key, { at: Date.now(), row });
  return row;
}

async function loadAllStoredRoles(): Promise<StoredRole[]> {
  try {
    return (await prisma.erpRole.findMany({ orderBy: { label: "asc" } })) as StoredRole[];
  } catch {
    return [];
  }
}

function toDefinition(key: string, row: StoredRole | null): RoleDefinition {
  const option = ERP_ROLE_OPTIONS.find((r) => r.key === key);
  const system = isSystemRole(key);
  const locked = LOCKED_ROLE_KEYS.includes(key);
  let permissions: Record<string, boolean>;
  if (locked) permissions = defaultMap("admin");
  else if (system) permissions = { ...defaultMap(key), ...sanitizePermissionMap(row?.permissions) };
  else {
    permissions = {};
    const stored = sanitizePermissionMap(row?.permissions);
    for (const k of ALL_PERMISSION_KEYS) permissions[k] = stored[k] === true;
  }
  return {
    key,
    label: row?.label || option?.label || (key === "technician" ? "Field Technician" : key),
    description: row?.description || option?.description || "",
    isSystem: system,
    isLocked: locked,
    badgeColor: row?.badgeColor || "bg-indigo-600 text-white",
    permissions,
    customized: Boolean(row) && system,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    updatedBy: row?.updatedBy || null,
  };
}

export async function getRoleDefinition(roleKey: string): Promise<RoleDefinition | null> {
  const key = String(roleKey || "").toLowerCase();
  if (!key) return null;
  const row = await loadStoredRole(key);
  if (!row && !isSystemRole(key)) return null;
  return toDefinition(key, row);
}

export async function listRoleDefinitions(): Promise<RoleDefinition[]> {
  const rows = await loadAllStoredRoles();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const system = SYSTEM_ROLE_KEYS.map((k) => toDefinition(k, byKey.get(k) || null));
  const custom = rows.filter((r) => !isSystemRole(r.key)).map((r) => toDefinition(r.key, r));
  return [...system, ...custom];
}

/** True when the role exists (built-in or custom) and may be assigned to an ERP web user. */
export async function isAssignableWebRole(roleKey: string): Promise<boolean> {
  const key = String(roleKey || "").toLowerCase();
  if (!key || NON_WEB_ROLE_KEYS.includes(key)) return false;
  return Boolean(await getRoleDefinition(key));
}

/**
 * Overrides to sign into the actor headers: the difference between the role's effective map and
 * the built-in defaults, with the user's own overrides on top (user overrides win).
 */
export async function signedOverridesFor(roleKey: string, userOverrides?: unknown): Promise<Record<string, boolean>> {
  const key = String(roleKey || "").toLowerCase();
  const user = sanitizePermissionMap(userOverrides);
  if (key === "admin") return user;
  const def = await getRoleDefinition(key);
  const base = defaultMap(key);
  const delta: Record<string, boolean> = {};
  if (def) {
    for (const k of ALL_PERMISSION_KEYS) {
      if (def.permissions[k] !== base[k]) delta[k] = def.permissions[k];
    }
  }
  return { ...delta, ...user };
}

/** Full effective permission map for an actor (role + overrides, alias-aware). */
export function effectivePermissionMap(actor: Pick<ErpActor, "role" | "overrides">): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const k of ALL_PERMISSION_KEYS) out[k] = actorHasPermission(actor, k);
  return out;
}

/** Effective permission map of a user record (used for escalation checks). */
export async function effectiveMapForUser(user: { role: string; permissionOverrides?: unknown }) {
  const overrides = await signedOverridesFor(user.role, user.permissionOverrides);
  return effectivePermissionMap({ role: user.role, overrides });
}

/** Keys granted in `wanted` that the actor does not hold themselves. */
export function keysBeyondActor(actorMap: Record<string, boolean>, wanted: Record<string, boolean>): string[] {
  return Object.entries(wanted)
    .filter(([k, v]) => v === true && actorMap[k] !== true)
    .map(([k]) => k);
}
