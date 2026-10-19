export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSION_KEYS } from "@/lib/permissions";
import {
  LOCKED_ROLE_KEYS,
  getRoleDefinition,
  invalidateRoleCache,
  keysBeyondActor,
  sanitizePermissionMap,
} from "@/lib/auth/roleStore";
import { logAdminChange, requireUserAdmin } from "@/lib/auth/userAdminGate";

/**
 * PATCH /api/roles/:key
 * Body: { label?, description?, badgeColor?, permissions?: Record<key, boolean> (partial patch), reset?: true }
 * - admin is locked (always all permissions).
 * - Built-in roles: the change is stored as an edit on top of the built-in defaults; reset restores them.
 * - Non-admins cannot edit their own role and cannot grant permissions they do not hold.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  const gate = await requireUserAdmin(request, ["settings.manage_roles"]);
  if (gate.error) return gate.error;
  const { ctx } = gate;
  const { key: rawKey } = await context.params;
  const key = decodeURIComponent(rawKey).toLowerCase();
  if (LOCKED_ROLE_KEYS.includes(key)) {
    return NextResponse.json({ error: "The Administrator role always has every permission and cannot be edited." }, { status: 409 });
  }
  const current = await getRoleDefinition(key);
  if (!current) return NextResponse.json({ error: "Role not found." }, { status: 404 });
  if (!ctx.isAdmin && ctx.auth.user.role === key) {
    return NextResponse.json({ error: "You cannot change the permissions of your own role." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));

  if (body.reset === true) {
    if (!current.isSystem) return NextResponse.json({ error: "Only built-in roles can be reset to defaults." }, { status: 400 });
    if (!ctx.isAdmin) {
      const defaults: Record<string, boolean> = {};
      for (const k of ALL_PERMISSION_KEYS) if ((DEFAULT_ROLE_PERMISSIONS[key] || {})[k] === true && !current.permissions[k]) defaults[k] = true;
      const beyond = keysBeyondActor(ctx.actorMap, defaults);
      if (beyond.length) return NextResponse.json({ error: `Resetting would grant permissions you do not hold: ${beyond.join(", ")}`, code: "PRIVILEGE_ESCALATION" }, { status: 403 });
    }
    await prisma.erpRole.deleteMany({ where: { key } });
    invalidateRoleCache();
    await logAdminChange(ctx, `Reset role '${key}' to built-in defaults`, `ErpRole:${key}`);
    return NextResponse.json({ role: await getRoleDefinition(key) });
  }

  const patch = sanitizePermissionMap(body.permissions);
  const next = { ...current.permissions, ...patch };
  if (!ctx.isAdmin) {
    const newlyGranted: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(patch)) if (v && !current.permissions[k]) newlyGranted[k] = true;
    const beyond = keysBeyondActor(ctx.actorMap, newlyGranted);
    if (beyond.length) {
      return NextResponse.json({ error: `You cannot grant permissions you do not hold: ${beyond.join(", ")}`, code: "PRIVILEGE_ESCALATION" }, { status: 403 });
    }
  }

  const label = body.label !== undefined ? String(body.label).trim() : current.label;
  if (label.length < 2 || label.length > 60) return NextResponse.json({ error: "Display name must be 2–60 characters." }, { status: 400 });
  const description = body.description !== undefined ? String(body.description).trim().slice(0, 300) : current.description;
  const badgeColor = body.badgeColor !== undefined ? String(body.badgeColor).slice(0, 80) : current.badgeColor;

  // Built-in: store only differences from defaults. Custom: store grants only.
  let stored: Record<string, boolean>;
  if (current.isSystem) {
    const defaults = DEFAULT_ROLE_PERMISSIONS[key] || {};
    stored = {};
    for (const k of ALL_PERMISSION_KEYS) if ((defaults[k] === true) !== next[k]) stored[k] = next[k];
  } else {
    stored = Object.fromEntries(Object.entries(next).filter(([, v]) => v === true));
  }

  await prisma.erpRole.upsert({
    where: { key },
    create: { key, label, description, badgeColor, isSystem: current.isSystem, permissions: stored, createdBy: ctx.auth.user.username, updatedBy: ctx.auth.user.username },
    update: { label, description, badgeColor, permissions: stored, updatedBy: ctx.auth.user.username },
  });
  invalidateRoleCache();
  const changes = Object.entries(patch).filter(([k, v]) => current.permissions[k] !== v);
  await logAdminChange(ctx, `Updated role '${key}': ${changes.length} permission change(s)`, `ErpRole:${key}`, {
    changes: Object.fromEntries(changes),
  });
  return NextResponse.json({ role: await getRoleDefinition(key) });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  const gate = await requireUserAdmin(request, ["settings.manage_roles"]);
  if (gate.error) return gate.error;
  const { ctx } = gate;
  const { key: rawKey } = await context.params;
  const key = decodeURIComponent(rawKey).toLowerCase();
  const current = await getRoleDefinition(key);
  if (!current) return NextResponse.json({ error: "Role not found." }, { status: 404 });
  if (current.isSystem) return NextResponse.json({ error: "Built-in roles cannot be deleted (you can reset them to defaults)." }, { status: 409 });
  const assigned = await prisma.erpUser.count({ where: { role: key } });
  if (assigned > 0) {
    return NextResponse.json({ error: `${assigned} user(s) still have this role. Move them to another role first.` }, { status: 409 });
  }
  await prisma.erpRole.delete({ where: { key } });
  invalidateRoleCache();
  await logAdminChange(ctx, `Deleted custom role '${key}'`, `ErpRole:${key}`);
  return NextResponse.json({ ok: true });
}
