import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicErpUser, validateErpPassword } from "@/lib/auth/webAuth";
import { effectiveMapForUser, isAssignableWebRole, keysBeyondActor, sanitizePermissionMap } from "@/lib/auth/roleStore";
import { logAdminChange, requireUserAdmin } from "@/lib/auth/userAdminGate";

async function activeAdminCount() {
  return prisma.erpUser.count({ where: { role: "admin", status: "active" } });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireUserAdmin(request, ["settings.manage_users"]);
  if (gate.error) return gate.error;
  const { ctx } = gate;
  const { id } = await context.params;
  const current = await prisma.erpUser.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const data: Prisma.ErpUserUpdateInput = {};
  const isSelf = ctx.auth.user.id === id;

  // Only an administrator may change an administrator account.
  if (current.role === "admin" && !ctx.isAdmin) {
    return NextResponse.json({ error: "Only an administrator can change an administrator account." }, { status: 403 });
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length > 0 && (name.length < 2 || name.length > 100)) {
      return NextResponse.json({ error: "Full name must be between 2 and 100 characters if provided." }, { status: 400 });
    }
    data.name = name;
  }
  if (body.username !== undefined) {
    const username = String(body.username).trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) return NextResponse.json({ error: "Enter a valid username." }, { status: 400 });
    data.username = username;
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    data.email = email;
  }

  let nextRole = current.role;
  if (body.role !== undefined && String(body.role).toLowerCase() !== current.role) {
    const role = String(body.role).toLowerCase();
    if (!(await isAssignableWebRole(role))) return NextResponse.json({ error: "Select a valid role." }, { status: 400 });
    if (isSelf) return NextResponse.json({ error: "You cannot change your own role. Ask another administrator." }, { status: 409 });
    if (role === "admin" && !ctx.isAdmin) return NextResponse.json({ error: "Only an administrator can grant the administrator role." }, { status: 403 });
    if (current.role === "admin" && current.status === "active" && (await activeAdminCount()) <= 1) {
      return NextResponse.json({ error: "This is the last active administrator. Make someone else an administrator first." }, { status: 409 });
    }
    data.role = role;
    nextRole = role;
  }

  if (body.status !== undefined && body.status !== current.status) {
    if (!["active", "suspended"].includes(body.status)) return NextResponse.json({ error: "Invalid account status." }, { status: 400 });
    if (isSelf && body.status === "suspended") return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 409 });
    if (current.role === "admin" && body.status === "suspended" && (await activeAdminCount()) <= 1) {
      return NextResponse.json({ error: "The last active administrator cannot be deactivated." }, { status: 409 });
    }
    data.status = body.status;
  }
  if (body.designation !== undefined) data.designation = String(body.designation).trim().slice(0, 100);
  if (body.department !== undefined) data.department = String(body.department).trim().slice(0, 100);
  if (body.badgeColor !== undefined) data.badgeColor = String(body.badgeColor).slice(0, 80);

  let nextOverrides: Record<string, boolean> = sanitizePermissionMap(current.permissionOverrides);
  if (body.permissionOverrides !== undefined) {
    if (isSelf && !ctx.isAdmin) return NextResponse.json({ error: "You cannot change your own permission overrides." }, { status: 409 });
    nextOverrides = sanitizePermissionMap(body.permissionOverrides);
    data.permissionOverrides = Object.keys(nextOverrides).length ? nextOverrides : Prisma.DbNull;
  }

  // No privilege escalation: newly granted permissions must be ones the caller holds.
  if (!ctx.isAdmin && (data.role !== undefined || data.permissionOverrides !== undefined)) {
    const before = await effectiveMapForUser({ role: current.role, permissionOverrides: current.permissionOverrides });
    const after = await effectiveMapForUser({ role: nextRole, permissionOverrides: nextOverrides });
    const newlyGranted: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(after)) if (v && !before[k]) newlyGranted[k] = true;
    const beyond = keysBeyondActor(ctx.actorMap, newlyGranted);
    if (beyond.length) {
      return NextResponse.json({ error: `You cannot grant permissions you do not hold: ${beyond.join(", ")}`, code: "PRIVILEGE_ESCALATION" }, { status: 403 });
    }
  }

  const passwordReset = body.password !== undefined && String(body.password) !== "";
  if (passwordReset) {
    const password = String(body.password);
    const error = validateErpPassword(password);
    if (error) return NextResponse.json({ error }, { status: 400 });
    data.passwordHash = await bcrypt.hash(password, 12);
    data.passwordChangedAt = new Date();
    data.mustChangePassword = body.mustChangePassword !== false;
    data.failedLoginAttempts = 0;
    data.lockedUntil = null;
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.erpUser.update({ where: { id }, data });
      // Sign the user out everywhere when their access changes materially.
      if (passwordReset || data.status === "suspended" || data.role !== undefined) {
        await tx.erpSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return updated;
    });
    const changed = Object.keys(data).filter((k) => k !== "passwordHash");
    await logAdminChange(ctx, `Updated user @${user.username}: ${changed.join(", ") || "no changes"}`, `ErpUser:${id}`, {
      role: data.role !== undefined ? { from: current.role, to: nextRole } : undefined,
      permissionOverrides: data.permissionOverrides !== undefined ? nextOverrides : undefined,
      passwordReset,
    });
    return NextResponse.json({ user: publicErpUser(user) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That username or email is already in use." }, { status: 409 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const gate = await requireUserAdmin(request, ["settings.manage_users"]);
  if (gate.error) return gate.error;
  const { ctx } = gate;
  const { id } = await context.params;
  const user = await prisma.erpUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.role === "admin") return NextResponse.json({ error: "Administrator accounts must be deactivated, not deleted." }, { status: 409 });
  if (ctx.auth.user.id === id) return NextResponse.json({ error: "You cannot delete your own account." }, { status: 409 });
  await prisma.erpUser.delete({ where: { id } });
  await logAdminChange(ctx, `Deleted user @${user.username} (role '${user.role}')`, `ErpUser:${id}`);
  return NextResponse.json({ ok: true });
}
