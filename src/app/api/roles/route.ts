export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import {
  RESERVED_ROLE_KEYS,
  getRoleDefinition,
  invalidateRoleCache,
  isSystemRole,
  keysBeyondActor,
  listRoleDefinitions,
  sanitizePermissionMap,
} from "@/lib/auth/roleStore";
import { logAdminChange, requireUserAdmin } from "@/lib/auth/userAdminGate";

export async function GET(request: NextRequest) {
  const gate = await requireUserAdmin(request, ["settings.manage_roles", "settings.manage_users"]);
  if (gate.error) return gate.error;
  const [roles, counts] = await Promise.all([
    listRoleDefinitions(),
    prisma.erpUser.groupBy({ by: ["role"], _count: { _all: true } }),
  ]);
  const userCounts = Object.fromEntries(counts.map((c) => [c.role, c._count._all]));
  return NextResponse.json(
    {
      roles: roles.map((r) => ({ ...r, userCount: userCounts[r.key] || 0 })),
      groups: PERMISSION_GROUPS,
      canManageRoles: gate.ctx.isAdmin || gate.ctx.actorMap["settings.manage_roles"] === true,
      actorPermissions: gate.ctx.actorMap,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: NextRequest) {
  const gate = await requireUserAdmin(request, ["settings.manage_roles"]);
  if (gate.error) return gate.error;
  const { ctx } = gate;
  const body = await request.json().catch(() => ({}));
  const key = String(body.key || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const label = String(body.label || body.name || "").trim();
  const description = String(body.description || "").trim().slice(0, 300);
  if (!/^[a-z][a-z0-9_]{2,39}$/.test(key)) {
    return NextResponse.json({ error: "Role key must be 3–40 characters: lowercase letters, numbers and underscores, starting with a letter." }, { status: 400 });
  }
  if (RESERVED_ROLE_KEYS.includes(key) || isSystemRole(key)) {
    return NextResponse.json({ error: `'${key}' is a built-in role key. Pick another key.` }, { status: 409 });
  }
  if (label.length < 2 || label.length > 60) return NextResponse.json({ error: "Display name must be 2–60 characters." }, { status: 400 });
  if (await getRoleDefinition(key)) return NextResponse.json({ error: `Role '${key}' already exists.` }, { status: 409 });

  let permissions = sanitizePermissionMap(body.permissions);
  if (body.cloneFrom) {
    const source = await getRoleDefinition(String(body.cloneFrom));
    if (!source) return NextResponse.json({ error: "The role to copy from was not found." }, { status: 400 });
    permissions = { ...source.permissions, ...permissions };
  }
  // Store only grants; everything else is denied for custom roles.
  const grants = Object.fromEntries(Object.entries(permissions).filter(([, v]) => v === true));
  if (!ctx.isAdmin) {
    const beyond = keysBeyondActor(ctx.actorMap, grants);
    if (beyond.length) {
      return NextResponse.json({ error: `You cannot grant permissions you do not hold: ${beyond.join(", ")}`, code: "PRIVILEGE_ESCALATION" }, { status: 403 });
    }
  }

  await prisma.erpRole.create({
    data: {
      key,
      label,
      description,
      isSystem: false,
      permissions: grants,
      badgeColor: String(body.badgeColor || "bg-indigo-600 text-white").slice(0, 80),
      createdBy: ctx.auth.user.username,
      updatedBy: ctx.auth.user.username,
    },
  });
  invalidateRoleCache();
  await logAdminChange(ctx, `Created role '${key}' (${label}) with ${Object.keys(grants).length} permission(s)`, `ErpRole:${key}`, { grants });
  return NextResponse.json({ role: await getRoleDefinition(key) }, { status: 201 });
}
